import type { CheckoutSummary } from '#/lib/checkout.server'

export const defaultSellerLegal = {
  tradeName: 'Test Shop',
  contactEmail: 'seller@example.com',
  vatId: null,
  address: { street: '1 Rue Test', city: 'Paris', postalCode: '75001', country: 'FR' },
  traderStatus: 'trader',
} as const

export function makeSummary(overrides?: Partial<CheckoutSummary>) {
  return {
    cartId: 'cart-1',
    shops: [
      {
        shopId: 'shop-1',
        shopName: 'Test Shop',
        shopSlug: 'test-shop',
        items: [
          {
            productId: 'prod-1',
            name: 'Vase',
            slug: 'vase',
            priceCents: 1000,
            quantity: 2,
            imageUrl: 'http://example.com/vase.jpg',
            weightGrams: null,
            volumeMl: null,
            soldBy: null,
            lengthCm: null,
            widthCm: null,
            heightCm: null,
          },
        ],
        subtotalCents: 2000,
        vatEstimateCents: 0,
        sellerLegal: defaultSellerLegal,
        shippingOptions: [
          {
            method: 'standard' as const,
            costCents: 500,
            label: 'Standard',
            rateId: 'rate-std-1',
            carrier: 'dhl',
            serviceName: 'DHL Standard',
            estimatedDays: { min: 2, max: 4 },
            fallback: false,
          },
          {
            method: 'express' as const,
            costCents: 1000,
            label: 'Express',
            rateId: 'rate-xpr-1',
            carrier: 'dhl',
            serviceName: 'DHL Express',
            estimatedDays: { min: 1, max: 1 },
            fallback: false,
          },
        ],
      },
    ],
    grandTotalCents: 2500,
    ...overrides,
  }
}

export function makeServicePointSummary(overrides?: Partial<CheckoutSummary>) {
  return {
    ...makeSummary(),
    shops: [
      {
        ...makeSummary().shops[0],
        shippingOptions: [
          {
            method: 'standard' as const,
            costCents: 500,
            label: 'Standard',
            rateId: 'sendcloud_std_test_001',
            carrier: 'sendcloud',
            serviceName: 'Sendcloud Standard',
            estimatedDays: { min: 2, max: 4 },
            fallback: false,
            supportsServicePoint: true,
          },
          {
            method: 'express' as const,
            costCents: 1000,
            label: 'Express',
            rateId: 'sendcloud_xpr_test_001',
            carrier: 'sendcloud',
            serviceName: 'Sendcloud Express',
            estimatedDays: { min: 1, max: 1 },
            fallback: false,
          },
        ],
      },
    ],
    ...overrides,
  }
}
