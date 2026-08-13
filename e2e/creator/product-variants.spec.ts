import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { like } from 'drizzle-orm'
import { db } from '../../src/db/index'
import { product } from '../../src/db/schema'

const E2E_PRODUCT_NAME_PREFIX = 'E2E Variants'

test.describe('creator product variants', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test.afterAll(async () => {
    await db.delete(product).where(like(product.name, `${E2E_PRODUCT_NAME_PREFIX}%`))
  })

  test('creator can manage product options and variant matrix', async ({ page }) => {
    const suffix = Date.now().toString()
    const productName = `${E2E_PRODUCT_NAME_PREFIX} ${suffix}`

    await page.goto('/creator/products/new')
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: 'New Product' })).toBeVisible()

    await page.fill('#product-name', productName)
    await page.fill('#product-price', '29.99')
    await page.fill('#product-stock', '10')

    await page.getByRole('button', { name: 'Save as draft' }).click()

    await page.waitForURL(/\/creator\/products/)
    await waitForAppHydration(page)

    const productRow = page.locator('tbody tr').filter({ hasText: productName })
    await expect(productRow.getByRole('link', { name: `Edit ${productName}` })).toBeVisible()
    await productRow.getByRole('link', { name: `Edit ${productName}` }).click()

    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible()

    const variantsHeading = page.getByRole('heading', { name: 'Variants' })
    await variantsHeading.scrollIntoViewIfNeeded()
    await expect(variantsHeading).toBeVisible()

    // Add Size option.
    await page.getByRole('button', { name: 'Add option' }).click()
    await page.fill('#new-option-name', 'Size')
    await page.fill('#new-option-values', 'S, M, L')
    await page.getByRole('button', { name: 'Add option' }).click()
    await expect(page.getByText('Option saved.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Size', { exact: true })).toBeVisible()
    await expect(page.getByText('S, M, L', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Add option' }).click()
    await page.fill('#new-option-name', 'Color')
    await page.fill('#new-option-values', 'Red, Blue')
    await page.getByRole('button', { name: 'Add option' }).click()
    await expect(page.getByText('Option saved.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Color', { exact: true })).toBeVisible()
    await expect(page.getByText('Red, Blue', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Generate missing variants' }).click()
    await expect(page.getByText('Generated 6 missing variants.')).toBeVisible({ timeout: 15000 })

    const variantRows = page.locator('tbody tr')
    const variantRow = (name: string) =>
      variantRows.filter({ has: page.locator(`input[value="${name}"]`) })

    await expect(variantRows).toHaveCount(6)
    await expect(variantRow('S / Red')).toBeVisible()
    await expect(variantRow('S / Blue')).toBeVisible()
    await expect(variantRow('M / Red')).toBeVisible()
    await expect(variantRow('M / Blue')).toBeVisible()
    await expect(variantRow('L / Red')).toBeVisible()
    await expect(variantRow('L / Blue')).toBeVisible()

    const targetRow = variantRow('S / Red')
    await targetRow.getByRole('textbox', { name: 'Price adjustment (EUR)' }).fill('2.50')
    await targetRow.getByRole('spinbutton', { name: 'Stock' }).fill('15')
    await targetRow.getByRole('button', { name: 'Save variant' }).click()
    await expect(page.getByText('Variant saved.')).toBeVisible({ timeout: 15000 })
    await expect(targetRow.getByRole('textbox', { name: 'Price adjustment (EUR)' })).toHaveValue(
      '2.50',
    )
    await expect(targetRow.getByRole('spinbutton', { name: 'Stock' })).toHaveValue('15')

    const colorOption = page.locator('li').filter({ hasText: 'Color' })
    await colorOption.getByRole('button', { name: 'Delete option' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete option' }).click()
    await expect(page.getByText('Option saved.')).toBeVisible({ timeout: 15000 })

    await expect(colorOption).not.toBeVisible()
    await expect(page.locator('li').filter({ hasText: 'Red, Blue' })).not.toBeVisible()
    await expect(
      page.locator('tbody tr').filter({ has: page.locator('input[value*="Red"]') }),
    ).toHaveCount(0)
    await expect(
      page.locator('tbody tr').filter({ has: page.locator('input[value*="Blue"]') }),
    ).toHaveCount(0)

    // Regenerate the matrix for the remaining Size option.
    await page.getByRole('button', { name: 'Generate missing variants' }).click()
    await expect(page.getByText(/Generated \d+ missing variants\.|Option saved\./)).toBeVisible({
      timeout: 15000,
    })
    await expect(variantRows).toHaveCount(3)
    await expect(variantRow('S')).toBeVisible()
    await expect(variantRow('M')).toBeVisible()
    await expect(variantRow('L')).toBeVisible()
  })
})
