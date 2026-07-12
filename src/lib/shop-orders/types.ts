import type { ShippingAddress } from '../checkout/types'

export interface ShopOrderItemDetail {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  vatRateBasisPoints: number
  vatAmountCents: number
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
}

export interface ShopOrderBuyer {
  id: string
  name: string
  email: string
}

export interface ShippingLabelDetail {
  id: string
  carrier: string
  trackingNumber: string | null
  labelUrl: string | null
  createdAt: Date
}

export interface ShopOrderDetail {
  id: string
  platformOrderId: string
  platformOrderNumber: string
  shopId: string
  status: string
  shippingMethod: 'standard' | 'express' | 'manual'
  shippingRateId: string | null
  shippingCostCents: number
  subtotalCents: number
  vatAmountCents: number
  shippingVatRateBasisPoints: number
  shippingVatAmountCents: number
  trackingNumber: string | null
  trackingUrl: string | null
  createdAt: Date
  updatedAt: Date
  buyer: ShopOrderBuyer
  shippingAddress: ShippingAddress
  items: ShopOrderItemDetail[]
  labels: ShippingLabelDetail[]
}

export interface ShopOrderListItem {
  id: string
  platformOrderId: string
  platformOrderNumber: string
  status: string
  shippingMethod: 'standard' | 'express' | 'manual'
  shippingCostCents: number
  subtotalCents: number
  totalCents: number
  trackingNumber: string | null
  createdAt: Date
  buyerName: string
  buyerEmail: string
  itemCount: number
}
