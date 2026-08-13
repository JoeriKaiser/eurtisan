import { waitForAppHydration } from '../fixtures/hydration'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { getCreatorShop } from '../fixtures/orders'

const E2E_ADMIN_PRODUCT_PREFIX = 'E2E Admin Product'

async function createFixtureProduct({
  name,
  status,
  shopId,
  isActive,
}: {
  name: string
  status: 'draft' | 'published' | 'archived'
  shopId: string
  isActive?: boolean
}) {
  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${randomUUID().slice(0, 8)}`

  const [record] = await db
    .insert(schema.product)
    .values({
      id: randomUUID(),
      name,
      slug,
      priceCents: 1234,
      stockCount: 10,
      isActive: isActive ?? status === 'published',
      status,
      publishedAt: status === 'published' ? new Date() : null,
      shopId,
      vatRateCategory: 'standard',
    })
    .returning({ id: schema.product.id })

  return record
}

test.describe('admin product catalog', () => {
  test.describe.configure({ mode: 'serial' })

  let productId: string
  let productName: string

  test.beforeAll(async () => {
    const shop = await getCreatorShop()
    productName = `${E2E_ADMIN_PRODUCT_PREFIX} ${Date.now()}`
    const product = await createFixtureProduct({
      name: productName,
      status: 'published',
      shopId: shop.id,
      isActive: true,
    })
    productId = product.id
  })

  test.afterAll(async () => {
    await db.delete(schema.product).where(eq(schema.product.id, productId))
  })

  test('admin product catalog renders', async ({ page }) => {
    await page.goto('/admin/products')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('admin can search products by name', async ({ page }) => {
    await page.goto('/admin/products')
    await waitForAppHydration(page)

    await page.getByRole('textbox', { name: 'Search by product or shop name…' }).fill(productName)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const row = page.getByRole('row').filter({ has: page.getByText(productName) })
    await expect(row).toBeVisible()
  })

  test('admin can filter products by status', async ({ page }) => {
    await page.goto('/admin/products')
    await waitForAppHydration(page)

    await page.getByRole('textbox', { name: 'Search by product or shop name…' }).fill(productName)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const statusSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: 'All statuses' }),
    })

    await statusSelect.selectOption('inactive')
    await page.waitForURL(/status=inactive/)
    const inactiveRow = page.getByRole('row').filter({ has: page.getByText(productName) })
    await expect(inactiveRow).toBeHidden()

    await statusSelect.selectOption('active')
    await page.waitForURL(/status=active/)
    const activeRow = page.getByRole('row').filter({ has: page.getByText(productName) })
    await expect(activeRow.getByText('Active')).toBeVisible()
  })

  test('admin can toggle a product active state', async ({ page }) => {
    await page.goto('/admin/products')
    await waitForAppHydration(page)

    await page.getByRole('textbox', { name: 'Search by product or shop name…' }).fill(productName)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const row = page.getByRole('row').filter({ has: page.getByText(productName) })
    await expect(row.getByText('Active')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Deactivate' })).toBeVisible()

    await row.getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByText(`${productName} is now inactive.`)).toBeVisible({ timeout: 10000 })
    await expect(row.getByText('Inactive')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Activate' })).toBeVisible()

    await row.getByRole('button', { name: 'Activate' }).click()
    await expect(page.getByText(`${productName} is now active.`)).toBeVisible({ timeout: 10000 })
    await expect(row.getByText('Active')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Deactivate' })).toBeVisible()
  })

  test('bulk selection and export CSV', async ({ page }) => {
    await page.goto('/admin/products')
    await waitForAppHydration(page)

    await page.getByRole('textbox', { name: 'Search by product or shop name…' }).fill(productName)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    const row = page.getByRole('row').filter({ has: page.getByText(productName) })
    await row.getByRole('checkbox', { name: 'Select row' }).check()

    await expect(page.getByText(/1 selected/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Toggle Active' })).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/^products-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
