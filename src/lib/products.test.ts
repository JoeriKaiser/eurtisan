import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { categories, product, shop, user } from '#/db/schema'

import {
  createProductSchema,
  listProductsByCategorySlugQuery,
  listProductsByShopQuery,
} from './products'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(product)
  await db.delete(categories)
  await db.delete(shop)
  await db.delete(user)
})

describe('createProductSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      description: 'A beautiful ceramic vase',
      slug: 'handmade-vase',
      price: '29.99',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input without optional fields', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      price: '29.99',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createProductSchema.safeParse({
      name: '',
      slug: 'handmade-vase',
      price: '29.99',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid categoryId', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      price: '29.99',
      categoryId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

describe('listProductsByShopQuery', () => {
  it('returns products for a specific shop', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s.id,
    })

    const result = await listProductsByShopQuery(s.id)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Vase')
  })

  it('returns empty array when no products exist', async () => {
    const result = await listProductsByShopQuery('nonexistent-shop')
    expect(result).toEqual([])
  })
})

describe('listProductsByCategorySlugQuery', () => {
  it('returns products for a category slug', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s.id,
      categoryId: cat.id,
    })

    const result = await listProductsByCategorySlugQuery('pottery')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Vase')
    expect(result[0].categoryName).toBe('Pottery')
  })

  it('returns empty array for nonexistent category', async () => {
    const result = await listProductsByCategorySlugQuery('nonexistent')
    expect(result).toEqual([])
  })
})

describe('product database constraints', () => {
  beforeEach(async () => {
    await db.delete(product)
    await db.delete(categories)
    await db.delete(shop)
    await db.delete(user)
  })

  it('enforces unique slug per shop', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s.id,
    })

    await expect(
      db.insert(product).values({
        id: 'prod-2',
        name: 'Another Vase',
        slug: 'vase',
        price: '39.99',
        shopId: s.id,
      }),
    ).rejects.toThrow()
  })

  it('allows same slug in different shops', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s1] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop 1',
        slug: 'test-shop-1',
        ownerId: u.id,
      })
      .returning()

    const [s2] = await db
      .insert(shop)
      .values({
        id: 'shop-2',
        name: 'Test Shop 2',
        slug: 'test-shop-2',
        ownerId: u.id,
      })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s1.id,
    })

    await expect(
      db.insert(product).values({
        id: 'prod-2',
        name: 'Vase',
        slug: 'vase',
        price: '39.99',
        shopId: s2.id,
      }),
    ).resolves.not.toThrow()
  })
})
