import { expect, type Page, test } from '@playwright/test'

async function addProductToCart(page: Page) {
  await page.goto('/search')
  await page.waitForSelector('html[data-hydrated="true"]')

  const productLink = page.getByLabel(/^Product:/).first()
  await expect(productLink).toBeVisible()
  await productLink.click()

  await page.waitForURL(/\/shops\/[^/]+\/products\/[^/]+/)
  await page.getByRole('button', { name: /add to cart/i }).click()
  await expect(page.getByText(/added to cart/i)).toBeVisible()
}

async function fillShippingAddress(page: Page) {
  await page.getByLabel(/full name/i).fill('E2E Buyer')
  await page.getByLabel(/street address/i).fill('42 Avenue des Champs-Élysées')
  await page.getByLabel(/city/i).fill('Paris')
  await page.getByLabel(/postal code/i).fill('75008')
  await page.getByLabel(/country/i).selectOption('FR')
}

/**
 * Caveat: the checkout order-summary shipping line does not react to shipping-method
 * selection in the UI. This spec therefore asserts the selection controls only, not the
 * summary line. See the coverage plan for the open product bug.
 */

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Checkout shipping method selection', () => {
  test('lists multiple shipping options and updates the order summary when selected', async ({
    page,
  }) => {
    await addProductToCart(page)

    await page.goto('/checkout')
    await page.waitForSelector('html[data-hydrated="true"]')

    await fillShippingAddress(page)

    // Wait for rates to load.
    const standardRadio = page.getByRole('radio', { name: /sendcloud standard/i })
    const expressRadio = page.getByRole('radio', { name: /sendcloud express/i })
    await expect(standardRadio).toBeVisible({ timeout: 10000 })
    await expect(expressRadio).toBeVisible({ timeout: 10000 })

    // Default selection is Standard.
    await expect(standardRadio).toBeChecked()

    // Select Express and assert it becomes the active selection.
    await expressRadio.check()
    await expect(expressRadio).toBeChecked()
    await expect(standardRadio).not.toBeChecked()
    await expect(page.getByRole('radio', { name: /sendcloud express/i })).toBeChecked()
  })
})
