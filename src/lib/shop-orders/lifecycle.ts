import type { OrderStatus } from '../order-status'

const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled', 'refunded'],
  paid: ['processing', 'shipped', 'disputed', 'refunded'],
  processing: ['shipped', 'disputed', 'refunded'],
  shipped: ['delivered', 'disputed', 'refunded'],
  delivered: ['completed', 'disputed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  disputed: ['refunded', 'completed'],
  manual_review: ['paid', 'cancelled', 'refunded'],
  chargeback: [],
}

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function derivePlatformStatus(shopOrderStatuses: readonly OrderStatus[]): OrderStatus {
  if (shopOrderStatuses.length === 0) {
    return 'pending_payment'
  }

  if (shopOrderStatuses.includes('manual_review')) {
    return 'manual_review'
  }

  if (shopOrderStatuses.includes('disputed')) {
    return 'disputed'
  }

  if (shopOrderStatuses.includes('chargeback')) {
    return 'chargeback'
  }

  const activeStatuses = shopOrderStatuses.filter(
    (status) => status !== 'cancelled' && status !== 'refunded',
  )

  if (activeStatuses.length === 0) {
    return shopOrderStatuses.includes('refunded') ? 'refunded' : 'cancelled'
  }

  if (activeStatuses.includes('pending_payment')) {
    return 'pending_payment'
  }
  if (activeStatuses.every((status) => status === 'completed')) {
    return 'completed'
  }
  if (activeStatuses.every((status) => status === 'delivered' || status === 'completed')) {
    return 'delivered'
  }
  if (activeStatuses.every((status) => ['shipped', 'delivered', 'completed'].includes(status))) {
    return 'shipped'
  }
  if (activeStatuses.includes('processing')) {
    return 'processing'
  }
  if (
    activeStatuses.every((status) =>
      ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(status),
    )
  ) {
    return 'paid'
  }

  return 'pending_payment'
}
