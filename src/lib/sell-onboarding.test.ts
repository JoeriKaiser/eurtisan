import { describe, expect, it } from 'vitest'
import {
  SELLER_TERMS_VERSION,
  slugify,
  step1IdentitySchema,
  step4LocationSchema,
  step7ListingSchema,
  suggestSlug,
  validateOnboardingStepData,
} from './sell-onboarding'
import { validateImageUrl, validateSocialUrl } from './sell-onboarding.server'

const profile = {
  name: 'Élan Ceramics',
  slug: 'elan-ceramics',
  tagline: 'Hand-thrown tableware from Lyon',
  category: 'home_living',
  productionType: 'handmade',
  description: 'I create durable stoneware slowly and carefully in my small workshop in Lyon.',
  hasProductionPartner: false,
  productionPartnerDetails: '',
  image: 'https://example.test/shop.webp',
}

const sellerDetails = {
  shippingOrigin: {
    country: 'FR',
    city: 'Lyon',
    postalCode: '69001',
    processingTimeDays: { min: 1, max: 3 },
    shipsInternational: true,
  },
  businessAddress: {
    street: '4 Rue Mercière',
    city: 'Lyon',
    postalCode: '69001',
    country: 'FR',
  },
  currency: 'EUR',
  isVatRegistered: false,
  vatId: '',
  legalEntityType: 'individual',
  dateOfBirth: '1990-05-15',
  taxId: 'FRTIN12345',
  businessRegistrationNumber: '',
}

const listing = {
  draftId: 'shop-1',
  name: 'Speckled stoneware mug',
  slug: 'speckled-stoneware-mug',
  description: 'A tactile stoneware mug, thrown and glazed by hand for everyday use.',
  priceCents: 3600,
  stockCount: 5,
  categoryId: '11111111-1111-4111-8111-111111111111',
  vatRateCategory: 'standard',
  weightGrams: 450,
  lengthCm: 12,
  widthCm: 12,
  heightCm: 10,
  images: [{ key: 'products/mug.webp', altText: 'Speckled mug on a linen cloth' }],
}

const delivery = {
  shippingOrigin: sellerDetails.shippingOrigin,
  policies: {
    returns: { accepted: true, windowDays: 14 },
    exchanges: { accepted: true, windowDays: 14 },
    customOrders: { accepted: false },
    paymentMethods: [],
    mandatoryRightsAcknowledged: true,
  },
}

describe('shop slugs', () => {
  it('normalises names to stable URL slugs', () => {
    expect(slugify('Sunflower Ceramics')).toBe('sunflower-ceramics')
    expect(slugify('My @ Shop!')).toBe('my-shop')
    expect(slugify('a'.repeat(50))).toHaveLength(40)
  })

  it('adds a suffix for draft suggestions', () => {
    expect(suggestSlug('My Shop')).toMatch(/^my-shop-[a-z0-9]{4}$/)
  })
})

describe('five-stage onboarding schemas', () => {
  it('accepts a complete physical-goods profile with a Unicode name', () => {
    expect(step1IdentitySchema.safeParse(profile).success).toBe(true)
  })

  it('rejects removed digital-goods production types', () => {
    expect(step1IdentitySchema.safeParse({ ...profile, productionType: 'digital' }).success).toBe(
      false,
    )
  })

  it('requires a production-partner explanation when selected', () => {
    expect(
      step1IdentitySchema.safeParse({
        ...profile,
        hasProductionPartner: true,
        productionPartnerDetails: '',
      }).success,
    ).toBe(false)
  })

  it('accepts complete dispatch, legal identity, and tax details', () => {
    expect(step4LocationSchema.safeParse(sellerDetails).success).toBe(true)
  })

  it('requires a legal street address and valid processing range', () => {
    expect(
      step4LocationSchema.safeParse({
        ...sellerDetails,
        shippingOrigin: {
          ...sellerDetails.shippingOrigin,
          processingTimeDays: { min: 5, max: 2 },
        },
        businessAddress: { ...sellerDetails.businessAddress, street: '' },
      }).success,
    ).toBe(false)
  })

  it('requires business registration for registered businesses', () => {
    expect(
      step4LocationSchema.safeParse({
        ...sellerDetails,
        legalEntityType: 'business',
        dateOfBirth: '',
        businessRegistrationNumber: '',
      }).success,
    ).toBe(false)
  })

  it('accepts a sale-ready physical listing', () => {
    expect(step7ListingSchema.safeParse(listing).success).toBe(true)
  })

  it('rejects products without parcel dimensions, stock, or a photo', () => {
    expect(
      step7ListingSchema.safeParse({
        ...listing,
        stockCount: 0,
        weightGrams: 0,
        images: [],
      }).success,
    ).toBe(false)
  })

  it('rejects unsafe image object keys', () => {
    expect(
      step7ListingSchema.safeParse({
        ...listing,
        images: [{ key: 'https://evil.test/image.jpg', altText: 'Unsafe image' }],
      }).success,
    ).toBe(false)
  })

  it('requires acknowledgement that mandatory buyer rights remain applicable', () => {
    expect(() =>
      validateOnboardingStepData(4, {
        ...delivery,
        policies: { ...delivery.policies, mandatoryRightsAcknowledged: false },
      }),
    ).toThrow()
  })

  it('validates every stage in the new sequence', () => {
    expect(() => validateOnboardingStepData(1, profile)).not.toThrow()
    expect(() => validateOnboardingStepData(2, sellerDetails)).not.toThrow()
    expect(() =>
      validateOnboardingStepData(3, { productId: '22222222-2222-4222-8222-222222222222' }),
    ).not.toThrow()
    expect(() => validateOnboardingStepData(4, delivery)).not.toThrow()
    expect(() =>
      validateOnboardingStepData(5, {
        termsAgreed: true,
        termsVersion: SELLER_TERMS_VERSION,
      }),
    ).not.toThrow()
  })

  it.each([0, 6, 8])('rejects stage %s outside the five-stage contract', (stage) => {
    expect(() => validateOnboardingStepData(stage, {})).toThrow(
      `Invalid onboarding stage: ${stage}`,
    )
  })
})

describe('external URL validation', () => {
  it('allows safe image sources and rejects executable schemes', () => {
    expect(validateImageUrl('/uploads/shop.webp')).toBe('/uploads/shop.webp')
    expect(validateImageUrl('https://example.test/shop.webp')).toBe(
      'https://example.test/shop.webp',
    )
    expect(() => validateImageUrl('javascript:alert(1)')).toThrow()
    expect(() => validateImageUrl('data:text/html,unsafe')).toThrow()
  })

  it('requires full HTTP or HTTPS social URLs', () => {
    expect(validateSocialUrl('https://instagram.com/elan')).toBe('https://instagram.com/elan')
    expect(() => validateSocialUrl('@elan')).toThrow()
    expect(() => validateSocialUrl('javascript:alert(1)')).toThrow()
  })
})
