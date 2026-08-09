import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { and, eq } from 'drizzle-orm'
import { product, shop, user } from '../../src/db/schema'
import { db } from '../db'

async function getCreator() {
  const [row] = await db
    .select({ id: user.id, twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.email, 'creator@eurtisan.local'))
    .limit(1)
  return row
}

async function getTestShop(ownerId: string) {
  const [row] = await db
    .select({ id: shop.id, name: shop.name })
    .from(shop)
    .where(and(eq(shop.ownerId, ownerId), eq(shop.status, 'approved')))
    .limit(1)

  if (row) return row

  const [activeRow] = await db
    .select({ id: shop.id, name: shop.name })
    .from(shop)
    .where(and(eq(shop.ownerId, ownerId), eq(shop.status, 'active')))
    .limit(1)

  return activeRow
}

async function getTestProduct(shopId: string) {
  const [row] = await db
    .select({ id: product.id, name: product.name })
    .from(product)
    .where(eq(product.shopId, shopId))
    .limit(1)
  return row
}

test.describe('owner navigation', () => {
  test('post-approval payment link, studio hub, and product edit link work', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    const creator = await getCreator()
    if (!creator) throw new Error('Seeded creator not found')

    const testShop = await getTestShop(creator.id)
    if (!testShop) throw new Error('No approved/active shop found for the seeded creator')

    const testProduct = await getTestProduct(testShop.id)

    // Payment connection and privileged studio routes require 2FA. Put the
    // seeded creator in that explicit precondition for this navigation test.
    await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, creator.id))

    try {
      // 1. Post-approval payment link
      await page.goto(`/sell/status/${testShop.id}`)
      await waitForAppHydration(page)
      await expect(page.getByRole('heading', { name: /approved/i })).toBeVisible({ timeout: 10000 })
      await page.getByRole('link', { name: /connect now/i }).click()
      await page.waitForURL(/\/creator\/payouts\?shopId=/)

      // 2. Studio hub links
      await page.goto(`/studio/${testShop.id}`)
      await waitForAppHydration(page)
      await expect(page.getByRole('heading', { name: /shop dashboard/i })).toBeVisible({
        timeout: 10000,
      })

      await page.getByRole('link', { name: /settings/i }).click()
      await page.waitForURL(/\/creator\/shop\?shopId=/)

      await page.goto(`/studio/${testShop.id}`)
      await waitForAppHydration(page)
      await page.getByRole('link', { name: /products/i }).click()
      await page.waitForURL(/\/creator\/products\?shopId=/)

      await page.goto(`/studio/${testShop.id}`)
      await waitForAppHydration(page)
      await page.getByRole('link', { name: /orders/i }).click()
      await page.waitForURL(new RegExp(`/studio/${testShop.id}/orders`))

      // 3. Product edit link
      if (testProduct) {
        await page.goto(`/creator/products?shopId=${testShop.id}`)
        await waitForAppHydration(page)
        await expect(page.getByRole('heading', { name: /products/i })).toBeVisible({
          timeout: 10000,
        })
        const editLink = page
          .locator('table tbody tr a[href*="/creator/products/"][href$="/edit"]')
          .first()
        await expect(editLink).toBeVisible()
        await editLink.click()
        await expect(page).toHaveURL(/\/creator\/products\/[^/]+\/edit/, { timeout: 10000 })
      }
    } finally {
      await db
        .update(user)
        .set({ twoFactorEnabled: creator.twoFactorEnabled })
        .where(eq(user.id, creator.id))
    }
  })
})
