import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { shop as shopTable, shopSocials } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createProduct, createReview, createShop, createUser } from '#/test/factories'
import { createPaidOrder } from '#/test/scenarios'
import { encryptJsonb } from '../infra/encryption.server'
import { getShopProfileCompletenessSamples, getShopProfileQuery } from './public-profile.server'

/**
 * Every key a buyer may receive. This list is the publishing decision.
 *
 * If a change to `publicShopColumns` or the returned object widens the payload,
 * this test fails — which is the point. Do not update it to make a failure go
 * away without deciding, deliberately, that the new field is publishable.
 */
const EXPECTED_PROFILE_KEYS = [
  'announcement',
  'bannerImage',
  'category',
  'createdAt',
  'description',
  'hasProductionPartner',
  'id',
  'image',
  'isVatRegistered',
  'languages',
  'name',
  'origin',
  'policies',
  'productCount',
  'productionPartnerDetails',
  'productionType',
  'rating',
  'slug',
  'socials',
  'tagline',
  'tags',
].sort()

const VALID_ORIGIN = {
  country: 'FR',
  state: 'Occitanie',
  city: 'Toulouse',
  postalCode: '31200',
  processingTimeDays: { min: 2, max: 5 },
  shipsInternational: true,
}

const VALID_POLICIES = {
  returns: { accepted: true, windowDays: 14, conditions: 'Unused items only' },
  exchanges: { accepted: false },
  customOrders: { accepted: true, details: 'Ask for a quote' },
  paymentMethods: ['ideal', 'card'],
  additionalInfo: 'Ships from Toulouse',
  mandatoryRightsAcknowledged: true,
}

async function createPublishedShop(overrides?: Record<string, unknown>) {
  const owner = await createUser({ role: 'creator' })
  return createShop(owner, {
    slug: 'atelier-test',
    name: 'Atelier Test',
    status: 'active',
    ...overrides,
  })
}

describe('getShopProfileQuery', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  describe('visibility guard', () => {
    it('returns null for an unknown slug', async () => {
      expect(await getShopProfileQuery('no-such-shop')).toBeNull()
    })

    it('returns null for a suspended shop', async () => {
      await createPublishedShop({ isSuspended: true })
      expect(await getShopProfileQuery('atelier-test')).toBeNull()
    })

    it('returns null for a shop that is not active', async () => {
      await createPublishedShop({ status: 'draft' })
      expect(await getShopProfileQuery('atelier-test')).toBeNull()
    })
  })

  describe('projection allowlist', () => {
    it('returns exactly the publishable keys and no others', async () => {
      await createPublishedShop()

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile).not.toBeNull()
      expect(Object.keys(profile as object).sort()).toEqual(EXPECTED_PROFILE_KEYS)
    })

    it('never leaks tax identity, payment credentials, moderation state, or ownership', async () => {
      const owner = await createUser({ role: 'creator' })
      await createShop(owner, {
        slug: 'atelier-test',
        status: 'active',
        vatId: 'FR86123456789',
        taxId: 'TAX-123',
        dateOfBirth: '1990-01-01',
        businessRegistrationNumber: 'RCS-999',
        legalEntityType: 'business',
        businessAddress: encryptJsonb({ street: 'X', city: 'Y', postalCode: 'Z', country: 'FR' }),
        mollieAccountId: 'org_123',
        mollieAccessToken: 'access_secret',
        mollieRefreshToken: 'refresh_secret',
        moderationNote: 'internal note',
        isSuspended: false,
      })

      const profile = await getShopProfileQuery('atelier-test')
      const serialized = JSON.stringify(profile)

      for (const forbidden of [
        'vatId',
        'taxId',
        'dateOfBirth',
        'businessRegistrationNumber',
        'legalEntityType',
        'businessAddress',
        'mollieAccountId',
        'mollieAccessToken',
        'mollieRefreshToken',
        'moderationNote',
        'ownerId',
        'isSuspended',
        'status',
      ]) {
        expect(profile).not.toHaveProperty(forbidden)
      }

      // Values, not just key names — a rename must not smuggle a secret through.
      for (const secret of [
        'access_secret',
        'refresh_secret',
        'RCS-999',
        'internal note',
        owner.id,
      ]) {
        expect(serialized).not.toContain(secret)
      }
    })
  })

  describe('shipping origin', () => {
    it('decrypts the stored value and publishes only country, processing time, and reach', async () => {
      await createPublishedShop({ shippingOrigin: encryptJsonb(VALID_ORIGIN) })

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.origin).toEqual({
        country: 'FR',
        processingTimeDays: { min: 2, max: 5 },
        shipsInternational: true,
      })
    })

    it('never publishes the street-level fields', async () => {
      await createPublishedShop({ shippingOrigin: encryptJsonb(VALID_ORIGIN) })

      const serialized = JSON.stringify(await getShopProfileQuery('atelier-test'))

      expect(serialized).not.toContain('Toulouse')
      expect(serialized).not.toContain('31200')
      expect(serialized).not.toContain('Occitanie')
    })

    it('reads legacy plaintext rows, which decryptJsonb passes through', async () => {
      // Written past the factory on purpose. `createShop` now encrypts plain
      // objects, matching production, so passing one here would quietly make
      // this an encrypted-row test and leave the legacy branch uncovered.
      const created = await createPublishedShop()
      await db
        .update(shopTable)
        .set({ shippingOrigin: VALID_ORIGIN })
        .where(eq(shopTable.id, created.id))

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.origin?.country).toBe('FR')
    })

    it('returns a null origin when the stored value is malformed', async () => {
      await createPublishedShop({ shippingOrigin: encryptJsonb({ country: 'FRANCE' }) })

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.origin).toBeNull()
    })

    it('keeps the country when a settings edit dropped the dispatch fields', async () => {
      // Exactly what `shop-settings.ts` stores: its schema has no
      // `processingTimeDays` or `shipsInternational`, and the write replaces the
      // whole object. Requiring them here would blank the origin entirely for
      // any seller who has ever edited their dispatch address.
      await createPublishedShop({
        shippingOrigin: encryptJsonb({
          street: 'Rue des Tourneurs 4',
          city: 'Toulouse',
          postalCode: '31200',
          country: 'FR',
        }),
      })

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.origin).toEqual({ country: 'FR' })
      expect(JSON.stringify(profile)).not.toContain('31200')
    })

    it('returns a null origin when absent', async () => {
      await createPublishedShop()

      expect((await getShopProfileQuery('atelier-test'))?.origin).toBeNull()
    })
  })

  describe('policies', () => {
    it('publishes the policy summary without seller-declared payment methods', async () => {
      await createPublishedShop({ policies: VALID_POLICIES })

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.policies).not.toBeNull()
      expect(profile?.policies).not.toHaveProperty('paymentMethods')
      expect(profile?.policies?.returns.accepted).toBe(true)
      expect(profile?.policies?.mandatoryRightsAcknowledged).toBe(true)
    })

    it('returns null policies rather than throwing when the stored value is malformed', async () => {
      await createPublishedShop({ policies: { returns: 'yes please' } })

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.policies).toBeNull()
    })
  })

  describe('socials', () => {
    it('publishes valid links ordered deterministically by platform', async () => {
      const shopRow = await createPublishedShop()
      await db.insert(shopSocials).values([
        { id: 'soc-2', shopId: shopRow.id, platform: 'website', url: 'https://atelier.example' },
        { id: 'soc-1', shopId: shopRow.id, platform: 'instagram', url: 'https://insta.example/a' },
      ])

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.socials.map((s) => s.platform)).toEqual(['instagram', 'website'])
    })

    it('drops a javascript: link instead of publishing it', async () => {
      const shopRow = await createPublishedShop()
      await db.insert(shopSocials).values([
        { id: 'soc-x', shopId: shopRow.id, platform: 'website', url: 'javascript:alert(1)' },
        { id: 'soc-y', shopId: shopRow.id, platform: 'instagram', url: 'https://insta.example/a' },
      ])

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.socials).toHaveLength(1)
      expect(profile?.socials[0].platform).toBe('instagram')
    })
  })

  describe('aggregates', () => {
    it('counts only published, active products', async () => {
      const shopRow = await createPublishedShop()
      await createProduct(shopRow, { status: 'published', isActive: true })
      await createProduct(shopRow, { status: 'published', isActive: false })
      await createProduct(shopRow, { status: 'draft', isActive: true })

      expect((await getShopProfileQuery('atelier-test'))?.productCount).toBe(1)
    })

    it('withholds the rating below the review threshold', async () => {
      const shopRow = await createPublishedShop()
      const { product, shopOrder, buyer } = await createPaidOrder({ shop: shopRow })
      await createReview(shopOrder, product, buyer, { rating: 5 })

      expect((await getShopProfileQuery('atelier-test'))?.rating).toBeNull()
    })

    it('averages across the shop once the threshold is met, excluding hidden reviews', async () => {
      const shopRow = await createPublishedShop()

      for (const rating of [5, 4, 3]) {
        const { product, shopOrder, buyer } = await createPaidOrder({ shop: shopRow })
        await createReview(shopOrder, product, buyer, { rating })
      }

      const hidden = await createPaidOrder({ shop: shopRow })
      await createReview(hidden.shopOrder, hidden.product, hidden.buyer, {
        rating: 1,
        moderationStatus: 'hidden',
      })

      const profile = await getShopProfileQuery('atelier-test')

      expect(profile?.rating).toEqual({ reviewCount: 3, ratingAverage: 4 })
    })
  })

  describe('completeness sampling', () => {
    it('scores a bare shop low and a filled-in one high', async () => {
      const bare = await createUser({ role: 'creator' })
      await createShop(bare, { slug: 'bare-shop', name: 'Bare Shop', status: 'active' })

      const rich = await createUser({ role: 'creator' })
      const richShop = await createShop(rich, {
        slug: 'rich-shop',
        name: 'Rich Shop',
        status: 'active',
        tagline: 'A tagline',
        description: 'A description',
        category: 'ceramics',
        tags: ['handmade'],
        image: 'shops/avatar.jpg',
        bannerImage: 'shops/banner.jpg',
        announcement: 'An announcement',
        productionType: 'handmade',
        languages: ['en'],
        policies: { returns: { accepted: true } },
        shippingOrigin: { country: 'FR' },
      })
      await db.insert(shopSocials).values({
        id: randomUUID(),
        shopId: richShop.id,
        platform: 'instagram',
        url: 'https://instagram.com/rich',
      })

      const samples = await getShopProfileCompletenessSamples()

      expect(samples).toHaveLength(2)
      expect(Math.min(...samples)).toBe(0)
      expect(Math.max(...samples)).toBe(1)
    })

    it('ignores shops that are not publicly visible', async () => {
      const owner = await createUser({ role: 'creator' })
      await createShop(owner, { slug: 'draft-shop', status: 'draft' })
      await createShop(owner, { slug: 'suspended-shop', status: 'active', isSuspended: true })

      expect(await getShopProfileCompletenessSamples()).toEqual([])
    })

    it('counts an encrypted origin as present without decrypting it', async () => {
      const owner = await createUser({ role: 'creator' })
      await createShop(owner, {
        slug: 'origin-shop',
        status: 'active',
        shippingOrigin: { country: 'FR' },
      })

      // One of twelve scored fields.
      expect(await getShopProfileCompletenessSamples()).toEqual([1 / 12])
    })
  })
})
