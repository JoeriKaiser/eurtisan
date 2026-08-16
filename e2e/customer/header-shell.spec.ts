import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { E2E_CUSTOMER } from '../fixtures/auth'
import { emptyCart } from '../fixtures/cart'
import { waitForAppHydration } from '../fixtures/hydration'
import { getCreatorShop, getTestProduct } from '../fixtures/orders'
import { expect, test } from '@playwright/test'

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
    await waitForAppHydration(page)

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
    const [customer] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, E2E_CUSTOMER.email))
      .limit(1)
    if (customer) {
      await db.insert(schema.notification).values({
        id: randomUUID(),
        userId: customer.id,
        type: 'order_placed',
        data: { orderNumber: 'ORD-TEST123', orderId: randomUUID() },
      })
    }

    await page.goto('/')
    await waitForAppHydration(page)

    const notificationsLink = page.getByRole('link', { name: /notifications/i })
    await expect(notificationsLink).toBeVisible()
    await expect(notificationsLink.locator('output')).toBeVisible()
  })

  test('switches locale via the header language dropdown', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    const header = page.locator('header')
    const localeButton = header.getByRole('button', { name: /language|taal/i })
    await expect(localeButton).toBeVisible()

    const currentLocale = (await localeButton.textContent())?.trim().toLowerCase() ?? 'en'
    const targetLocale = currentLocale === 'nl' ? 'en' : 'nl'

    await localeButton.click()

    const targetMenuItem = page.getByRole('menuitem', {
      name: targetLocale === 'nl' ? /nederlands/i : /english/i,
    })
    await expect(targetMenuItem).toBeVisible()
    await targetMenuItem.click({ force: true })

    await page.waitForLoadState('networkidle')
    await expect(header.getByRole('button', { name: /language|taal/i })).toHaveText(
      new RegExp(`\\b${targetLocale}\\b`, 'i'),
    )
  })

  test('toggles dark mode via the theme button', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

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
