import { test, expect } from '@playwright/test'
import { db } from '../src/db/index'
import { platformOrder, shopOrder, invoices, shop, user } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { createInvoicesForPlatformOrder } from '../src/lib/invoices.server'

test.describe('Invoices E2E flow', () => {
  let testShopOrder: any = null
  let customerInvNumber = ''
  let feeInvNumber = ''

  test.beforeAll(async () => {
    // 1. Seed or retrieve order data to generate invoices for testing
    const [creatorUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, 'creator@eurtisan.local'))
      .limit(1)

    if (!creatorUser) {
      throw new Error('Seed creator user not found')
    }

    const [creatorShop] = await db
      .select()
      .from(shop)
      .where(eq(shop.ownerId, creatorUser.id))
      .limit(1)

    if (!creatorShop) {
      throw new Error('Seed creator shop not found')
    }

    // Set shop address country to Germany for B2B cross-border test, and enable VAT registration
    await db
      .update(shop)
      .set({
        isVatRegistered: true,
        vatId: 'DE811234567',
        shippingOrigin: {
          street: 'Schwarzwaldstraße 12',
          city: 'Freiburg',
          postalCode: '79098',
          country: 'Germany',
        },
      })
      .where(eq(shop.id, creatorShop.id))

    // Ensure we have a paid platform order and shop order
    // Let's check if one already exists for this shop
    const [existingShopOrder] = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.shopId, creatorShop.id))
      .limit(1)

    let targetShopOrder = existingShopOrder

    if (!targetShopOrder) {
      // Seed a platform order
      const [po] = await db
        .insert(platformOrder)
        .values({
          userId: creatorUser.id, // using creator as buyer for simplicity in seeding
          shippingAddress: {
            name: 'Customer Test',
            street: '42 Avenue des Champs-Élysées',
            city: 'Paris',
            postalCode: '75008',
            country: 'France',
          },
          billingAddress: {
            name: 'Customer Test',
            street: '42 Avenue des Champs-Élysées',
            city: 'Paris',
            postalCode: '75008',
            country: 'France',
          },
          totalCents: 11000,
          status: 'paid',
        })
        .returning()

      // Seed a shop order
      const [so] = await db
        .insert(shopOrder)
        .values({
          platformOrderId: po.id,
          shopId: creatorShop.id,
          shippingMethod: 'standard',
          shippingCostCents: 1000,
          subtotalCents: 10000,
          vatAmountCents: 2000,
          status: 'completed', // completed orders show up on payouts list
        })
        .returning()

      targetShopOrder = so
    } else {
      // Ensure the existing order is marked completed/paid so it is in the payouts list
      await db
        .update(shopOrder)
        .set({ status: 'completed' })
        .where(eq(shopOrder.id, targetShopOrder.id))
    }

    testShopOrder = targetShopOrder
    customerInvNumber = `INV-${testShopOrder.id.toUpperCase()}`
    feeInvNumber = `INV-FEE-${testShopOrder.id.toUpperCase()}`

    // 2. Clean up existing invoices for this order to prevent duplicate key errors, then generate them
    await db.delete(invoices).where(eq(invoices.shopOrderId, testShopOrder.id))
    await createInvoicesForPlatformOrder(testShopOrder.platformOrderId)
  })

  test('creator can view invoices from payouts portal', async ({ page }) => {
    // 1. Visit creator payouts portal (Playwright Chromium project is logged in as creator)
    await page.goto(`/creator/payouts?shopId=${testShopOrder.shopId}`)
    await page.waitForLoadState('networkidle')

    // 2. Verify header exists
    await expect(page.getByRole('heading', { name: 'Payouts', exact: true })).toBeVisible()

    // 3. Find the invoice links for our test order
    const row = page.locator('tr').filter({ hasText: testShopOrder.id.slice(0, 8) }).first()
    await expect(row).toBeVisible()

    const customerLink = row.locator('a', { hasText: 'Customer' })
    const feeLink = row.locator('a', { hasText: 'Platform Fee' })

    await expect(customerLink).toBeVisible()
    await expect(feeLink).toBeVisible()

    // 4. Click the Customer Invoice link and verify it renders the invoice details
    await customerLink.click()
    await page.waitForURL(new RegExp(`/invoices/${customerInvNumber}`))
    await expect(page.getByRole('heading', { name: 'INVOICE', exact: true })).toBeVisible()
    await expect(page.getByText(customerInvNumber).first()).toBeVisible()
    await expect(page.getByText('Seller (on behalf of Artisan)')).toBeVisible()
    await expect(page.getByText('Buyer (Customer)')).toBeVisible()

    // 5. Navigate back and click the Platform Fee Invoice link
    await page.goto(`/creator/payouts?shopId=${testShopOrder.shopId}`)
    await page.waitForLoadState('networkidle')
    
    const row2 = page.locator('tr').filter({ hasText: testShopOrder.id.slice(0, 8) }).first()
    const feeLink2 = row2.locator('a', { hasText: 'Platform Fee' })
    await feeLink2.click()

    await page.waitForURL(new RegExp(`/invoices/${feeInvNumber}`))
    await expect(page.getByRole('heading', { name: 'INVOICE', exact: true })).toBeVisible()
    await expect(page.getByText(feeInvNumber).first()).toBeVisible()
    // Platform fee invoice is Eurtisan (FR) to German Artisan. It should contain "Reverse Charge" badge
    await expect(page.getByText('Joeri Kaiser (Eurtisan)').first()).toBeVisible()
    await expect(page.getByText('Reverse Charge').first()).toBeVisible()
    await expect(page.getByText('Autoliquidation')).toBeVisible()
  })
})
