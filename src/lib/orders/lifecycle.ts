export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed'
  | 'manual_review'
  | 'chargeback'

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled', 'refunded'],
  paid: ['processing', 'shipped', 'refunded'],
  processing: ['shipped', 'refunded'],
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
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
