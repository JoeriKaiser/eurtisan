import type { ReturnRequestType } from './rules'

export type ReturnRequestStatus =
  | 'requested'
  | 'authorized'
  | 'awaiting_shipment'
  | 'in_transit'
  | 'received'
  | 'refund_pending'
  | 'refunded'
  | 'rejected'
  | 'closed'

export interface ReturnRequestSummary {
  id: string
  shopOrderId: string
  buyerUserId: string
  type: ReturnRequestType
  status: ReturnRequestStatus
  reason: string
  returnShippingPayer: 'buyer' | 'seller'
  requestDeadline: Date
  returnDeadline: Date
  refundCents: number
  outboundShippingRefundCents: number
  carrier: string | null
  trackingNumber: string | null
  labelUrl: string | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    orderItemId: string
    productName: string
    quantity: number
    refundCents: number
  }>
}
