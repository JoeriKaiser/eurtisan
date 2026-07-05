/**
 * Checkout test helpers.
 *
 * Known limitations / environment assumptions:
 * - `completeCheckout` targets single-shop carts and selects the first available
 *   shipping option. Multi-shop checkout will need to loop over each
 *   `shipping-shop-*` radio group.
 * - Service-point selection is environment-dependent. The helper waits for the
 *   "Select pick-up point" button and skips it if the selected shipping method
 *   does not support service points. In the current dev environment the first
 *   Sendcloud option requires a pick-up point.
 * - These helpers are additive; existing checkout specs were not refactored to
 *   use them yet.
 */

import type { Page } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'

export interface CheckoutOptions {
  shippingAddress?: {
    name?: string
    street?: string
    city?: string
    postalCode?: string
    country?: string
  }
  billingAddress?: {
    name?: string
    street?: string
    city?: string
    postalCode?: string
    country?: string
    vatId?: string | null
  } | null
  sameAsShipping?: boolean
  selectPickupPoint?: boolean
}

export interface CheckoutResult {
  platformOrderId: string
  orderNumber: string
  mockPaymentId: string
}

const DEFAULT_SHIPPING = {
  name: 'E2E Buyer',
  street: '42 Avenue des Champs-Élysées',
  city: 'Paris',
  postalCode: '75008',
  country: 'FR',
}

const DEFAULT_BILLING = {
  ...DEFAULT_SHIPPING,
  vatId: null as string | null,
}

/**
 * Fill the checkout form and confirm purchase.
 *
 * Assumptions:
 * - The user is authenticated and has items in their cart.
 * - The page has already navigated to `/checkout` and hydrated.
 * - The first available shipping option is selectable; if it supports service
 *   points, a pick-up point is selected automatically.
 */
export async function completeCheckout(
  page: Page,
  options: CheckoutOptions = {},
): Promise<CheckoutResult> {
  const shipping = { ...DEFAULT_SHIPPING, ...options.shippingAddress }

  await page.goto('/checkout')
  await page.waitForSelector('html[data-hydrated="true"]')

  // Fill shipping address using stable input names to avoid ambiguity with billing fields.
  await page.locator('input[name="shippingAddress.name"]').fill(shipping.name)
  await page.locator('input[name="shippingAddress.street"]').fill(shipping.street)
  await page.locator('input[name="shippingAddress.city"]').fill(shipping.city)
  await page.locator('input[name="shippingAddress.postalCode"]').fill(shipping.postalCode)
  await page.locator('select[name="shippingAddress.country"]').selectOption(shipping.country)

  // Wait for shipping rates to load and select the first option.
  const firstShippingLabel = page.locator('label:has(input[name^="shipping-shop-"])').first()
  await firstShippingLabel.waitFor({ state: 'visible', timeout: 10000 })
  await firstShippingLabel.click()

  // If the selected option supports service points, select the first pick-up point.
  const needsPickupPoint = options.selectPickupPoint !== false
  if (needsPickupPoint) {
    const pickupButton = page.getByRole('button', { name: /select pick-up point/i })
    try {
      await pickupButton.waitFor({ state: 'visible', timeout: 5000 })
    } catch {
      // Selected shipping method does not require a pick-up point.
    }
    if (await pickupButton.isVisible().catch(() => false)) {
      await pickupButton.click()
      await page
        .getByRole('dialog', { name: /select pick-up point/i })
        .waitFor({ state: 'visible', timeout: 10000 })
      await page.getByRole('button', { name: /search/i }).click()
      const firstSelect = page.getByRole('button', { name: /^select$/i }).first()
      await firstSelect.waitFor({ state: 'visible', timeout: 10000 })
      await firstSelect.click()
    }
  }

  // Handle billing address.
  const sameAsShipping = options.sameAsShipping ?? true
  if (!sameAsShipping) {
    await page.locator('input[name="sameAsShipping"]').uncheck()

    const billing = options.billingAddress ?? DEFAULT_BILLING
    await page.locator('input[name="billingAddress.name"]').fill(billing.name ?? '')
    await page.locator('input[name="billingAddress.street"]').fill(billing.street ?? '')
    await page.locator('input[name="billingAddress.city"]').fill(billing.city ?? '')
    await page.locator('input[name="billingAddress.postalCode"]').fill(billing.postalCode ?? '')
    await page
      .locator('select[name="billingAddress.country"]')
      .selectOption(billing.country ?? 'FR')

    if (billing.vatId) {
      await page.locator('input[name="billingAddress.vatId"]').fill(billing.vatId)
    }
  }

  // Submit and capture the mock payment id from the success URL.
  await page.getByRole('button', { name: /confirm purchase/i }).click()

  await page.waitForURL(/\/orders\/[^/]+\/success/)
  const successUrl = new URL(page.url())
  const platformOrderId = successUrl.pathname.split('/')[2]
  const mockPaymentId = successUrl.searchParams.get('mock_payment')

  if (!platformOrderId || !/^[0-9a-f-]+$/.test(platformOrderId)) {
    throw new Error(`Invalid platform order id in success URL: ${successUrl.pathname}`)
  }
  if (!mockPaymentId) {
    throw new Error('mock_payment query param missing from success URL')
  }

  const [platformOrder] = await db
    .select({ orderNumber: schema.platformOrder.orderNumber })
    .from(schema.platformOrder)
    .where(eq(schema.platformOrder.id, platformOrderId))
    .limit(1)

  if (!platformOrder) {
    throw new Error(`Platform order not found: ${platformOrderId}`)
  }

  return { platformOrderId, orderNumber: platformOrder.orderNumber, mockPaymentId }
}

/**
 * Drive checkout to the success page and return the pending order ids.
 * Useful for tests that want to control the payment webhook themselves.
 */
export async function createPendingCheckoutOrder(
  page: Page,
  options: CheckoutOptions = {},
): Promise<CheckoutResult> {
  return completeCheckout(page, options)
}
