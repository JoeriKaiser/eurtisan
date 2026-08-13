import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { like } from 'drizzle-orm'

const E2E_PRODUCT_NAME_PREFIX = 'E2E Lifecycle'

test.describe('creator product lifecycle', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test.afterAll(async () => {
    const connectionString =
      process.env.E2E_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://eurtisan:eurtisan@db:5432/eurtisan'
    process.env.DATABASE_URL = connectionString

    const { db } = await import('../../src/db/index')
    const { product } = await import('../../src/db/schema')
    await db.delete(product).where(like(product.name, `${E2E_PRODUCT_NAME_PREFIX}%`))
  })

  test('creator can save a draft, publish, unpublish, and archive a product', async ({ page }) => {
    test.setTimeout(90_000)
    const suffix = Date.now().toString()
    const productName = `${E2E_PRODUCT_NAME_PREFIX} ${suffix}`

    await page.goto('/creator/products/new')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible()

    await page.fill('#product-name', productName)
    await expect(page.locator('#product-slug')).toHaveValue(
      productName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    )

    await page.fill('#product-price', '29.99')
    await page.fill('#product-stock', '12')

    await page.getByRole('button', { name: 'Save as draft' }).click()

    await page.waitForURL(/\/creator\/products/)
    await waitForAppHydration(page)
    await page.getByRole('tab', { name: 'Draft' }).click()
    await page.waitForSelector('tbody tr')

    const draftRow = page.locator('tbody tr').filter({ hasText: productName })
    await expect(draftRow.getByText('Draft').first()).toBeVisible()

    await draftRow.getByRole('link', { name: `Edit ${productName}` }).click()
    await waitForAppHydration(page)

    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Product updated successfully.')).toBeVisible()

    await page.goto('/creator/products')
    await waitForAppHydration(page)
    await page.getByRole('tab', { name: 'Published' }).click()
    await page.waitForSelector('tbody tr')

    const publishedRow = page.locator('tbody tr').filter({ hasText: productName })
    await expect(publishedRow.getByText('Published').first()).toBeVisible()
    await expect(publishedRow.getByRole('button', { name: /Deactivate/ })).toBeVisible()

    await publishedRow.getByRole('link', { name: `Edit ${productName}` }).click()
    await waitForAppHydration(page)

    await page.getByRole('button', { name: 'Unpublish' }).click()
    await expect(page.getByText('Product updated successfully.')).toBeVisible()

    await page.goto('/creator/products')
    await waitForAppHydration(page)
    await page.getByRole('tab', { name: 'Draft' }).click()
    await page.waitForSelector('tbody tr')

    const draftRow2 = page.locator('tbody tr').filter({ hasText: productName })
    await expect(draftRow2.getByText('Draft').first()).toBeVisible()

    await draftRow2.getByRole('link', { name: `Edit ${productName}` }).click()
    await waitForAppHydration(page)

    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Product updated successfully.')).toBeVisible()

    await page.goto('/creator/products')
    await waitForAppHydration(page)
    await page.getByRole('tab', { name: 'Published' }).click()
    await page.waitForSelector('tbody tr')

    const publishedRow2 = page.locator('tbody tr').filter({ hasText: productName })
    await expect(publishedRow2.getByText('Published').first()).toBeVisible()

    await publishedRow2.getByRole('link', { name: `Edit ${productName}` }).click()
    await waitForAppHydration(page)

    await page.getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByText('Product updated successfully.')).toBeVisible()

    await page.goto('/creator/products')
    await waitForAppHydration(page)
    await page.getByRole('tab', { name: 'Archived' }).click()
    await page.waitForSelector('tbody tr')

    const archivedRow = page.locator('tbody tr').filter({ hasText: productName })
    await expect(archivedRow.getByText('Archived').first()).toBeVisible()
  })
})
