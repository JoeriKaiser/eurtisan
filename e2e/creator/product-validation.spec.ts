import path from 'node:path'
import { expect, test } from '@playwright/test'
import { like } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { getCreatorShop, getTestProduct } from '../fixtures/orders'

const E2E_PRODUCT_NAME_PREFIX = 'E2E Validation'

test.describe('creator product validation', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  let dummyPngPath: string

  test.beforeAll(() => {
    dummyPngPath = path.join(__dirname, '../fixtures/dummy.png')
  })

  test.afterAll(async () => {
    await db.delete(schema.product).where(like(schema.product.name, `${E2E_PRODUCT_NAME_PREFIX}%`))
  })

  test('shows required-field errors on empty new-product form', async ({ page }) => {
    const shop = await getCreatorShop()

    await page.goto(`/creator/products/new?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible()

    await page.getByRole('button', { name: 'Publish' }).click()

    await expect(page.getByText('Product name is required.')).toBeVisible()
    await expect(page.getByText('Slug is required.')).toBeVisible()
    await expect(page.getByText('Price is required.')).toBeVisible()
  })

  test('shows a duplicate-slug error when reusing an existing product slug', async ({ page }) => {
    const shop = await getCreatorShop()
    const existingProduct = await getTestProduct(shop.id)

    await page.goto(`/creator/products/new?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible()

    const shopSelect = page.locator('#product-shop')
    if (await shopSelect.isVisible()) {
      await shopSelect.selectOption(shop.id)
    }

    const suffix = Date.now().toString()
    const uniqueName = `${E2E_PRODUCT_NAME_PREFIX} Duplicate ${suffix}`

    await page.fill('#product-name', uniqueName)
    await page.fill('#product-slug', existingProduct.slug)
    await page.fill('#product-price', '9.99')
    await page.fill('#product-stock', '5')

    await page.getByRole('button', { name: 'Publish' }).click()

    await expect(
      page.getByText(
        'A product with this slug already exists in this shop. Try a different name or edit the slug manually.',
      ),
    ).toBeVisible()
  })

  test('rejects negative price and stock values', async ({ page }) => {
    const shop = await getCreatorShop()

    await page.goto(`/creator/products/new?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible()

    const suffix = Date.now().toString()
    const uniqueName = `${E2E_PRODUCT_NAME_PREFIX} Negative ${suffix}`
    const slug = `${E2E_PRODUCT_NAME_PREFIX.toLowerCase().replace(/\s+/g, '-')}-negative-${suffix}`

    await page.fill('#product-name', uniqueName)
    await page.fill('#product-slug', slug)
    await page.fill('#product-price', '-1')
    await page.fill('#product-stock', '-1')

    await page.getByRole('button', { name: 'Publish' }).click()

    await expect(page.getByText('Price must be greater than zero.')).toBeVisible()
    await expect(page.getByText('Stock must be a non-negative number.')).toBeVisible()
  })

  test('uploads a product image and saves the product', async ({ page }) => {
    const shop = await getCreatorShop()

    await page.goto(`/creator/products/new?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible()

    const suffix = Date.now().toString()
    const uniqueName = `${E2E_PRODUCT_NAME_PREFIX} Image ${suffix}`
    const slug = `${E2E_PRODUCT_NAME_PREFIX.toLowerCase().replace(/\s+/g, '-')}-image-${suffix}`

    await page.fill('#product-name', uniqueName)
    await page.fill('#product-slug', slug)
    await page.fill('#product-price', '29.99')
    await page.fill('#product-stock', '12')

    await page.setInputFiles('#product-image-upload', dummyPngPath)

    await expect(page.getByRole('button', { name: /Remove image/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: 'Publish' }).click()

    await expect(page.getByText('Product published successfully.')).toBeVisible({
      timeout: 15000,
    })
  })
})
