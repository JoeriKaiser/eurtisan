import type { platformOrder, shop, shopOrder, user } from '#/db/schema'

/**
 * Minimal user shape accepted by factories that need an owner or buyer.
 */
export type UserLike = Pick<typeof user.$inferSelect, 'id'>

/**
 * Minimal shop shape accepted by factories that need a shop.
 */
export type ShopLike = Pick<typeof shop.$inferSelect, 'id'>

/**
 * Minimal platform order shape accepted by factories that need an order.
 */
export type PlatformOrderLike = Pick<typeof platformOrder.$inferSelect, 'id'>

/**
 * Minimal shop order shape accepted by factories that need a shop order.
 */
export type ShopOrderLike = Pick<typeof shopOrder.$inferSelect, 'id'>

/**
 * Build a minimal shipping/billing address payload.
 */
export function makeTestAddress(overrides?: {
  name?: string
  street?: string
  city?: string
  postalCode?: string
  country?: string
}): Record<string, unknown> {
  return {
    name: overrides?.name ?? 'Test Buyer',
    street: overrides?.street ?? '123 Main St',
    city: overrides?.city ?? 'Berlin',
    postalCode: overrides?.postalCode ?? '10115',
    country: overrides?.country ?? 'DE',
  }
}
