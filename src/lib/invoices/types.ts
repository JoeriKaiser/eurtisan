export interface BillingAddress {
  name: string
  street: string
  city: string
  postalCode: string
  country: string
  vatId?: string
}

export interface BillingParty {
  name: string
  email?: string
  vatId?: string | null
  isVatRegistered?: boolean
  address: {
    street?: string
    city?: string
    postalCode?: string
    country: string
  }
}

export interface InvoiceLineItem {
  id: string
  name: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  vatRateBasisPoints: number
  vatAmountCents: number
}

export interface BillingDetails {
  from: BillingParty
  to: BillingParty
  items: InvoiceLineItem[]
  shipping?: {
    costCents: number
    vatRateBasisPoints: number
    vatAmountCents: number
    method: string
  }
  reverseCharge?: boolean
}

export interface CreatedInvoiceNumbers {
  customerInvoiceNumber: string
  platformFeeInvoiceNumber: string
}

export interface InvoiceRecord {
  id: string
  invoiceNumber: string
  type: 'platform_fee' | 'customer' | 'credit_note'
  shopOrderId: string
  createdAt: Date
  subtotalCents: number
  vatAmountCents: number
  totalCents: number
  vatRateBasisPoints: number
  billingDetails: unknown
}
