import type { CartDetail } from './cart.server'

export function getCartDistinctItemCount(cart: CartDetail | null | undefined): number {
  if (!cart) return 0
  return cart.shops.reduce((sum, shop) => sum + shop.items.length, 0)
}

export function isCartEmpty(cart: CartDetail | null | undefined): boolean {
  return getCartDistinctItemCount(cart) === 0
}
