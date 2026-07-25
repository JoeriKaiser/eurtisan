import type { ShopLegalIdentity } from '../shop-legal-identity'

/** A carrier quote presented for one shop's shipment. */
export interface ShippingOption {
  /** The rate ID from the carrier for validation in createCheckout. */
  rateId?: string
  /** Carrier identifier (for example, "dhl" or "postnl"). */
  carrier?: string
  /** Human-readable carrier service name. */
  serviceName?: string
  /** Price in euro cents (integer). */
  costCents: number
  /** Estimated delivery window in business days. */
  estimatedDays?: {
    min: number
    max: number
  }
  /** True when this option is a fallback and not from a live carrier. */
  fallback?: boolean
  /** Machine-readable error code for an unsupported destination. */
  code?: 'SHIPPING_UNSUPPORTED'
  /** Short label for display. */
  label: string
  /** Method identifier retained for backwards compatibility. */
  method: 'standard' | 'express' | 'manual'
  /** Whether this option supports service point / pick-up delivery. */
  supportsServicePoint?: boolean
}

export interface CheckoutItem {
  productId: string
  name: string
  slug: string
  priceCents: number
  quantity: number
  imageUrl: string | null
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
}

export interface CheckoutShopGroup {
  shopId: string
  shopName: string
  shopSlug: string
  items: CheckoutItem[]
  subtotalCents: number
  /** Estimated VAT in cents for display in the checkout summary. */
  vatEstimateCents: number
  shippingOptions: ShippingOption[]
  /** EU trader information for pre-contract disclosure. */
  sellerLegal: ShopLegalIdentity
}

export interface CheckoutSummary {
  cartId: string
  shops: CheckoutShopGroup[]
  grandTotalCents: number
}

export interface ShippingSelection {
  shopId: string
  /** The rate ID from the selected ShippingOption for server-side validation. */
  rateId?: string
  method: 'standard' | 'express' | 'manual'
  /** The cost in cents the user was quoted for this option. */
  costCents: number
}

export interface ShippingAddress {
  name: string
  street: string
  addressLine2?: string
  city: string
  postalCode: string
  country: string
  contactEmail?: string
  phone?: string
  vatId?: string | null
  pickupPoint?: {
    id: string
    name: string
    street: string
    postalCode: string
    city: string
    country: string
  }
}

export interface CheckoutInput {
  cartId: string
  checkoutAttemptId?: string
  shippingSelections: ShippingSelection[]
  shippingAddress: ShippingAddress
  billingAddress: ShippingAddress
}

export interface CreateCheckoutResult {
  platformOrderId: string
  /** URL the buyer must visit to complete the Mollie payment. */
  checkoutUrl: string | null
  paymentInitiationFailed?: boolean
  reservationExpiresAt: Date
}

export interface RetryPaymentResult {
  checkoutUrl: string
}
