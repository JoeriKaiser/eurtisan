import { test, expect } from '@playwright/test'
import { eq, and } from 'drizzle-orm'
import { db } from './db'
import { shop, product, user } from '../src/db/schema'

async function getCreatorId() {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, 'creator@eurtisan.local'))
    .limit(1)
  return row?.id
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
    page.on('console', (msg) => console.log('OWNER NAV PAGE LOG:', msg.text()))
    page.on('pageerror', (err) => console.error('OWNER NAV PAGE ERROR:', err.message))
    await page.setViewportSize({ width: 1440, height: 900 })

    const creatorId = await getCreatorId()
    if (!creatorId) {
      test.skip(true, 'Test creator not found')
      return
    }

    const testShop = await getTestShop(creatorId)
    if (!testShop) {
      test.skip(true, 'No approved/active shop found for the test creator')
      return
    }

    const testProduct = await getTestProduct(testShop.id)

    // 1. Post-approval payment link
    await page.goto(`/sell/status/${testShop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /approved/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('link', { name: /connect payment/i }).click()
    await page.waitForURL(/\/creator\/payouts\?shopId=/)

    // 2. Studio hub links
    await page.goto(`/studio/${testShop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /shop dashboard/i })).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL(/\/creator\/shop\?shopId=/)

    await page.goto(`/studio/${testShop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.getByRole('link', { name: /products/i }).click()
    await page.waitForURL(/\/creator\/products\?shopId=/)

    await page.goto(`/studio/${testShop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.getByRole('link', { name: /orders/i }).click()
    await page.waitForURL(new RegExp(`/studio/${testShop.id}/orders`))

    // 3. Product edit link
    if (testProduct) {
      await page.goto(`/creator/products?shopId=${testShop.id}`)
      await page.waitForSelector('html[data-hydrated="true"]')
      await expect(page.getByRole('heading', { name: /products/i })).toBeVisible({ timeout: 10000 })
      const editLink = page
        .locator('table tbody tr a[href*="/creator/products/"][href$="/edit"]')
        .first()
      await expect(editLink).toBeVisible()
      await editLink.click()
      await page.waitForURL(new RegExp(`/creator/products/${testProduct.id}/edit`))
    }
  })
})
