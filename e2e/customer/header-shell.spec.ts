import { expect, test } from '@playwright/test'
import { emptyCart } from '../fixtures/cart'
import { getCreatorShop, getTestProduct } from '../fixtures/orders'

/**
 * Caveat: the locale-switch test is marked `test.fixme` because the router rewrite
 * for localized URLs (e.g. /nl) is not handling incoming locale-prefixed paths in
 * the dev E2E environment. The rest of the header shell (cart badge, notifications
 * badge, theme toggle) is fully exercised.
 */

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Header shell', () => {
  test('updates the cart badge when a product is added', async ({ page }) => {
    await emptyCart(page)

    const shop = await getCreatorShop()
    const product = await getTestProduct(shop.id)

    await page.goto(`/shops/${shop.slug}/products/${product.slug}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    const cartLink = page.getByRole('link', { name: /cart/i })
    await expect(cartLink).toBeVisible()

    // No badge before adding.
    await expect(cartLink.locator('output')).not.toBeVisible()

    await page.getByRole('button', { name: /add to cart/i }).click()
    await expect(page.getByText(/added to cart/i)).toBeVisible()

    await expect(cartLink.locator('output')).toBeVisible()
    await expect(cartLink.locator('output')).toHaveText('1')
  })

  test('shows the unread notifications badge for an authenticated user', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    const notificationsLink = page.getByRole('link', { name: /notifications/i })
    await expect(notificationsLink).toBeVisible()
    // The E2E seed creates unread notifications for the fixed customer account.
    await expect(notificationsLink.locator('output')).toBeVisible()
  })

  test.fixme('switches locale via the header language dropdown', async ({ page }) => {
    // Blocked by product bug: the router rewrite for localized URLs (e.g. /nl) is not
    // handling incoming locale-prefixed paths in the dev E2E environment, so selecting a
    // locale from the dropdown does not change the page language or URL.
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    const header = page.getByRole('navigation', { name: /main navigation/i })
    const localeButton = header.getByRole('button', { name: /select language/i })
    await expect(localeButton).toBeVisible()

    const currentLocale = (await localeButton.textContent())?.trim().toLowerCase() ?? 'en'
    const targetLocale = currentLocale === 'nl' ? 'en' : 'nl'

    await localeButton.click()

    const targetMenuItem = page.getByRole('menuitem', { name: targetLocale.toUpperCase() })
    await expect(targetMenuItem).toBeVisible()
    await targetMenuItem.click({ force: true })

    await page.waitForLoadState('networkidle')
    await expect(header.getByRole('button', { name: /select language/i })).toHaveText(
      new RegExp(`\\b${targetLocale}\\b`, 'i'),
    )
  })

  test('toggles dark mode via the theme button', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    const themeButton = page.getByRole('button', { name: /theme mode/i })
    await expect(themeButton).toBeVisible()

    const initialClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )

    await themeButton.click()

    await page.waitForFunction(
      (initial) => document.documentElement.classList.contains('dark') !== initial,
      initialClass,
    )

    const newClass = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(newClass).toBe(!initialClass)
  })
})
