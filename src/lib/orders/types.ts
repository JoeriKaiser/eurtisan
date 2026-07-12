import type { ShippingAddress } from '../checkout.server'
import type { OrderStatus } from './lifecycle'

export interface OrderItemDetail {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  vatRateBasisPoints: number
  vatAmountCents: number
  imageUrl?: string | null
}

export interface ShippingLabelInfo {
  carrier: string
  trackingNumber: string | null
  labelUrl: string | null
  createdAt: Date
}

export interface OrderShopGroup {
  shopOrderId: string
  shopId: string
  shopName: string
  shippingMethod: 'standard' | 'express' | 'manual'
  shippingRateId: string | null
  shippingCostCents: number
  subtotalCents: number
  vatAmountCents: number
  shippingVatRateBasisPoints: number
  shippingVatAmountCents: number
  status: OrderStatus
  trackingNumber: string | null
  trackingUrl: string | null
  deliveredAt: Date | null
  shippingLabels: ShippingLabelInfo[]
  trackingStatus: string | null
  items: OrderItemDetail[]
  invoiceNumber: string | null
  disputeId: string | null
}

export interface OrderDetail {
  id: string
  orderNumber: string
  totalCents: number
  status: OrderStatus
  createdAt: Date
  cancelledAt: Date | null
  cancellationReason: string | null
  shippingAddress: ShippingAddress
  shops: OrderShopGroup[]
}

export interface BuyerOrderShopSummary {
  shopId: string
  shopName: string
  status: OrderStatus
}

export interface BuyerOrderListItem {
  id: string
  orderNumber: string
  totalCents: number
  status: OrderStatus
  createdAt: Date
  shopCount: number
  shopSummary: BuyerOrderShopSummary[]
}
