import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { product, shop, user } from '#/db/schema'
import {
  createShopDraftInternal,
  getShopDraftQuery,
  saveOnboardingStepInternal,
  submitShopForReviewInternal,
} from './sell-onboarding.server'

beforeEach(async () => {
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Seller',
      email: 'seller@example.com',
      emailVerified: true,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      status: 'draft',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
  return db
    .insert(product)
    .values({
      id: 'prod-1',
      name: 'Test Listing',
      slug: 'test-listing',
      priceCents: 1000,
      shopId: 'shop-1',
      isActive: false,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

describe('sell-onboarding.server', () => {
  describe('createShopDraftInternal', () => {
    it('creates a new draft shop for a user', async () => {
      const u = await seedUser()
      const draft = await createShopDraftInternal(u)
      expect(draft.id).toBeDefined()

      const [record] = await db.select().from(shop).where(eq(shop.id, draft.id))
      expect(record).toBeDefined()
      expect(record.ownerId).toBe(u.id)
      expect(record.status).toBe('draft')
    })
  })

  describe('saveOnboardingStepInternal and getShopDraftQuery', () => {
    it('saves and retrieves DAC7 compliance fields correctly', async () => {
      await seedUser()
      await seedShop()

      await saveOnboardingStepInternal('user-1', 'creator', {
        draftId: 'shop-1',
        step: 4,
        data: {
          shippingOrigin: {
            country: 'FR',
            processingTimeDays: { min: 1, max: 3 },
            shipsInternational: false,
          },
          currency: 'EUR',
          legalEntityType: 'individual',
          dateOfBirth: '1990-05-15',
          taxId: 'FRTIN12345',
        },
      })

      const draft = await getShopDraftQuery('shop-1', 'user-1', 'creator')
      expect(draft.legalEntityType).toBe('individual')
      expect(draft.dateOfBirth).toBe('1990-05-15')
      expect(draft.taxId).toBe('FRTIN12345')
      expect(draft.businessRegistrationNumber).toBeNull()
    })
  })

  describe('submitShopForReviewInternal', () => {
    it('throws error if taxId is missing', async () => {
      await seedUser()
      await seedShop({
        taxId: null,
      })

      await expect(submitShopForReviewInternal('user-1', 'creator', 'shop-1')).rejects.toThrowError(
        'MISSING_TAX_ID',
      )
    })

    it('throws error if DOB is missing or invalid for individual', async () => {
      await seedUser()
      await seedShop({
        taxId: 'TIN12345',
        legalEntityType: 'individual',
        dateOfBirth: null,
      })

      await expect(submitShopForReviewInternal('user-1', 'creator', 'shop-1')).rejects.toThrowError(
        'MISSING_OR_INVALID_DOB',
      )

      await db.update(shop).set({ dateOfBirth: '1990/01/01' }).where(eq(shop.id, 'shop-1'))
      await expect(submitShopForReviewInternal('user-1', 'creator', 'shop-1')).rejects.toThrowError(
        'MISSING_OR_INVALID_DOB',
      )
    })

    it('throws error if business registration number is missing for business', async () => {
      await seedUser()
      await seedShop({
        taxId: 'TIN12345',
        legalEntityType: 'business',
        businessRegistrationNumber: null,
      })

      await expect(submitShopForReviewInternal('user-1', 'creator', 'shop-1')).rejects.toThrowError(
        'MISSING_BUSINESS_REGISTRATION',
      )
    })

    it('throws error if no listings exist', async () => {
      await seedUser()
      await seedShop({
        taxId: 'TIN12345',
        legalEntityType: 'individual',
        dateOfBirth: '1990-01-01',
      })

      await expect(submitShopForReviewInternal('user-1', 'creator', 'shop-1')).rejects.toThrowError(
        'MISSING_LISTING',
      )
    })

    it('submits shop for review on successful validation', async () => {
      await seedUser()
      await seedShop({
        taxId: 'TIN12345',
        legalEntityType: 'individual',
        dateOfBirth: '1990-01-01',
      })
      await seedProduct()

      const result = await submitShopForReviewInternal('user-1', 'creator', 'shop-1')
      expect(result.success).toBe(true)

      const [record] = await db.select().from(shop).where(eq(shop.id, 'shop-1'))
      expect(record.status).toBe('pending_review')
      expect(record.submittedAt).toBeInstanceOf(Date)
    })
  })
})
