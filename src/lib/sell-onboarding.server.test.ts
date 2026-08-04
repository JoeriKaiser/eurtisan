import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { categories, product, productImage, shop, user } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { SELLER_TERMS_VERSION } from './sell-onboarding'
import {
  createShopDraftInternal,
  deleteShopDraftInternal,
  getOnboardingListingInternal,
  getOnboardingReadinessInternal,
  getShopDraftQuery,
  saveDraftListingInternal,
  saveOnboardingStepInternal,
  submitShopForReviewInternal,
} from './sell-onboarding.server'

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(async () => {
  await clearTestTables()
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Seller',
      email: 'seller@example.com',
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedCategory() {
  await db.insert(categories).values({
    id: CATEGORY_ID,
    name: 'Ceramics',
    slug: 'ceramics',
  })
}

const completePolicies = {
  returns: { accepted: true, windowDays: 14 },
  exchanges: { accepted: true, windowDays: 14 },
  customOrders: { accepted: false },
  paymentMethods: [],
  mandatoryRightsAcknowledged: true,
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Atelier',
      slug: 'test-atelier',
      ownerId: 'user-1',
      status: 'draft',
      category: 'home_living',
      productionType: 'handmade',
      description: 'A detailed shop story about careful European ceramic craft and materials.',
      image: 'https://example.test/shop.webp',
      shippingOrigin: {
        country: 'FR',
        city: 'Paris',
        postalCode: '75001',
        processingTimeDays: { min: 1, max: 3 },
        shipsInternational: true,
      },
      businessAddress: {
        street: '12 Rue des Artisans',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
      legalEntityType: 'individual',
      traderStatus: 'trader',
      dateOfBirth: '1990-05-15',
      taxId: 'FRTIN12345',
      policies: completePolicies,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedCompleteProduct() {
  const productId = '22222222-2222-4222-8222-222222222222'
  await db.insert(product).values({
    id: productId,
    name: 'Ceramic serving bowl',
    slug: 'ceramic-serving-bowl',
    description: 'A hand-thrown serving bowl made from durable speckled stoneware.',
    priceCents: 4800,
    stockCount: 3,
    shopId: 'shop-1',
    categoryId: CATEGORY_ID,
    isActive: false,
    status: 'draft',
    vatRateCategory: 'standard',
    weightGrams: 900,
    lengthCm: 24,
    widthCm: 24,
    heightCm: 10,
  })
  await db.insert(productImage).values({
    id: 'image-1',
    productId,
    url: 'products/bowl.webp',
    sortOrder: 0,
  })
  await db.update(shop).set({ onboardingListingId: productId }).where(eq(shop.id, 'shop-1'))
  return productId
}

async function seedForeignProduct() {
  const foreignProductId = '33333333-3333-4333-8333-333333333333'
  await seedUser({ id: 'user-2', email: 'other@example.com' })
  await seedShop({
    id: 'shop-2',
    ownerId: 'user-2',
    name: 'Other Atelier',
    slug: 'other-atelier',
  })
  await db.insert(product).values({
    id: foreignProductId,
    name: 'Other seller product',
    slug: 'other-seller-product',
    description: 'A product that belongs exclusively to a different seller shop.',
    priceCents: 2500,
    stockCount: 2,
    shopId: 'shop-2',
    categoryId: CATEGORY_ID,
    isActive: false,
    status: 'draft',
    vatRateCategory: 'standard',
    weightGrams: 500,
    lengthCm: 12,
    widthCm: 12,
    heightCm: 12,
  })
  await db.insert(productImage).values({
    id: 'image-foreign',
    productId: foreignProductId,
    url: 'products/foreign.webp',
    sortOrder: 0,
  })
  return foreignProductId
}

const acceptedTerms = {
  termsAgreed: true as const,
  termsVersion: SELLER_TERMS_VERSION,
}

describe('sell onboarding server', () => {
  it('creates an incomplete draft without prematurely promoting the customer', async () => {
    const seller = await seedUser()
    const draft = await createShopDraftInternal(seller)
    const [record] = await db.select().from(shop).where(eq(shop.id, draft.id))
    const [account] = await db.select().from(user).where(eq(user.id, seller.id))

    expect(record.name).toBe('')
    expect(record.slug).toMatch(/^draft-/)
    expect(record.onboardingStep).toBe(1)
    expect(account.role).toBe('customer')
  })

  it('persists and decrypts seller identity, dispatch, and business-address fields', async () => {
    await seedUser()
    await seedShop({ shippingOrigin: null, businessAddress: null })

    await saveOnboardingStepInternal('user-1', 'customer', {
      draftId: 'shop-1',
      step: 2,
      data: {
        shippingOrigin: {
          country: 'FR',
          city: 'Lyon',
          postalCode: '69001',
          processingTimeDays: { min: 2, max: 4 },
          shipsInternational: false,
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
        traderStatus: 'non_trader',
        dateOfBirth: '1990-05-15',
        taxId: 'FRTIN12345',
        businessRegistrationNumber: '',
      },
    })

    const draft = await getShopDraftQuery('shop-1', 'user-1', 'customer')
    expect(draft.shippingOrigin?.city).toBe('Lyon')
    expect(draft.businessAddress?.street).toBe('4 Rue Mercière')
    expect(draft.taxId).toBe('FRTIN12345')
    expect(draft.traderStatus).toBe('non_trader')
    expect(draft.onboardingStep).toBe(3)
  })

  it('creates one onboarding product and updates it on later saves', async () => {
    await seedUser({ role: 'creator' })
    await seedCategory()
    await seedShop()
    const input = {
      draftId: 'shop-1',
      name: 'Handmade stoneware cup',
      slug: 'handmade-stoneware-cup',
      description: 'A tactile stoneware cup made and glazed by hand in our small workshop.',
      priceCents: 3200,
      stockCount: 4,
      categoryId: CATEGORY_ID,
      vatRateCategory: 'standard' as const,
      weightGrams: 420,
      lengthCm: 12,
      widthCm: 12,
      heightCm: 10,
      images: [{ key: 'products/cup.webp', altText: 'Speckled cup on a linen table' }],
    }

    const created = await saveDraftListingInternal(
      { id: 'user-1', name: 'Test Seller', role: 'creator' },
      input,
    )
    const updated = await saveDraftListingInternal(
      { id: 'user-1', name: 'Test Seller', role: 'creator' },
      { ...input, name: 'Updated stoneware cup', priceCents: 3500 },
    )

    expect(updated.id).toBe(created.id)
    expect(await db.select().from(product)).toHaveLength(1)
    const [record] = await db.select().from(shop).where(eq(shop.id, 'shop-1'))
    expect(record.onboardingListingId).toBe(created.id)
    expect(record.onboardingStep).toBe(4)
  })

  it('rejects attaching a product owned by another shop', async () => {
    await seedUser()
    await seedCategory()
    await seedShop()
    const foreignProductId = await seedForeignProduct()

    await expect(
      saveOnboardingStepInternal('user-1', 'customer', {
        draftId: 'shop-1',
        step: 3,
        data: { productId: foreignProductId },
      }),
    ).rejects.toThrow('INVALID_ONBOARDING_LISTING')

    const [record] = await db.select().from(shop).where(eq(shop.id, 'shop-1'))
    expect(record.onboardingListingId).toBeNull()
  })

  it('does not return a foreign product from a corrupted onboarding reference', async () => {
    await seedUser()
    await seedCategory()
    await seedShop()
    const foreignProductId = await seedForeignProduct()
    await db
      .update(shop)
      .set({ onboardingListingId: foreignProductId })
      .where(eq(shop.id, 'shop-1'))

    expect(await getOnboardingListingInternal('shop-1')).toBeNull()
    const readiness = await getOnboardingReadinessInternal('shop-1')
    expect(readiness.items.find((item) => item.id === 'product')?.complete).toBe(false)
  })

  it('allows a privileged admin to delete another seller draft', async () => {
    await seedUser()
    await seedShop()
    await seedUser({ id: 'admin-1', email: 'admin@example.com', role: 'admin' })

    await deleteShopDraftInternal('admin-1', 'admin', 'shop-1')

    expect(await db.select().from(shop).where(eq(shop.id, 'shop-1'))).toHaveLength(0)
  })

  it('reports authoritative readiness and rejects incomplete submission', async () => {
    await seedUser()
    await seedCategory()
    await seedShop({ image: null })
    await seedCompleteProduct()

    const readiness = await getOnboardingReadinessInternal('shop-1')
    expect(readiness.ready).toBe(false)
    expect(readiness.items.find((item) => item.id === 'profile')?.complete).toBe(false)
    await expect(
      submitShopForReviewInternal('user-1', 'customer', 'shop-1', acceptedTerms),
    ).rejects.toThrow('INCOMPLETE_ONBOARDING:profile')
  })

  it('keeps a complete legacy shop unready and unsubmitable until it declares trader status', async () => {
    await seedUser()
    await seedCategory()
    await seedShop({ traderStatus: null })
    await seedCompleteProduct()

    const readiness = await getOnboardingReadinessInternal('shop-1')
    expect(readiness.ready).toBe(false)
    expect(readiness.items.find((item) => item.id === 'seller')?.complete).toBe(false)
    await expect(
      submitShopForReviewInternal('user-1', 'customer', 'shop-1', acceptedTerms),
    ).rejects.toThrow('INCOMPLETE_ONBOARDING:seller')
  })

  it.each([
    'trader',
    'non_trader',
  ] as const)('stores terms acceptance, promotes the seller, and submits a complete shop with an explicit %s declaration', async (traderStatus) => {
    await seedUser()
    await seedCategory()
    await seedShop({ traderStatus })
    await seedCompleteProduct()

    const result = await submitShopForReviewInternal('user-1', 'customer', 'shop-1', acceptedTerms)
    expect(result.success).toBe(true)

    const [record] = await db.select().from(shop).where(eq(shop.id, 'shop-1'))
    const [seller] = await db.select().from(user).where(eq(user.id, 'user-1'))
    expect(record.status).toBe('pending_review')
    expect(record.traderStatus).toBe(traderStatus)
    expect(record.onboardingCompletedAt).toBeInstanceOf(Date)
    expect(record.sellerTermsAcceptedAt).toBeInstanceOf(Date)
    expect(record.sellerTermsVersion).toBe(SELLER_TERMS_VERSION)
    expect(seller.role).toBe('creator')
  })

  it.each([0, 6])('rejects onboarding stage %s outside the five-stage flow', async (stage) => {
    await seedUser()
    await seedShop()
    await expect(
      saveOnboardingStepInternal('user-1', 'customer', {
        draftId: 'shop-1',
        step: stage,
        data: {},
      }),
    ).rejects.toThrow('INVALID_ONBOARDING_STEP')
  })
})
