import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { shop, user } from '#/db/schema'

import { becomeCreatorInternal } from './server-auth'

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

async function seedCustomer(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Customer',
      email: 'customer@example.com',
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

describe('becomeCreatorInternal', () => {
  it('upgrades a customer to creator', async () => {
    const customer = await seedCustomer()

    await becomeCreatorInternal(customer.id, customer.role, {
      shopName: 'Test Shop',
      shopSlug: 'test-shop',
    })

    const updatedUser = await db.query.user.findFirst({
      where: (u) => eq(u.id, customer.id),
    })
    expect(updatedUser?.role).toBe('creator')
  })

  it('creates a shop with status draft', async () => {
    const customer = await seedCustomer()

    await becomeCreatorInternal(customer.id, customer.role, {
      shopName: 'Test Shop',
      shopSlug: 'test-shop',
    })

    const createdShop = await db.query.shop.findFirst({
      where: (s) => eq(s.ownerId, customer.id),
    })
    expect(createdShop).toBeDefined()
    expect(createdShop?.status).toBe('draft')
    expect(createdShop?.name).toBe('Test Shop')
    expect(createdShop?.slug).toBe('test-shop')
  })

  it('does not create a shop when shopName or shopSlug is missing', async () => {
    const customer = await seedCustomer()

    await becomeCreatorInternal(customer.id, customer.role, {})

    const shops = await db.select().from(shop).where(eq(shop.ownerId, customer.id))
    expect(shops.length).toBe(0)
  })

  it('throws FORBIDDEN when user is not a customer', async () => {
    const creator = await seedCustomer({ role: 'creator' })

    await expect(
      becomeCreatorInternal(creator.id, creator.role, {
        shopName: 'Test Shop',
        shopSlug: 'test-shop',
      }),
    ).rejects.toThrow('FORBIDDEN')
  })
})
