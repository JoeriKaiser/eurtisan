import { describe, expect, it } from 'vitest'
import {
  buildShopLegalIdentity,
  formatPostalAddress,
  resolveShopAddress,
} from './shop-legal-identity'

describe('resolveShopAddress', () => {
  it('prefers business address over shipping origin', () => {
    const result = resolveShopAddress(
      { street: '1 Rue Commerce', city: 'Lyon', country: 'FR' },
      { street: '2 Rue Expédition', city: 'Paris', country: 'FR' },
    )
    expect(result?.street).toBe('1 Rue Commerce')
  })

  it('falls back to shipping origin when business address is empty', () => {
    const result = resolveShopAddress(null, { city: 'Paris', country: 'FR' })
    expect(result?.city).toBe('Paris')
  })
})

describe('formatPostalAddress', () => {
  it('joins address parts', () => {
    expect(
      formatPostalAddress({
        street: '10 Rue Example',
        postalCode: '75001',
        city: 'Paris',
        country: 'FR',
      }),
    ).toBe('10 Rue Example, 75001 Paris, FR')
  })

  it('returns null when no usable parts', () => {
    expect(formatPostalAddress({})).toBeNull()
  })
})

describe('buildShopLegalIdentity', () => {
  it('builds identity from shop and owner', () => {
    const identity = buildShopLegalIdentity({
      shopName: 'Atelier Demo',
      ownerEmail: 'seller@example.com',
      vatId: 'FR123',
      businessAddress: { street: '1 Rue', city: 'Lyon', country: 'FR' },
      shippingOrigin: null,
      traderStatus: 'trader',
    })
    expect(identity.tradeName).toBe('Atelier Demo')
    expect(identity.contactEmail).toBe('seller@example.com')
    expect(identity.vatId).toBe('FR123')
    expect(identity.traderStatus).toBe('trader')
  })
})
