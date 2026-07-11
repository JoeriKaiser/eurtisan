import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { like } from 'drizzle-orm'
import { product } from '../../src/db/schema'
import { db } from '../db'
import { getCreatorShop } from '../fixtures/orders'

const E2E_PRODUCT_NAME_PREFIX = 'E2E Bulk'

async function createTestProduct(
  shopId: string,
  name: string,
  status: 'draft' | 'published',
  isActive: boolean,
) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  await db.insert(product).values({
    id: randomUUID(),
    name,
    slug,
    priceCents: 1999,
    stockCount: 10,
    isActive,
    status,
    shopId,
    vatRateCategory: 'standard',
    publishedAt: status === 'published' ? new Date() : null,
  })
}

test.describe('creator product bulk actions', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test.afterAll(async () => {
    await db.delete(product).where(like(product.name, `${E2E_PRODUCT_NAME_PREFIX}%`))
  })

  test('creator can bulk activate and deactivate published products', async ({ page }) => {
    const shop = await getCreatorShop()
    const suffix = Date.now().toString()
    const names = [1, 2, 3].map((i) => `${E2E_PRODUCT_NAME_PREFIX} ${suffix} ${i}`)

    for (const name of names) {
      await createTestProduct(shop.id, name, 'published', true)
    }

    await page.goto(`/creator/products?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await page
      .getByRole('searchbox', { name: 'Search products by name…' })
      .fill(`${E2E_PRODUCT_NAME_PREFIX} ${suffix}`)
    await expect(page.locator('tbody tr')).toHaveCount(3)

    await page.getByRole('checkbox', { name: 'Select all products on this page' }).check()
    await expect(page.getByText('3 selected', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
    await expect(page.getByText('Bulk action completed.')).toBeVisible({ timeout: 15000 })

    for (const name of names) {
      const row = page.locator('tbody tr').filter({ hasText: name })
      await expect(row.getByRole('button', { name: /^Activate/ })).toBeVisible()
    }

    await page.getByRole('checkbox', { name: 'Select all products on this page' }).check()
    await expect(page.getByText('3 selected', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByText('Bulk action completed.')).toBeVisible({ timeout: 15000 })

    for (const name of names) {
      const row = page.locator('tbody tr').filter({ hasText: name })
      await expect(row.getByRole('button', { name: /^Deactivate/ })).toBeVisible()
    }
  })

  test('creator can bulk delete products', async ({ page }) => {
    const shop = await getCreatorShop()
    const suffix = (Date.now() + 1).toString()
    const names = [1, 2, 3].map((i) => `${E2E_PRODUCT_NAME_PREFIX} ${suffix} ${i}`)

    for (const name of names) {
      await createTestProduct(shop.id, name, 'draft', true)
    }

    await page.goto(`/creator/products?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await page
      .getByRole('searchbox', { name: 'Search products by name…' })
      .fill(`${E2E_PRODUCT_NAME_PREFIX} ${suffix}`)
    await expect(page.locator('tbody tr')).toHaveCount(3)

    await page.getByRole('tab', { name: 'Draft' }).click()
    await expect(page.locator('tbody tr')).toHaveCount(3)

    await page.getByRole('checkbox', { name: 'Select all products on this page' }).check()
    await expect(page.getByText('3 selected', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Delete', exact: true }).first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Bulk action completed.')).toBeVisible({ timeout: 15000 })

    await expect(page.locator('tbody tr')).toHaveCount(0)
    await expect(page.getByText('No matching products')).toBeVisible()
  })
})
