import type { PayoutStatus } from './lifecycle'

/**
 * A derived payout line item computed from a shop_order record.
 * Represents a single earning (or negative adjustment) for the creator.
 */
export interface CreatorPayoutLine {
  orderId: string
  date: Date
  amountCents: number
  /** Payout lifecycle status as tracked in the database. */
  status: PayoutStatus
  /** Original shop_order status, exposed so the UI can differentiate refunds. */
  orderStatus: string
  /** True when this line represents a refund deduction. */
  isRefund: boolean
  /** Customer invoice number for this shop order, if invoices have been generated. */
  customerInvoiceNumber: string | null
  /** Platform fee invoice number for this shop order, if invoices have been generated. */
  platformFeeInvoiceNumber: string | null
}

export interface PayoutReversalOptions {
  reverseRouting?: boolean
  routingReversals?: { organizationId: string; amountCents: number }[]
}

export interface ExecutePayoutResult {
  success: boolean
  routeId?: string
}

/**
 * A payout record enriched with creator and shop details for the admin oversight view.
 */
export interface AdminPayoutRow {
  payoutId: string
  amountCents: number
  status: CreatorPayoutLine['status']
  sentAt: Date | null
  createdAt: Date
  shopName: string
  shopId: string
  creatorName: string
  creatorId: string
  failureReason: string | null
}
