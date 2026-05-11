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
