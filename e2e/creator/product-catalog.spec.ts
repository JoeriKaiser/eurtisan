import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { like } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { getCreatorShop, getTestProduct } from '../fixtures/orders'

const E2E_PRODUCT_NAME_PREFIX = 'E2E Catalog'

test.describe('creator product catalog', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })
  test.describe.configure({ mode: 'serial' })

  let shopId: string
  let seededProductName: string

  test.beforeAll(async () => {
    const shop = await getCreatorShop()
    shopId = shop.id

    const seeded = await getTestProduct(shopId)
    seededProductName = seeded.name

    // Clean up any leftover products from a previous interrupted run so tests
    // start from a known state.
    await db.delete(schema.product).where(like(schema.product.name, `${E2E_PRODUCT_NAME_PREFIX}%`))
  })

  test.afterAll(async () => {
    await db.delete(schema.product).where(like(schema.product.name, `${E2E_PRODUCT_NAME_PREFIX}%`))
  })

  test('default product list renders', async ({ page }) => {
    await page.goto(`/creator/products?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible()
  })

  test('status filter updates the table to show only matching products', async ({ page }) => {
    const suffix = Date.now().toString()
    const publishedName = `${E2E_PRODUCT_NAME_PREFIX} Published ${suffix}`
    const draftName = `${E2E_PRODUCT_NAME_PREFIX} Draft ${suffix}`
    const archivedName = `${E2E_PRODUCT_NAME_PREFIX} Archived ${suffix}`

    await db
      .delete(schema.product)
      .where(like(schema.product.name, `${E2E_PRODUCT_NAME_PREFIX} Published%`))
    await db
      .delete(schema.product)
      .where(like(schema.product.name, `${E2E_PRODUCT_NAME_PREFIX} Draft%`))
    await db
      .delete(schema.product)
      .where(like(schema.product.name, `${E2E_PRODUCT_NAME_PREFIX} Archived%`))

    await createFixtureProduct({ name: publishedName, status: 'published', shopId })
    await createFixtureProduct({ name: draftName, status: 'draft', shopId })
    await createFixtureProduct({ name: archivedName, status: 'archived', shopId })

    await page.goto(`/creator/products?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'Draft' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('tbody tr').filter({ hasText: draftName })).toBeVisible()
    await expect(page.locator('tbody tr').filter({ hasText: publishedName })).toHaveCount(0)
    await expect(page.locator('tbody tr').filter({ hasText: archivedName })).toHaveCount(0)

    await page.getByRole('tab', { name: 'Archived' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('tbody tr').filter({ hasText: archivedName })).toBeVisible()
    await expect(page.locator('tbody tr').filter({ hasText: draftName })).toHaveCount(0)
    await expect(page.locator('tbody tr').filter({ hasText: publishedName })).toHaveCount(0)
  })

  test('search filter finds a product and shows empty state for no matches', async ({ page }) => {
    await page.goto(`/creator/products?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    const searchBox = page.getByRole('searchbox', { name: 'Search products by name…' })
    await searchBox.fill(seededProductName)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('tbody tr').filter({ hasText: seededProductName })).toBeVisible()

    await searchBox.fill('E2E Catalog No Match 000000')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'No matching products' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(0)
  })

  test('pagination shows different products on page 2', async ({ page }) => {
    const suffix = Date.now().toString()

    await db
      .delete(schema.product)
      .where(like(schema.product.name, `${E2E_PRODUCT_NAME_PREFIX} Pagination%`))

    const paginationNames: string[] = []
    const baseTime = Date.now()
    for (let i = 1; i <= 21; i++) {
      const name = `${E2E_PRODUCT_NAME_PREFIX} Pagination ${String(i).padStart(2, '0')} ${suffix}`
      paginationNames.push(name)
      await createFixtureProduct({
        name,
        status: 'published',
        shopId,
        createdAt: new Date(baseTime + i * 1000),
      })
    }

    const search = encodeURIComponent(`${E2E_PRODUCT_NAME_PREFIX} Pagination`)
    await page.goto(`/creator/products?shopId=${shopId}&search=${search}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('navigation', { name: 'Product pagination' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()

    const page1Names = await page
      .locator('tbody tr td:nth-child(2) p.font-medium')
      .allTextContents()
    expect(page1Names.length).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled()
    await expect(page.getByText(/Page 2 of/)).toBeVisible()

    const page2Names = await page
      .locator('tbody tr td:nth-child(2) p.font-medium')
      .allTextContents()
    expect(page2Names.length).toBeGreaterThan(0)
    for (const name of page2Names) {
      expect(page1Names).not.toContain(name)
    }
  })
})

async function createFixtureProduct({
  name,
  status,
  shopId,
  createdAt = new Date(),
}: {
  name: string
  status: 'draft' | 'published' | 'archived'
  shopId: string
  createdAt?: Date
}) {
  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${randomUUID().slice(0, 8)}`

  await db.insert(schema.product).values({
    id: randomUUID(),
    name,
    slug,
    priceCents: 1000,
    stockCount: 10,
    isActive: status === 'published',
    status,
    publishedAt: status === 'published' ? createdAt : null,
    shopId,
    vatRateCategory: 'standard',
    createdAt,
    updatedAt: createdAt,
  })
}
