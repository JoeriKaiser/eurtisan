import { describe, expect, it } from 'vitest'
import {
  slugify,
  step1IdentitySchema,
  step4LocationSchema,
  step7ListingSchema,
  suggestSlug,
  validateOnboardingStepData,
} from './sell-onboarding'
import { validateImageUrl, validateSocialUrl } from './sell-onboarding.server'

describe('slugify', () => {
  it('converts to lowercase and replaces spaces with hyphens', () => {
    expect(slugify('Sunflower Ceramics')).toBe('sunflower-ceramics')
  })

  it('removes special characters', () => {
    expect(slugify('My @ Shop!')).toBe('my-shop')
  })

  it('trims to max 40 chars', () => {
    const long = 'a'.repeat(50)
    expect(slugify(long).length).toBe(40)
  })
})

describe('suggestSlug', () => {
  it('returns a slug with a random suffix', () => {
    const result = suggestSlug('My Shop')
    expect(result.startsWith('my-shop-')).toBe(true)
    expect(result.length).toBeGreaterThan('my-shop-'.length)
  })
})

describe('step1IdentitySchema', () => {
  it('passes with valid data', () => {
    const result = step1IdentitySchema.safeParse({
      name: 'Valid Name',
      slug: 'valid-name',
      tagline: '',
      category: 'jewelry_accessories',
      productionType: 'handmade',
    })
    expect(result.success).toBe(true)
  })

  it('fails with short name', () => {
    const result = step1IdentitySchema.safeParse({
      name: 'AB',
      slug: 'ab',
      tagline: '',
      category: 'other',
      productionType: 'mixed',
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid slug characters', () => {
    const result = step1IdentitySchema.safeParse({
      name: 'My Shop',
      slug: 'my_shop!',
      tagline: '',
      category: 'other',
      productionType: 'mixed',
    })
    expect(result.success).toBe(false)
  })
})

describe('step4LocationSchema', () => {
  it('passes with valid shipping origin', () => {
    const result = step4LocationSchema.safeParse({
      shippingOrigin: {
        country: 'FR',
        processingTimeDays: { min: 1, max: 3 },
        shipsInternational: false,
      },
      currency: 'EUR',
    })
    expect(result.success).toBe(true)
  })

  it('fails when processing min > max', () => {
    const result = step4LocationSchema.safeParse({
      shippingOrigin: {
        country: 'FR',
        processingTimeDays: { min: 5, max: 3 },
        shipsInternational: false,
      },
      currency: 'EUR',
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid country code', () => {
    const result = step4LocationSchema.safeParse({
      shippingOrigin: {
        country: 'XX',
        processingTimeDays: { min: 1, max: 3 },
        shipsInternational: false,
      },
      currency: 'EUR',
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid currency', () => {
    const result = step4LocationSchema.safeParse({
      shippingOrigin: {
        country: 'FR',
        processingTimeDays: { min: 1, max: 3 },
        shipsInternational: false,
      },
      currency: 'LOL',
    })
    expect(result.success).toBe(false)
  })
})

describe('step7ListingSchema', () => {
  it('passes with valid price', () => {
    const result = step7ListingSchema.safeParse({
      name: 'Handmade Mug',
      description: 'A beautiful handmade ceramic mug.',
      priceCents: 1500,
      stockCount: 10,
      images: [{ key: 'products/mug-1.jpg', altText: 'Front view' }],
    })
    expect(result.success).toBe(true)
  })

  it('fails with price too high', () => {
    const result = step7ListingSchema.safeParse({
      name: 'Handmade Mug',
      description: 'A beautiful handmade ceramic mug.',
      priceCents: 1_000_000_01, // 1 cent over €1M
      stockCount: 10,
      images: [{ key: 'products/mug-1.jpg', altText: 'Front view' }],
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid image key format', () => {
    const result = step7ListingSchema.safeParse({
      name: 'Handmade Mug',
      description: 'A beautiful handmade ceramic mug.',
      priceCents: 1500,
      stockCount: 10,
      images: [{ key: 'invalid-key.gif' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('validateImageUrl', () => {
  it('returns null for null, undefined, or empty string', () => {
    expect(validateImageUrl(null)).toBeNull()
    expect(validateImageUrl(undefined)).toBeNull()
    expect(validateImageUrl('')).toBeNull()
  })

  it('accepts valid /uploads/ paths', () => {
    expect(validateImageUrl('/uploads/shop-123/logo.png')).toBe('/uploads/shop-123/logo.png')
  })

  it('accepts valid http:// URLs', () => {
    expect(validateImageUrl('http://example.com/image.jpg')).toBe('http://example.com/image.jpg')
  })

  it('accepts valid https:// URLs', () => {
    expect(validateImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg')
  })

  it('rejects javascript: URLs', () => {
    expect(() => validateImageUrl('javascript:alert(1)')).toThrow()
    try {
      validateImageUrl('javascript:alert(1)')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      expect((err as Response).status).toBe(400)
    }
  })

  it('rejects data: URLs', () => {
    expect(() => validateImageUrl('data:text/html,<script>alert(1)</script>')).toThrow()
  })

  it('rejects vbscript: URLs', () => {
    expect(() => validateImageUrl('vbscript:msgbox(1)')).toThrow()
  })

  it('rejects non-allowed relative paths', () => {
    expect(() => validateImageUrl('/images/logo.png')).toThrow()
  })
})

describe('validateSocialUrl', () => {
  it('throws for null or undefined', () => {
    expect(() => validateSocialUrl(null)).toThrow()
    expect(() => validateSocialUrl(undefined)).toThrow()
  })

  it('throws for empty string', () => {
    expect(() => validateSocialUrl('')).toThrow()
  })

  it('accepts valid https:// URLs', () => {
    expect(validateSocialUrl('https://instagram.com/myshop')).toBe('https://instagram.com/myshop')
  })

  it('accepts valid http:// URLs', () => {
    expect(validateSocialUrl('http://example.com')).toBe('http://example.com')
  })

  it('rejects javascript: URLs', () => {
    expect(() => validateSocialUrl('javascript:alert(1)')).toThrow()
    try {
      validateSocialUrl('javascript:alert(1)')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      expect((err as Response).status).toBe(400)
    }
  })

  it('rejects data: URLs', () => {
    expect(() => validateSocialUrl('data:text/html,<script>alert(1)</script>')).toThrow()
  })

  it('rejects invalid URL strings', () => {
    expect(() => validateSocialUrl('not-a-url')).toThrow()
  })
})

describe('validateOnboardingStepData', () => {
  it('accepts valid step 1 data', () => {
    expect(() =>
      validateOnboardingStepData(1, {
        name: 'Valid Name',
        slug: 'valid-name',
        tagline: '',
        category: 'jewelry_accessories',
        productionType: 'handmade',
      }),
    ).not.toThrow()
  })

  it('rejects invalid step 1 data (short name)', () => {
    expect(() =>
      validateOnboardingStepData(1, {
        name: 'AB',
        slug: 'ab',
        tagline: '',
        category: 'other',
        productionType: 'mixed',
      }),
    ).toThrow()
  })

  it('rejects invalid step 1 data (invalid slug)', () => {
    expect(() =>
      validateOnboardingStepData(1, {
        name: 'My Shop',
        slug: 'my_shop!',
        tagline: '',
        category: 'other',
        productionType: 'mixed',
      }),
    ).toThrow()
  })

  it('accepts valid step 2 data', () => {
    expect(() =>
      validateOnboardingStepData(2, {
        description: 'A'.repeat(50),
        tags: [],
        languages: [],
        hasProductionPartner: false,
      }),
    ).not.toThrow()
  })

  it('rejects invalid step 2 data (short description)', () => {
    expect(() =>
      validateOnboardingStepData(2, {
        description: 'Too short',
        tags: [],
        languages: [],
        hasProductionPartner: false,
      }),
    ).toThrow()
  })

  it('accepts valid step 3 data', () => {
    expect(() =>
      validateOnboardingStepData(3, {
        image: '',
        bannerImage: '',
      }),
    ).not.toThrow()
  })

  it('rejects invalid step 3 data (non-string image)', () => {
    expect(() =>
      validateOnboardingStepData(3, {
        image: 123,
      }),
    ).toThrow()
  })

  it('accepts valid step 4 data', () => {
    expect(() =>
      validateOnboardingStepData(4, {
        shippingOrigin: {
          country: 'FR',
          processingTimeDays: { min: 1, max: 3 },
          shipsInternational: false,
        },
        currency: 'EUR',
      }),
    ).not.toThrow()
  })

  it('rejects invalid step 4 data (invalid VAT ID)', () => {
    expect(() =>
      validateOnboardingStepData(4, {
        shippingOrigin: {
          country: 'FR',
          processingTimeDays: { min: 1, max: 3 },
          shipsInternational: false,
        },
        currency: 'EUR',
        isVatRegistered: true,
        vatId: '',
      }),
    ).toThrow()
  })

  it('accepts valid step 5 data', () => {
    expect(() =>
      validateOnboardingStepData(5, {
        policies: {
          returns: { accepted: false },
          exchanges: { accepted: false },
          customOrders: { accepted: false },
          paymentMethods: [],
        },
      }),
    ).not.toThrow()
  })

  it('rejects invalid step 5 data (bad policy shape)', () => {
    expect(() =>
      validateOnboardingStepData(5, {
        policies: {
          returns: { accepted: 'yes' },
        },
      }),
    ).toThrow()
  })

  it('accepts valid step 6 data', () => {
    expect(() =>
      validateOnboardingStepData(6, {
        socials: [{ platform: 'instagram', url: 'https://instagram.com/test' }],
      }),
    ).not.toThrow()
  })

  it('rejects invalid step 6 data (bad platform)', () => {
    expect(() =>
      validateOnboardingStepData(6, {
        socials: [{ platform: 'unknown', url: 'https://example.com' }],
      }),
    ).toThrow()
  })

  it('accepts valid step 7 data (empty)', () => {
    expect(() => validateOnboardingStepData(7, {})).not.toThrow()
  })

  it('rejects invalid step 7 data (non-empty)', () => {
    expect(() => validateOnboardingStepData(7, { name: 'Bad' })).toThrow()
  })

  it('accepts valid step 8 data', () => {
    expect(() =>
      validateOnboardingStepData(8, {
        termsAgreed: true,
      }),
    ).not.toThrow()
  })

  it('rejects invalid step 8 data (termsAgreed false)', () => {
    expect(() =>
      validateOnboardingStepData(8, {
        termsAgreed: false,
      }),
    ).toThrow()
  })

  it('rejects invalid step 8 data (missing termsAgreed)', () => {
    expect(() => validateOnboardingStepData(8, {})).toThrow()
  })

  it('rejects unknown step numbers', () => {
    expect(() => validateOnboardingStepData(9, {})).toThrow('Invalid onboarding step: 9')
  })
})
