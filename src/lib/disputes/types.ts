export interface DisputeParticipant {
  id: string
  name: string
  email: string
}

export interface DisputeMessageItem {
  id: string
  senderUserId: string
  senderName: string
  message: string
  createdAt: Date
}

export interface DisputeOrderItem {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
}

export interface DisputeOrderInfo {
  id: string
  platformOrderId: string
  platformOrderNumber: string
  shopId: string
  shopName: string
  status: string
  subtotalCents: number
  shippingCostCents: number
  totalCents: number
  createdAt: Date
  items: DisputeOrderItem[]
}

export interface DisputeDetail {
  id: string
  shopOrderId: string
  buyerUserId: string
  reason: string
  description: string
  status: string
  resolution: string | null
  refundCents: number | null
  createdAt: Date
  updatedAt: Date
  buyer: DisputeParticipant
  shop: DisputeParticipant
  order: DisputeOrderInfo
  messages: DisputeMessageItem[]
}

export interface DisputeListItem {
  id: string
  shopOrderId: string
  buyerUserId: string
  buyerName: string
  creatorName: string
  shopId: string
  shopName: string
  reason: string
  status: string
  createdAt: Date
  orderTotalCents: number
}

export interface PaginatedDisputes {
  disputes: DisputeListItem[]
  total: number
  page: number
  pageSize: number
}

export interface CreatedDispute {
  id: string
  shopOrderId: string
  buyerUserId: string
  reason: string
  description: string
  status: string
  createdAt: Date
}

export interface CreatedDisputeMessage {
  id: string
  disputeId: string
  senderUserId: string
  senderName: string
  message: string
  createdAt: Date
}

export interface ResolveDisputeInput {
  resolution: 'close' | 'partial_refund' | 'full_refund'
  refundCents?: number | null
}

export interface ResolvedDispute {
  id: string
  status: string
  resolution: string
  refundCents: number | null
  updatedAt: Date
}