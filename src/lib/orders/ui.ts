import { m } from '#/paraglide/messages'
import type { OrderStatus } from './lifecycle'

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending_payment':
      return m.orderStatus_pending_payment()
    case 'paid':
      return m.orderStatus_paid()
    case 'processing':
      return m.orderStatus_processing()
    case 'shipped':
      return m.orderStatus_shipped()
    case 'delivered':
      return m.orderStatus_delivered()
    case 'completed':
      return m.orderStatus_completed()
    case 'cancelled':
      return m.orderStatus_cancelled()
    case 'refunded':
      return m.orderStatus_refunded()
    case 'disputed':
      return m.orderStatus_disputed()
    case 'manual_review':
      return m.orderStatus_manual_review()
    case 'chargeback':
      return m.orderStatus_chargeback()
    default:
      return String(status)
  }
}

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

export const SUPPORTED_COUNTRY_CODES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'CH',
  'GB',
] as const

const SUPPORTED_COUNTRIES = new Set(SUPPORTED_COUNTRY_CODES)
type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number]

export function isSupportedShippingCountry(countryCode: string): boolean {
  return SUPPORTED_COUNTRIES.has(countryCode.toUpperCase() as SupportedCountryCode)
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
  return getOrderStatusLabel(status)
}
