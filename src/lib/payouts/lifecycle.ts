export type PayoutStatus = 'pending' | 'in_transit' | 'sent' | 'failed' | 'reversed' | 'returned'

const VALID_PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ['in_transit', 'failed'],
  failed: ['in_transit', 'failed'],
  in_transit: ['sent', 'failed', 'reversed', 'returned'],
  sent: ['reversed', 'returned'],
  reversed: [],
  returned: [],
}

export function isValidPayoutTransition(from: PayoutStatus, to: PayoutStatus): boolean {
  return VALID_PAYOUT_TRANSITIONS[from]?.includes(to) ?? false
}

export class PayoutError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'PayoutError'
  }
}
