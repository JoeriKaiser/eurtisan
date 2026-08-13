import { waitForAppHydration } from './hydration'
import type { Page } from '@playwright/test'

/**
 * Add the first product from the search page to the cart.
 *
 * Product cards expose their name through the link's accessible label. Read
 * that stable contract instead of depending on the card's internal markup.
 */
export async function addFirstProductToCart(page: Page): Promise<string> {
  await page.goto('/search')
  await waitForAppHydration(page)

  const productLink = page.getByLabel(/^Product:/).first()
  await productLink.waitFor({ state: 'visible' })
  const productLabel = await productLink.getAttribute('aria-label')
  const productName = productLabel?.replace(/^Product:\s*/, '').trim()
  if (!productName) throw new Error('First product name not found on search page')

  await productLink.click()
  await page.waitForURL(/\/shops\/[^/]+\/products\/[^/]+/)

  await page.getByRole('button', { name: /add to cart/i }).click()
  await page.getByText(/added to cart/i).waitFor({ state: 'visible' })

  return productName.trim()
}

/** Remove every item from the cart, tolerating an already-empty cart. */
export async function emptyCart(page: Page): Promise<void> {
  await page.goto('/cart')
  await waitForAppHydration(page)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const removeButton = page.getByRole('button', { name: /^remove$/i }).first()
    const visible = await removeButton.isVisible().catch(() => false)
    if (!visible) break
    await removeButton.click()
    const confirmButton = page.getByRole('button', { name: /^remove$/i, exact: false }).last()
    await confirmButton.waitFor({ state: 'visible' })
    await confirmButton.click()
    await page.waitForTimeout(200)
  }
}
