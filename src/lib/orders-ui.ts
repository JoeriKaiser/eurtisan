import type { OrderStatus } from './orders.server'

export function statusBadgeVariant(status: OrderStatus) {
  switch (status) {
    case 'pending_payment':
      return 'warning'
    case 'paid':
    case 'processing':
      return 'primary'
    case 'shipped':
    case 'delivered':
    case 'completed':
      return 'success'
    case 'cancelled':
    case 'refunded':
    case 'disputed':
      return 'error'
    default:
      return 'default'
  }
}

/* -------------------------------------------------------------------------- */
/*                            Supported Countries                             */
/* -------------------------------------------------------------------------- */

const SUPPORTED_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
  'CH', 'GB',
])

export function isSupportedShippingCountry(countryCode: string): boolean {
  return SUPPORTED_COUNTRIES.has(countryCode.toUpperCase())
}

/* -------------------------------------------------------------------------- */
/*                             Status Timeline                                */
/* -------------------------------------------------------------------------- */

export const FULFILLMENT_STATUSES: OrderStatus[] = ['paid', 'processing', 'shipped', 'delivered']

export function statusTimelineIndex(status: OrderStatus): number {
  const idx = FULFILLMENT_STATUSES.indexOf(status)
  return idx === -1 ? FULFILLMENT_STATUSES.length : idx
}

export function isStatusReached(current: OrderStatus, step: OrderStatus): boolean {
  return statusTimelineIndex(current) >= statusTimelineIndex(step)
}

export function statusTimelineLabel(status: OrderStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'processing':
      return 'Processing'
    case 'shipped':
      return 'Shipped'
    case 'delivered':
      return 'Delivered'
    default:
      return status.replace('_', ' ')
  }
}
