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
  | 'disputed'
  | 'closed'

export type DiminishedValueCategory =
  | 'worn_washed'
  | 'scratched_damaged'
  | 'missing_packaging'
  | 'broken_seal'
  | 'structural_damage'
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
  diminishedValueCents: number
  netRefundCents: number
  diminishedValueReason: string | null
  diminishedValueCategory: DiminishedValueCategory | string | null
  diminishedValueEvidenceUrls: string[]
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
    restockItem: boolean
  }>
}
