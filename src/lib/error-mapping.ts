import { m } from '#/paraglide/messages'

export function getLocalizedErrorMessage(codeOrMessage: string | null | undefined): string {
  if (!codeOrMessage) return m.error_unexpected()

  // Match by code first
  switch (codeOrMessage) {
    case 'CART_EMPTY':
      return m.error_cart_empty()
    case 'ITEMS_OUT_OF_STOCK':
      return m.error_out_of_stock()
    case 'DISPUTE_WINDOW_EXPIRED':
      return m.error_dispute_window_expired()
    case 'ACCESS_DENIED':
      return m.error_access_denied()
    case 'DISPUTE_EXISTS':
      return m.error_dispute_exists()
    case 'ORDER_NOT_DELIVERED':
      return m.error_order_not_delivered()
    case 'ORDER_DELIVERY_DATE_MISSING':
      return m.error_order_delivery_date_missing()
  }

  // Fallback / Normalized matching by English message string
  const normalized = codeOrMessage.trim().toLowerCase()
  if (normalized.includes('cart is empty')) {
    return m.error_cart_empty()
  }
  if (normalized.includes('out of stock')) {
    return m.error_out_of_stock()
  }
  if (normalized.includes('dispute window has expired')) {
    return m.error_dispute_window_expired()
  }
  if (
    normalized.includes('access denied') ||
    normalized.includes('forbidden') ||
    normalized.includes('not authorized')
  ) {
    return m.error_access_denied()
  }
  if (normalized.includes('dispute already exists')) {
    return m.error_dispute_exists()
  }
  if (normalized.includes('must be delivered before opening a dispute')) {
    return m.error_order_not_delivered()
  }
  if (normalized.includes('delivery date is missing')) {
    return m.error_order_delivery_date_missing()
  }

  // Return the original message if no map is matched
  return codeOrMessage
}
