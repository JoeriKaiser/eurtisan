import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { shop, user } from '#/db/schema'
import { listAllShopsQuery, moderateShopQuery } from './shop-moderation.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      role: 'customer',
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
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

/* -------------------------------------------------------------------------- */
/*                             listAllShopsQuery                              */
/* -------------------------------------------------------------------------- */

describe('listAllShopsQuery', () => {
  it('returns an empty list when there are no shops', async () => {
    const result = await listAllShopsQuery({ filter: 'all', page: 1, pageSize: 20 })

    expect(result.shops).toEqual([])
    expect(result.total).toBe(0)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('returns shops with owner details', async () => {
    await seedUser({ id: 'owner-1', name: 'Alice', email: 'alice@test.com', role: 'creator' })
    await seedShop({ id: 'shop-1', slug: 'shop-1', ownerId: 'owner-1' })

    const result = await listAllShopsQuery({ filter: 'all', page: 1, pageSize: 20 })

    expect(result.shops).toHaveLength(1)
    expect(result.total).toBe(1)

    const shopItem = result.shops[0]
    expect(shopItem.id).toBe('shop-1')
    expect(shopItem.name).toBe('Test Shop')
    expect(shopItem.ownerName).toBe('Alice')
    expect(shopItem.ownerEmail).toBe('alice@test.com')
    expect(shopItem.isSuspended).toBe(false)
    expect(shopItem.moderationNote).toBeNull()
    expect(shopItem.createdAt).toBeInstanceOf(Date)
  })

  it('returns isSuspended=true for suspended shops', async () => {
    await seedUser()
    await seedShop({ id: 'shop-1', slug: 'shop-1', isSuspended: true })

    const result = await listAllShopsQuery({ filter: 'all', page: 1, pageSize: 20 })
    expect(result.shops[0].isSuspended).toBe(true)
  })

  it('returns moderation note when set', async () => {
    await seedUser()
    await seedShop({ id: 'shop-1', slug: 'shop-1', moderationNote: 'Policy violation' })

    const result = await listAllShopsQuery({ filter: 'all', page: 1, pageSize: 20 })
    expect(result.shops[0].moderationNote).toBe('Policy violation')
  })

  describe('filter by suspension status', () => {
    it('filter: all returns every shop', async () => {
      await seedUser()
      await seedUser({
        id: 'creator-1',
        name: 'Creator',
        email: 'creator@test.com',
        role: 'creator',
      })
      await seedShop({ id: 'shop-1', slug: 'shop-1', isSuspended: false, ownerId: 'creator-1' })
      await seedShop({ id: 'shop-2', slug: 'shop-2', isSuspended: true, ownerId: 'creator-1' })
      await seedShop({ id: 'shop-3', slug: 'shop-3', isSuspended: false, ownerId: 'creator-1' })

      const result = await listAllShopsQuery({ filter: 'all', page: 1, pageSize: 20 })
      expect(result.shops).toHaveLength(3)
      expect(result.total).toBe(3)
    })

    it('filter: active returns only non-suspended shops', async () => {
      await seedUser()
      await seedShop({ id: 'shop-1', slug: 'shop-1', isSuspended: false })
      await seedShop({ id: 'shop-2', slug: 'shop-2', isSuspended: true })
      await seedShop({ id: 'shop-3', slug: 'shop-3', isSuspended: false })

      const result = await listAllShopsQuery({ filter: 'active', page: 1, pageSize: 20 })
      expect(result.shops).toHaveLength(2)
      expect(result.total).toBe(2)
      for (const s of result.shops) {
        expect(s.isSuspended).toBe(false)
      }
    })

    it('filter: suspended returns only suspended shops', async () => {
      await seedUser()
      await seedShop({ id: 'shop-1', slug: 'shop-1', isSuspended: false })
      await seedShop({ id: 'shop-2', slug: 'shop-2', isSuspended: true })
      await seedShop({ id: 'shop-3', slug: 'shop-3', isSuspended: true })

      const result = await listAllShopsQuery({ filter: 'suspended', page: 1, pageSize: 20 })
      expect(result.shops).toHaveLength(2)
      expect(result.total).toBe(2)
      for (const s of result.shops) {
        expect(s.isSuspended).toBe(true)
      }
    })
  })

  describe('pagination', () => {
    it('respects page and pageSize parameters', async () => {
      await seedUser()
      for (let i = 0; i < 5; i++) {
        await seedShop({ id: `shop-${i}`, slug: `shop-${i}` })
      }

      const page1 = await listAllShopsQuery({ filter: 'all', page: 1, pageSize: 2 })
      expect(page1.shops).toHaveLength(2)
      expect(page1.total).toBe(5)
      expect(page1.page).toBe(1)

      const page2 = await listAllShopsQuery({ filter: 'all', page: 2, pageSize: 2 })
      expect(page2.shops).toHaveLength(2)
      expect(page2.total).toBe(5)
      expect(page2.page).toBe(2)

      const page3 = await listAllShopsQuery({ filter: 'all', page: 3, pageSize: 2 })
      expect(page3.shops).toHaveLength(1)
      expect(page3.total).toBe(5)
      expect(page3.page).toBe(3)
    })

    it('page beyond the last item returns empty list but correct total', async () => {
      await seedUser()
      await seedShop()

      const result = await listAllShopsQuery({ filter: 'all', page: 10, pageSize: 20 })
      expect(result.shops).toHaveLength(0)
      expect(result.total).toBe(1)
    })
  })

  it('shops are sorted by createdAt descending', async () => {
    await seedUser()
    await seedShop({ id: 'shop-1', slug: 'shop-1' })
    await seedShop({ id: 'shop-2', slug: 'shop-2' })
    await seedShop({ id: 'shop-3', slug: 'shop-3' })

    const result = await listAllShopsQuery({ filter: 'all', page: 1, pageSize: 20 })
    expect(result.shops).toHaveLength(3)

    // Shops should be ordered newest first (id order doesn't guarantee it,
    // but createdAt should be descending — verify the timestamp order)
    for (let i = 1; i < result.shops.length; i++) {
      expect(result.shops[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
        result.shops[i].createdAt.getTime(),
      )
    }
  })
})

/* -------------------------------------------------------------------------- */
/*                              moderateShopQuery                             */
/* -------------------------------------------------------------------------- */

describe('moderateShopQuery', () => {
  it('suspends an active shop', async () => {
    await seedUser()
    await seedShop()

    const result = await moderateShopQuery('shop-1', 'suspend')

    expect(result.isSuspended).toBe(true)
  })

  it('unsuspends a suspended shop', async () => {
    await seedUser()
    await seedShop({ isSuspended: true })

    const result = await moderateShopQuery('shop-1', 'unsuspend')

    expect(result.isSuspended).toBe(false)
  })

  it('is idempotent: suspending an already-suspended shop succeeds', async () => {
    await seedUser()
    await seedShop({ isSuspended: true })

    const result = await moderateShopQuery('shop-1', 'suspend')

    expect(result.isSuspended).toBe(true)
  })

  it('is idempotent: unsuspending an already-active shop succeeds', async () => {
    await seedUser()
    await seedShop({ isSuspended: false })

    const result = await moderateShopQuery('shop-1', 'unsuspend')

    expect(result.isSuspended).toBe(false)
  })

  it('throws a clear error for an invalid shop ID', async () => {
    await expect(moderateShopQuery('nonexistent-shop', 'suspend')).rejects.toThrow(
      'Shop not found: nonexistent-shop',
    )
  })

  it('throws a clear error for an invalid shop ID with unsuspend action', async () => {
    await expect(moderateShopQuery('nonexistent-shop', 'unsuspend')).rejects.toThrow(
      'Shop not found: nonexistent-shop',
    )
  })

  describe('moderation note', () => {
    it('saves a moderation note when provided with suspend', async () => {
      await seedUser()
      await seedShop()

      const result = await moderateShopQuery('shop-1', 'suspend', 'Contains prohibited items')

      expect(result.moderationNote).toBe('Contains prohibited items')
    })

    it('saves a moderation note when provided with unsuspend', async () => {
      await seedUser()
      await seedShop({ isSuspended: true, moderationNote: 'Was suspended for policy' })

      const result = await moderateShopQuery('shop-1', 'unsuspend', 'Issue resolved after review')

      expect(result.moderationNote).toBe('Issue resolved after review')
    })

    it('leaves existing moderation note unchanged when note is omitted', async () => {
      await seedUser()
      await seedShop({ moderationNote: 'Previous note' })

      const result = await moderateShopQuery('shop-1', 'suspend')

      // Note should remain unchanged since we didn't pass a note
      expect(result.moderationNote).toBe('Previous note')
    })

    it('clears the moderation note when an empty string is provided', async () => {
      await seedUser()
      await seedShop({ moderationNote: 'Old note' })

      const result = await moderateShopQuery('shop-1', 'suspend', '')

      expect(result.moderationNote).toBeNull()
    })
  })

  it('persists the suspension status in the database', async () => {
    await seedUser()
    await seedShop()

    await moderateShopQuery('shop-1', 'suspend', 'Violation')

    // Verify the change is persisted by querying the shop
    const [actual] = await db
      .select({
        isSuspended: shop.isSuspended,
        moderationNote: shop.moderationNote,
      })
      .from(shop)
      .where(eq(shop.id, 'shop-1'))
      .limit(1)

    expect(actual.isSuspended).toBe(true)
    expect(actual.moderationNote).toBe('Violation')
  })
})
