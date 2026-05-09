import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { categories, product, productImage, shop, user } from '#/db/schema'

import { createProductSchema } from './products'
import {
  createProductInternal,
  getProductBySlugQuery,
  getProductsByShopSlugQuery,
  listProductsByCategorySlugQuery,
  listProductsByShopQuery,
  listProductsQuery,
} from './products.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(productImage)
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
      priceCents: 2999,
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
      priceCents: 2999,
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

  it('excludes products from suspended shops', async () => {
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
        isSuspended: true,
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
      priceCents: 2999,
      shopId: s.id,
      categoryId: cat.id,
    })

    const result = await listProductsByCategorySlugQuery('pottery')
    expect(result).toHaveLength(0)
  })

  it('excludes inactive products', async () => {
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
      priceCents: 2999,
      shopId: s.id,
      categoryId: cat.id,
      isActive: false,
    })

    const result = await listProductsByCategorySlugQuery('pottery')
    expect(result).toHaveLength(0)
  })
})

describe('getProductBySlugQuery', () => {
  it('returns product by slug with images ordered by sortOrder', async () => {
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

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        categoryId: cat.id,
      })
      .returning()

    await db.insert(productImage).values([
      { id: 'img-1', productId: p.id, url: 'http://example.com/1.jpg', altText: 'First', sortOrder: 1 },
      { id: 'img-2', productId: p.id, url: 'http://example.com/2.jpg', altText: 'Second', sortOrder: 0 },
    ])

    const result = await getProductBySlugQuery('vase')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Vase')
    expect(result!.shopName).toBe('Test Shop')
    expect(result!.shopSlug).toBe('test-shop')
    expect(result!.categoryName).toBe('Pottery')
    expect(result!.categorySlug).toBe('pottery')
    expect(result!.images).toHaveLength(2)
    expect(result!.images[0].sortOrder).toBe(0)
    expect(result!.images[1].sortOrder).toBe(1)
  })

  it('returns null for nonexistent product', async () => {
    const result = await getProductBySlugQuery('nonexistent-slug')
    expect(result).toBeNull()
  })

  it('returns null when shop is suspended', async () => {
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
        isSuspended: true,
      })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
    })

    const result = await getProductBySlugQuery('vase')
    expect(result).toBeNull()
  })

  it('returns null when product is inactive', async () => {
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
      priceCents: 2999,
      shopId: s.id,
      isActive: false,
    })

    const result = await getProductBySlugQuery('vase')
    expect(result).toBeNull()
  })
})

describe('listProductsQuery', () => {
  async function seedShopAndProducts() {
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

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    await db.insert(product).values([
      { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999, shopId: s1.id, categoryId: cat.id },
      { id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 1999, shopId: s1.id, categoryId: cat.id },
      { id: 'prod-3', name: 'Plate', slug: 'plate', priceCents: 4999, shopId: s2.id, categoryId: cat.id },
    ])

    return { s1, s2, cat }
  }

  it('returns paginated products', async () => {
    await seedShopAndProducts()

    const result = await listProductsQuery({}, { page: 1, pageSize: 2 })
    expect(result.products).toHaveLength(2)
    expect(result.total).toBe(3)
    expect(result.totalPages).toBe(2)
    expect(result.page).toBe(1)
  })

  it('filters by shop slug', async () => {
    const { s1 } = await seedShopAndProducts()

    const result = await listProductsQuery({ shopSlug: s1.slug })
    expect(result.products).toHaveLength(2)
    expect(result.products.every((p) => p.shopSlug === s1.slug)).toBe(true)
  })

  it('filters by category slug', async () => {
    await seedShopAndProducts()

    const result = await listProductsQuery({ categorySlug: 'pottery' })
    expect(result.products).toHaveLength(3)
  })

  it('filters by price range', async () => {
    await seedShopAndProducts()

    const result = await listProductsQuery({ minPriceCents: 2000, maxPriceCents: 4000 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Vase')
  })

  it('sorts by price ascending', async () => {
    await seedShopAndProducts()

    const result = await listProductsQuery({}, { page: 1, pageSize: 10 }, 'price_asc')
    expect(result.products[0].name).toBe('Bowl')
    expect(result.products[1].name).toBe('Vase')
    expect(result.products[2].name).toBe('Plate')
  })

  it('sorts by price descending', async () => {
    await seedShopAndProducts()

    const result = await listProductsQuery({}, { page: 1, pageSize: 10 }, 'price_desc')
    expect(result.products[0].name).toBe('Plate')
    expect(result.products[1].name).toBe('Vase')
    expect(result.products[2].name).toBe('Bowl')
  })

  it('sorts by newest', async () => {
    await seedShopAndProducts()

    const result = await listProductsQuery({}, { page: 1, pageSize: 10 }, 'newest')
    expect(result.products).toHaveLength(3)
  })

  it('excludes products from suspended shops', async () => {
    const { s1 } = await seedShopAndProducts()

    await db.update(shop).set({ isSuspended: true }).where(eq(shop.id, s1.id))

    const result = await listProductsQuery()
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Plate')
  })

  it('excludes inactive products', async () => {
    await seedShopAndProducts()

    await db.update(product).set({ isActive: false }).where(eq(product.id, 'prod-1'))

    const result = await listProductsQuery()
    expect(result.products).toHaveLength(2)
    expect(result.products.every((p) => p.name !== 'Vase')).toBe(true)
  })

  it('returns slugs instead of internal IDs', async () => {
    await seedShopAndProducts()

    const result = await listProductsQuery()
    const p = result.products[0]
    expect(p.shopSlug).toBeDefined()
    expect(p.categorySlug).toBeDefined()
    expect(p.shopName).toBeDefined()
    expect(p.categoryName).toBeDefined()
  })
})

describe('getProductsByShopSlugQuery', () => {
  it('returns paginated active products for a shop', async () => {
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

    await db.insert(product).values([
      { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999, shopId: s.id },
      { id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 1999, shopId: s.id },
    ])

    const result = await getProductsByShopSlugQuery('test-shop', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('throws 404 for nonexistent shop', async () => {
    try {
      await getProductsByShopSlugQuery('nonexistent-shop')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 404 for suspended shop', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
        isSuspended: true,
      })
      .returning()

    try {
      await getProductsByShopSlugQuery('test-shop')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })
})

describe('createProductInternal', () => {
  it('creates a product successfully', async () => {
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

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s.id,
    })

    expect(result.name).toBe('Vase')
    expect(result.slug).toBe('vase')
    expect(result.priceCents).toBe(2999)
  })

  it('rejects duplicate slug globally', async () => {
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

    await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s1.id,
    })

    await expect(
      createProductInternal({
        name: 'Another Vase',
        slug: 'vase',
        price: '39.99',
        shopId: s2.id,
      }),
    ).rejects.toThrow('A product with slug "vase" already exists')
  })
})

describe('product database constraints', () => {
  beforeEach(async () => {
    await db.delete(productImage)
    await db.delete(product)
    await db.delete(categories)
    await db.delete(shop)
    await db.delete(user)
  })

  it('enforces unique slug globally', async () => {
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
      priceCents: 2999,
      shopId: s1.id,
    })

    await expect(
      (async () => {
        await db.insert(product).values({
          id: 'prod-2',
          name: 'Another Vase',
          slug: 'vase',
          priceCents: 3999,
          shopId: s2.id,
        })
      })(),
    ).rejects.toThrow()
  })
})
