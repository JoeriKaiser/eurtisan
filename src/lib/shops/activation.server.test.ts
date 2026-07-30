import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { meilisearchSyncQueue, product, shop, user } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { activateApprovedShopAndListing } from './activation.server'

const LISTING_ID = 'listing-1'

beforeEach(async () => {
  // Deleting `product` directly fails against any database that holds an
  // `order_item`, which is every database a seed has touched. The shared helper
  // clears in foreign-key-child-first order.
  await clearTestTables()
  await db.insert(user).values({
    id: 'seller-1',
    name: 'Seller',
    email: 'seller@example.test',
    emailVerified: true,
    role: 'creator',
    twoFactorEnabled: true,
  })
})

async function seedApprovedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  await db.insert(shop).values({
    id: 'shop-1',
    name: 'Atelier',
    slug: 'atelier',
    ownerId: 'seller-1',
    status: 'approved',
    paymentConnected: true,
    onboardingListingId: LISTING_ID,
    ...overrides,
  })
  await db.insert(product).values({
    id: LISTING_ID,
    name: 'Handmade bowl',
    slug: 'handmade-bowl',
    shopId: 'shop-1',
    priceCents: 4500,
    stockCount: 2,
    status: 'draft',
    isActive: false,
  })
}

describe('activateApprovedShopAndListing', () => {
  it('publishes the onboarding listing before marking the shop live', async () => {
    await seedApprovedShop()

    const result = await activateApprovedShopAndListing('shop-1')
    const [shopRecord] = await db.select().from(shop).where(eq(shop.id, 'shop-1'))
    const [listing] = await db.select().from(product).where(eq(product.id, LISTING_ID))

    expect(result).toEqual({ activated: true, listingId: LISTING_ID })
    expect(shopRecord.status).toBe('active')
    expect(listing.status).toBe('published')
    expect(listing.isActive).toBe(true)
    expect(listing.publishedAt).toBeInstanceOf(Date)
    expect(await db.select().from(meilisearchSyncQueue)).toHaveLength(1)
  })

  it('does not activate before two-factor security is enabled', async () => {
    await seedApprovedShop()
    await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, 'seller-1'))

    await expect(activateApprovedShopAndListing('shop-1')).resolves.toEqual({
      activated: false,
      reason: 'two_factor_required',
    })
    const [record] = await db.select().from(shop).where(eq(shop.id, 'shop-1'))
    expect(record.status).toBe('approved')
  })

  it('does not activate before payment is connected', async () => {
    await seedApprovedShop({ paymentConnected: false })

    await expect(activateApprovedShopAndListing('shop-1')).resolves.toEqual({
      activated: false,
      reason: 'payment_not_connected',
    })
    const [record] = await db.select().from(shop).where(eq(shop.id, 'shop-1'))
    expect(record.status).toBe('approved')
  })
})
