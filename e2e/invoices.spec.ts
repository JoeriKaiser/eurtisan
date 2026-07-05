import { test, expect } from '@playwright/test'
import { and, eq } from 'drizzle-orm'
import type { shop } from '../src/db/schema'
import { E2E_CREATOR } from './fixtures/auth'

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test'

type ShopRow = typeof shop.$inferSelect

type ShopVatSnapshot = Pick<
  ShopRow,
  'isVatRegistered' | 'vatId' | 'shippingOrigin' | 'businessAddress'
>

test.describe('Invoices E2E flow', () => {
  let testShopOrder: { id: string; shopId: string; platformOrderId: string } | null = null
  let customerInvNumber = ''
  let feeInvNumber = ''
  let shopId = ''
  let shopSnapshot: ShopVatSnapshot | null = null

  test.beforeAll(async () => {
    process.env.DATABASE_URL = e2eDatabaseUrl

    const { db } = await import('../src/db/index')
    const { platformOrder, shopOrder, invoices, shop, user } = await import('../src/db/schema')
    const { createInvoicesForPlatformOrder } = await import('../src/lib/invoices.server')

    const [creatorUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, E2E_CREATOR.email))
      .limit(1)

    if (!creatorUser) {
      throw new Error('Seed creator user not found in E2E database — run `make db-seed-e2e`')
    }

    const [creatorShop] = await db
      .select()
      .from(shop)
      .where(eq(shop.ownerId, creatorUser.id))
      .limit(1)

    if (!creatorShop) {
      throw new Error('Seed creator shop not found in E2E database')
    }

    shopId = creatorShop.id
    shopSnapshot = {
      isVatRegistered: creatorShop.isVatRegistered,
      vatId: creatorShop.vatId,
      shippingOrigin: creatorShop.shippingOrigin,
      businessAddress: creatorShop.businessAddress,
    }

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
        businessAddress: {
          street: 'Schwarzwaldstraße 12',
          city: 'Freiburg',
          postalCode: '79098',
          country: 'DE',
        },
      })
      .where(eq(shop.id, creatorShop.id))

    const [existingShopOrder] = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.shopId, creatorShop.id))
      .limit(1)

    let targetShopOrder = existingShopOrder

    if (!targetShopOrder) {
      const [po] = await db
        .insert(platformOrder)
        .values({
          userId: creatorUser.id,
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

      const [so] = await db
        .insert(shopOrder)
        .values({
          platformOrderId: po.id,
          shopId: creatorShop.id,
          shippingMethod: 'standard',
          shippingCostCents: 1000,
          subtotalCents: 10000,
          vatAmountCents: 2000,
          status: 'completed',
        })
        .returning()

      targetShopOrder = so
    } else {
      await db
        .update(shopOrder)
        .set({ status: 'completed' })
        .where(eq(shopOrder.id, targetShopOrder.id))
    }

    testShopOrder = targetShopOrder

    await db.delete(invoices).where(eq(invoices.shopOrderId, testShopOrder.id))
    await createInvoicesForPlatformOrder(testShopOrder.platformOrderId)

    const [customerInvRow] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, testShopOrder.id), eq(invoices.type, 'customer')))
      .limit(1)
    const [feeInvRow] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, testShopOrder.id), eq(invoices.type, 'platform_fee')))
      .limit(1)

    if (!customerInvRow || !feeInvRow) {
      throw new Error('Expected customer and platform_fee invoices to be created')
    }

    customerInvNumber = customerInvRow.invoiceNumber
    feeInvNumber = feeInvRow.invoiceNumber
  })

  test.afterAll(async () => {
    if (!shopSnapshot || !shopId) return

    process.env.DATABASE_URL = e2eDatabaseUrl
    const { db } = await import('../src/db/index')
    const { shop } = await import('../src/db/schema')

    await db
      .update(shop)
      .set({
        isVatRegistered: shopSnapshot.isVatRegistered,
        vatId: shopSnapshot.vatId,
        shippingOrigin: shopSnapshot.shippingOrigin,
        businessAddress: shopSnapshot.businessAddress,
      })
      .where(eq(shop.id, shopId))
  })

  test('creator can view invoices from payouts portal', async ({ page }) => {
    if (!testShopOrder) throw new Error('testShopOrder not initialized')

    await page.goto(`/creator/payouts?shopId=${testShopOrder.shopId}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Payouts', exact: true })).toBeVisible()

    const row = page
      .locator('tr')
      .filter({ hasText: testShopOrder.id.slice(0, 8) })
      .first()
    await expect(row).toBeVisible()

    const customerLink = row.locator('a', { hasText: 'Customer' })
    const feeLink = row.locator('a', { hasText: 'Platform Fee' })

    await expect(customerLink).toBeVisible()
    await expect(feeLink).toBeVisible()

    await customerLink.click()
    await page.waitForURL(new RegExp(`/invoices/${customerInvNumber}`))
    await expect(page.getByRole('heading', { name: 'INVOICE', exact: true })).toBeVisible()
    await expect(page.getByText(customerInvNumber).first()).toBeVisible()
    await expect(page.getByText('Seller (on behalf of Artisan)')).toBeVisible()
    await expect(page.getByText('Buyer (Customer)')).toBeVisible()

    await page.goto(`/creator/payouts?shopId=${testShopOrder.shopId}`)
    await page.waitForLoadState('networkidle')

    const row2 = page
      .locator('tr')
      .filter({ hasText: testShopOrder.id.slice(0, 8) })
      .first()
    const feeLink2 = row2.locator('a', { hasText: 'Platform Fee' })
    await feeLink2.click()

    await page.waitForURL(new RegExp(`/invoices/${feeInvNumber}`))
    await expect(page.getByRole('heading', { name: 'INVOICE', exact: true })).toBeVisible()
    await expect(page.getByText(feeInvNumber).first()).toBeVisible()
    await expect(page.getByText('Joeri Kaiser (Eurtisan)').first()).toBeVisible()
    await expect(page.getByText('Reverse Charge').first()).toBeVisible()
    await expect(page.getByText('Autoliquidation')).toBeVisible()
  })
})
