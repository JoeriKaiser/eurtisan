import { expect, type Page, test } from '@playwright/test'
import { sendMollieWebhook } from '../fixtures/orders'

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

async function fillAddress(
  page: Page,
  options: {
    prefix?: string
    country?: string
    vatId?: string
  } = {},
) {
  const prefix = options.prefix ?? ''
  const country = options.country ?? 'FR'

  const nameInput = prefix
    ? page.locator(`input[name="${prefix}.name"]`)
    : page.getByLabel(/full name/i).first()
  const streetInput = prefix
    ? page.locator(`input[name="${prefix}.street"]`)
    : page.getByLabel(/street address/i).first()
  const cityInput = prefix
    ? page.locator(`input[name="${prefix}.city"]`)
    : page.getByLabel(/city/i).first()
  const postalInput = prefix
    ? page.locator(`input[name="${prefix}.postalCode"]`)
    : page.getByLabel(/postal code/i).first()
  const countryInput = prefix
    ? page.locator(`select[name="${prefix}.country"]`)
    : page.getByLabel(/country/i).first()

  await nameInput.fill('E2E Buyer')
  await streetInput.fill('42 Avenue des Champs-Élysées')
  await cityInput.fill('Paris')
  await postalInput.fill('75008')
  await countryInput.selectOption(country)

  if (options.vatId !== undefined && prefix) {
    await page.locator(`input[name="${prefix}.vatId"]`).fill(options.vatId)
  }
}

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Checkout with VAT ID', () => {
  test('accepts a VAT ID and completes checkout', async ({ page }) => {
    await addProductToCart(page)

    await page.goto('/checkout')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByLabel(/full name/i).fill('E2E Buyer')
    await page.getByLabel(/street address/i).fill('42 Avenue des Champs-Élysées')
    await page.getByLabel(/city/i).fill('Paris')
    await page.getByLabel(/postal code/i).fill('75008')
    await page.getByLabel(/country/i).selectOption('FR')

    const shippingOption = page.getByText(/sendcloud standard/i).first()
    await expect(shippingOption).toBeVisible({ timeout: 10000 })
    await shippingOption.click()

    await page.getByRole('button', { name: /select pick-up point/i }).click()
    await expect(page.getByRole('dialog', { name: /select pick-up point/i })).toBeVisible()
    await page.getByRole('button', { name: /search/i }).click()
    const firstSelect = page.getByRole('button', { name: /^select$/i }).first()
    await expect(firstSelect).toBeVisible({ timeout: 10000 })
    await firstSelect.click()

    // VAT ID lives in the billing address section, so expand it.
    await page.getByLabel(/same as shipping/i).uncheck()
    const billingSection = page.locator('section').filter({ hasText: /billing address/i })
    await billingSection.getByLabel(/full name/i).fill('E2E Buyer')
    await billingSection.getByLabel(/street address/i).fill('42 Avenue des Champs-Élysées')
    await billingSection.getByLabel(/city/i).fill('Paris')
    await billingSection.getByLabel(/postal code/i).fill('75008')
    await billingSection.getByLabel(/country/i).selectOption('FR')

    // Use a valid-format FR VAT ID (offline validation only).
    await billingSection.locator('input[name*="vat"]').fill('FR12345678901')

    await page.getByRole('button', { name: /confirm purchase/i }).click()

    await page.waitForURL(/\/orders\/[^/]+\/success/)
    const mockPaymentId = new URL(page.url()).searchParams.get('mock_payment')
    if (!mockPaymentId) throw new Error('mock_payment query param missing')

    const response = await sendMollieWebhook(
      process.env.BASE_URL || 'http://localhost:3000',
      mockPaymentId,
      'paid',
    )
    expect(response.status).toBe(200)

    await expect(page.getByRole('heading', { name: /order placed successfully/i })).toBeVisible({
      timeout: 15000,
    })
  })

  test('rejects an invalid cross-border VAT ID', async ({ page }) => {
    await addProductToCart(page)

    await page.goto('/checkout')
    await page.waitForSelector('html[data-hydrated="true"]')

    await fillAddress(page, { prefix: 'shippingAddress' })

    const shippingOption = page.getByText(/sendcloud standard/i).first()
    await expect(shippingOption).toBeVisible({ timeout: 10000 })
    await shippingOption.click()

    await page.getByRole('button', { name: /select pick-up point/i }).click()
    await expect(page.getByRole('dialog', { name: /select pick-up point/i })).toBeVisible()
    await page.getByRole('button', { name: /search/i }).click()
    const firstSelect = page.getByRole('button', { name: /^select$/i }).first()
    await expect(firstSelect).toBeVisible({ timeout: 10000 })
    await firstSelect.click()

    await page.getByLabel(/same as shipping/i).uncheck()
    await fillAddress(page, { prefix: 'billingAddress', country: 'DE', vatId: 'DE123' })

    await page.getByRole('button', { name: /confirm purchase/i }).click()

    // Confirm the submission is rejected and the user remains on the checkout page.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/checkout/)
  })
})
