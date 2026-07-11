import { describe, expect, it } from 'vitest'
import type { Rate, ServicePoint, ShippingProvider } from '#/integrations/shipping'
import {
  getCheckoutServicePoints,
  getSelectedShippingOption,
  getShippingOptionForVatEstimate,
  validateCheckoutShippingSelections,
  type CheckoutShippingShop,
} from './shipping.server'
import type { CheckoutItem, ShippingAddress, ShippingOption, ShippingSelection } from './types'

const standardRate: Rate = {
  rateId: 'rate-standard',
  carrier: 'sendcloud',
  serviceName: 'Sendcloud Standard',
  priceCents: 538,
  estimatedDays: { min: 2, max: 4 },
}

const shippingAddress: ShippingAddress = {
  name: 'Buyer',
  street: '1 Rue de Rivoli',
  city: 'Paris',
  postalCode: '75001',
  country: 'FR',
}

const shop: CheckoutShippingShop = {
  shopId: 'shop-1',
  items: [
    {
      productId: 'product-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1200,
      quantity: 1,
      imageUrl: null,
      weightGrams: 500,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 5,
    } satisfies CheckoutItem,
  ],
}

const selection: ShippingSelection = {
  shopId: 'shop-1',
  rateId: standardRate.rateId,
  method: 'standard',
  costCents: standardRate.priceCents,
}

function createShippingProvider(overrides: Partial<ShippingProvider> = {}): ShippingProvider {
  return {
    getRates: async () => [standardRate],
    createLabel: async () => {
      throw new Error('createLabel is not used by checkout quote validation')
    },
    trackShipment: async () => {
      throw new Error('trackShipment is not used by checkout quote validation')
    },
    getServicePoints: async () => [],
    getServicePointMethods: async () => [standardRate],
    ...overrides,
  }
}

async function expectResponse(promise: Promise<unknown>, status: number): Promise<Response> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(Response)
    const response = error as Response
    expect(response.status).toBe(status)
    return response
  }

  throw new Error(`Expected a ${status} response`)
}

describe('checkout shipping quote validation', () => {
  it('preserves distinct estimate and grand-total selection semantics', () => {
    const options: ShippingOption[] = [
      {
        rateId: 'standard-first',
        costCents: 500,
        label: standardRate.serviceName,
        method: 'standard',
      },
      {
        rateId: 'standard-last',
        costCents: 600,
        label: standardRate.serviceName,
        method: 'standard',
      },
    ]
    const methodOnlySelection: ShippingSelection = {
      shopId: 'shop-1',
      method: 'standard',
      costCents: 500,
    }

    expect(getSelectedShippingOption(options, methodOnlySelection)?.rateId).toBe('standard-first')
    expect(getShippingOptionForVatEstimate(options, methodOnlySelection)?.rateId).toBe(
      'standard-last',
    )
  })

  it('uses carrier-quoted costs rather than client totals', async () => {
    const costs = await validateCheckoutShippingSelections(
      [shop],
      shippingAddress,
      [selection],
      createShippingProvider(),
    )

    expect(costs.get('shop-1')).toBe(538)
  })

  it('delegates service-point searches to the injected provider', async () => {
    const servicePoint: ServicePoint = {
      id: 'point-1',
      name: 'Collection Point',
      street: '2 Rue de Rivoli',
      postalCode: '75001',
      city: 'Paris',
      country: 'FR',
    }

    await expect(
      getCheckoutServicePoints(
        '75001',
        'FR',
        'sendcloud',
        createShippingProvider({ getServicePoints: async () => [servicePoint] }),
      ),
    ).resolves.toEqual([servicePoint])
  })

  it('rejects an unsupported destination when the provider returns no rates', async () => {
    const response = await expectResponse(
      validateCheckoutShippingSelections(
        [shop],
        shippingAddress,
        [selection],
        createShippingProvider({ getRates: async () => [] }),
      ),
      422,
    )

    await expect(response.json()).resolves.toMatchObject({ code: 'SHIPPING_UNSUPPORTED' })
  })

  it('fails closed when live carrier rates cannot be retrieved', async () => {
    const response = await expectResponse(
      validateCheckoutShippingSelections(
        [shop],
        shippingAddress,
        [selection],
        createShippingProvider({
          getRates: async () => {
            throw new Error('carrier unavailable')
          },
        }),
      ),
      503,
    )

    await expect(response.json()).resolves.toMatchObject({ error: 'Service Unavailable' })
  })

  it('checks that a selected service-point rate is valid for that point', async () => {
    const servicePointRate: Rate = { ...standardRate, supportsServicePoint: true }
    const response = await expectResponse(
      validateCheckoutShippingSelections(
        [shop],
        {
          ...shippingAddress,
          pickupPoint: {
            id: 'point-1',
            name: 'Collection Point',
            street: '2 Rue de Rivoli',
            postalCode: '75001',
            city: 'Paris',
            country: 'FR',
          },
        },
        [selection],
        createShippingProvider({
          getRates: async () => [servicePointRate],
          getServicePointMethods: async () => [{ ...servicePointRate, rateId: 'other-rate' }],
        }),
      ),
      400,
    )

    await expect(response.json()).resolves.toMatchObject({ error: 'Bad Request' })
  })
})
