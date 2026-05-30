import { describe, expect, it } from 'vitest'
import {
  slugify,
  suggestSlug,
  step1IdentitySchema,
  step4LocationSchema,
  step7ListingSchema,
} from './sell-onboarding'

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
