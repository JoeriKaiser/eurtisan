import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { shop, user } from '#/db/schema'
import {
  slugify,
  suggestSlug,
  step1IdentitySchema,
  step4LocationSchema,
  step7ListingSchema,
  saveShopImage,
} from './sell-onboarding'
import { saveShopImageInternal } from './sell-onboarding.server'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'

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
      images: [
        {
          dataUrl:
            'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('fails with price too high', () => {
    const result = step7ListingSchema.safeParse({
      name: 'Handmade Mug',
      description: 'A beautiful handmade ceramic mug.',
      priceCents: 1_000_000_01, // 1 cent over €1M
      stockCount: 10,
      images: [
        {
          dataUrl:
            'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('saveShopImageInternal', () => {
  const mockUserId = 'user-test-onboarding'
  const mockShopId = 'shop-test-onboarding'
  const validDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' // 1x1 transparent PNG

  beforeEach(async () => {
    await db.delete(shop)
    await db.delete(user)
  })

  afterEach(async () => {
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'shops', mockShopId)
    await rm(uploadDir, { recursive: true, force: true })
  })

  it('throws FORBIDDEN if user is authenticated but does not own the shop draft', async () => {
    await db
      .insert(user)
      .values({ id: 'user-other', name: 'Other', email: 'other@example.com', emailVerified: true })
    await db
      .insert(shop)
      .values({ id: mockShopId, name: 'Other Shop', slug: 'other-shop', ownerId: 'user-other' })

    await expect(
      saveShopImageInternal(mockUserId, 'creator', mockShopId, validDataUrl),
    ).rejects.toThrow('FORBIDDEN')
  })

  it('rejects file too large or incorrect magic bytes', async () => {
    await db
      .insert(user)
      .values({ id: mockUserId, name: 'Tester', email: 'tester@example.com', emailVerified: true })
    await db
      .insert(shop)
      .values({ id: mockShopId, name: 'Tester Shop', slug: 'tester-shop', ownerId: mockUserId })

    const invalidDataUrl = 'data:image/jpeg;base64,dGhpcyBpcyBub3QgYW4gaW1hZ2U=' // "this is not an image"

    await expect(
      saveShopImageInternal(mockUserId, 'creator', mockShopId, invalidDataUrl),
    ).rejects.toThrow('File content does not match declared type')
  })

  it('successfully saves shop image when all checks pass', async () => {
    await db
      .insert(user)
      .values({ id: mockUserId, name: 'Tester', email: 'tester@example.com', emailVerified: true })
    await db
      .insert(shop)
      .values({ id: mockShopId, name: 'Tester Shop', slug: 'tester-shop', ownerId: mockUserId })

    const resultUrl = await saveShopImageInternal(mockUserId, 'creator', mockShopId, validDataUrl)
    expect(resultUrl.startsWith(`/uploads/shops/${mockShopId}/`)).toBe(true)
    expect(resultUrl.endsWith('.png')).toBe(true)
  })

  it('rejects path traversal or unsafe characters in draftId via validator', async () => {
    await expect(
      saveShopImage({ data: { draftId: '../escape-path', dataUrl: validDataUrl } }),
    ).rejects.toThrow()
  })
})
