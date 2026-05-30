import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import {
  cart,
  cartItem,
  categories,
  inventoryReservation,
  orderItem,
  platformOrder,
  product,
  productImage,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import { createProductSchema } from './products'
import {
  createProductInternal,
  getFeaturedShopsQuery,
  getProductBySlugQuery,
  getProductsByShopSlugQuery,
  getShopBySlugQuery,
  getShopProductsQuery,
  listProductsByCategorySlugQuery,
  listProductsByShopQuery,
  listProductsQuery,
  listRecentProductsQuery,
  listShopsQuery,
  searchProductsQuery,
} from './products.server'
import { syncProductToMeilisearch } from './meilisearch-products.server'
import { logger } from './logger.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('./meilisearch-products.server', () => ({
  searchProductsMeilisearch: vi.fn().mockResolvedValue(null),
  syncProductToMeilisearch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./logger.server', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(async () => {
  await db.delete(inventoryReservation)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
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
      priceCents: 2999,
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

  it('enforces maximum limit of 100', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-limit',
        name: 'Test',
        email: 'limit@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-limit',
        name: 'Test Shop',
        slug: 'test-shop-limit',
        ownerId: u.id,
      })
      .returning()

    // Insert 5 products
    for (let i = 0; i < 5; i++) {
      await db.insert(product).values({
        id: `prod-limit-${i}`,
        name: `Product ${i}`,
        slug: `product-${i}`,
        priceCents: 1000,
        shopId: s.id,
      })
    }

    const result = await listProductsByShopQuery(s.id, 200)
    expect(result).toHaveLength(5)
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
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Vase')
    expect(result.products[0].categoryName).toBe('Pottery')
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('returns empty result for nonexistent category', async () => {
    const result = await listProductsByCategorySlugQuery('nonexistent')
    expect(result.products).toEqual([])
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
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
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
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
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('enforces maximum page size of 100', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-cat-limit',
        name: 'Test',
        email: 'cat-limit@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-cat-limit',
        name: 'Test Shop',
        slug: 'test-shop-cat-limit',
        ownerId: u.id,
      })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery-limit' })
      .returning()

    // Insert 5 products
    for (let i = 0; i < 5; i++) {
      await db.insert(product).values({
        id: `prod-cat-limit-${i}`,
        name: `Product ${i}`,
        slug: `product-${i}`,
        priceCents: 1000,
        shopId: s.id,
        categoryId: cat.id,
      })
    }

    const result = await listProductsByCategorySlugQuery('pottery-limit', {
      page: 1,
      pageSize: 200,
    })
    expect(result.products).toHaveLength(5)
    expect(result.pageSize).toBe(100)
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
      {
        id: 'img-1',
        productId: p.id,
        url: 'http://example.com/1.jpg',
        altText: 'First',
        sortOrder: 1,
      },
      {
        id: 'img-2',
        productId: p.id,
        url: 'http://example.com/2.jpg',
        altText: 'Second',
        sortOrder: 0,
      },
    ])

    const result = await getProductBySlugQuery('test-shop', 'vase')
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Vase')
    expect(result?.shopName).toBe('Test Shop')
    expect(result?.shopSlug).toBe('test-shop')
    expect(result?.categoryName).toBe('Pottery')
    expect(result?.categorySlug).toBe('pottery')
    expect(result?.images).toHaveLength(2)
    expect(result?.images[0].sortOrder).toBe(0)
    expect(result?.images[1].sortOrder).toBe(1)
  })

  it('returns null for nonexistent product', async () => {
    const result = await getProductBySlugQuery('test-shop', 'nonexistent-slug')
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

    const result = await getProductBySlugQuery('test-shop', 'vase')
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

    const result = await getProductBySlugQuery('test-shop', 'vase')
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
      {
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s1.id,
        categoryId: cat.id,
      },
      {
        id: 'prod-2',
        name: 'Bowl',
        slug: 'bowl',
        priceCents: 1999,
        shopId: s1.id,
        categoryId: cat.id,
      },
      {
        id: 'prod-3',
        name: 'Plate',
        slug: 'plate',
        priceCents: 4999,
        shopId: s2.id,
        categoryId: cat.id,
      },
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

  it('rejects duplicate slug within the same shop', async () => {
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

    await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s.id,
    })

    await expect(
      createProductInternal({
        name: 'Another Vase',
        slug: 'vase',
        price: '39.99',
        shopId: s.id,
      }),
    ).rejects.toThrow('A product with slug "vase" already exists in this shop')
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

    await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s1.id,
    })

    const result = await createProductInternal({
      name: 'Another Vase',
      slug: 'vase',
      price: '39.99',
      shopId: s2.id,
    })

    expect(result.slug).toBe('vase')
    expect(result.shopId).toBe(s2.id)
  })

  it('succeeds when Meilisearch sync fails and logs a warning', async () => {
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

    vi.mocked(syncProductToMeilisearch).mockRejectedValueOnce(new Error('Meili down'))

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      price: '29.99',
      shopId: s.id,
    })

    expect(result.name).toBe('Vase')
    expect(result.slug).toBe('vase')
    expect(result.priceCents).toBe(2999)
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to sync product to Meilisearch',
      expect.objectContaining({ productId: result.id }),
    )
  })
})

describe('getShopBySlugQuery', () => {
  it('returns shop summary by slug', async () => {
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
        description: 'A test shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const result = await getShopBySlugQuery('test-shop')
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Test Shop')
    expect(result?.description).toBe('A test shop')
    expect(result?.slug).toBe('test-shop')
  })

  it('returns null for nonexistent shop', async () => {
    const result = await getShopBySlugQuery('nonexistent-shop')
    expect(result).toBeNull()
  })

  it('returns null for suspended shop', async () => {
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

    const result = await getShopBySlugQuery('test-shop')
    expect(result).toBeNull()
  })
})

describe('getShopProductsQuery', () => {
  async function seedShopWithProducts() {
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
      { id: 'prod-1', name: 'Ceramic Vase', slug: 'ceramic-vase', priceCents: 2999, shopId: s.id },
      { id: 'prod-2', name: 'Wooden Bowl', slug: 'wooden-bowl', priceCents: 1999, shopId: s.id },
      {
        id: 'prod-3',
        name: 'Glass Plate',
        slug: 'glass-plate',
        priceCents: 4999,
        shopId: s.id,
        isActive: false,
      },
    ])

    return { shop: s }
  }

  it('returns paginated active products for a shop', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', undefined, { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.products.every((p) => p.shopSlug === 'test-shop')).toBe(true)
  })

  it('filters products by case-insensitive partial name search', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', 'vase', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Ceramic Vase')
  })

  it('search is case-insensitive', async () => {
    await seedShopWithProducts()

    const lowerResult = await getShopProductsQuery('test-shop', 'bowl', { page: 1, pageSize: 10 })
    expect(lowerResult.products).toHaveLength(1)
    expect(lowerResult.products[0].name).toBe('Wooden Bowl')

    const upperResult = await getShopProductsQuery('test-shop', 'BOWL', { page: 1, pageSize: 10 })
    expect(upperResult.products).toHaveLength(1)
    expect(upperResult.products[0].name).toBe('Wooden Bowl')
  })

  it('search matches partial names', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', 'cer', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Ceramic Vase')
  })

  it('returns empty array when search matches nothing', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', 'xyz', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('excludes inactive products', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', undefined, { page: 1, pageSize: 10 })
    expect(result.products.every((p) => p.name !== 'Glass Plate')).toBe(true)
  })

  it('throws 404 for nonexistent shop', async () => {
    try {
      await getShopProductsQuery('nonexistent-shop')
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
      await getShopProductsQuery('test-shop')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('applies pagination correctly', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', undefined, { page: 1, pageSize: 1 })
    expect(result.products).toHaveLength(1)
    expect(result.total).toBe(2)
    expect(result.totalPages).toBe(2)
  })
})

describe('listRecentProductsQuery', () => {
  beforeEach(async () => {
    await db.delete(inventoryReservation)
    await db.delete(orderItem)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(cartItem)
    await db.delete(cart)
    await db.delete(productImage)
    await db.delete(product)
    await db.delete(categories)
    await db.delete(shop)
    await db.delete(user)
  })

  it('includes the primary image for each product', async () => {
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

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

    await db.insert(productImage).values([
      {
        id: 'img-1',
        productId: p.id,
        url: 'http://example.com/1.jpg',
        altText: 'First',
        sortOrder: 1,
      },
      {
        id: 'img-2',
        productId: p.id,
        url: 'http://example.com/2.jpg',
        altText: 'Second',
        sortOrder: 0,
      },
    ])

    const result = await listRecentProductsQuery(8)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Vase')
    expect(result[0].image).not.toBeNull()
    expect(result[0].image?.id).toBe('img-2')
    expect(result[0].image?.url).toBe('http://example.com/2.jpg')
    expect(result[0].image?.sortOrder).toBe(0)
  })

  it('returns null image when product has no images', async () => {
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

    const result = await listRecentProductsQuery(8)
    expect(result).toHaveLength(1)
    expect(result[0].image).toBeNull()
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

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
    })

    const result = await listRecentProductsQuery(8)
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

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      isActive: false,
    })

    const result = await listRecentProductsQuery(8)
    expect(result).toHaveLength(0)
  })
})

describe('getFeaturedShopsQuery', () => {
  beforeEach(async () => {
    await db.delete(inventoryReservation)
    await db.delete(orderItem)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(cartItem)
    await db.delete(cart)
    await db.delete(productImage)
    await db.delete(product)
    await db.delete(categories)
    await db.delete(shop)
    await db.delete(user)
  })

  it('returns active shops ordered by newest first with productCount', async () => {
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
        name: 'Old Shop',
        slug: 'old-shop',
        ownerId: u.id,
      })
      .returning()

    const [s2] = await db
      .insert(shop)
      .values({
        id: 'shop-2',
        name: 'New Shop',
        slug: 'new-shop',
        ownerId: u.id,
      })
      .returning()

    await db.insert(product).values([
      { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999, shopId: s1.id },
      { id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 1999, shopId: s2.id },
      { id: 'prod-3', name: 'Plate', slug: 'plate', priceCents: 4999, shopId: s2.id },
    ])

    const result = await getFeaturedShopsQuery(10)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('New Shop')
    expect(result[0].productCount).toBe(2)
    expect(result[1].name).toBe('Old Shop')
    expect(result[1].productCount).toBe(1)
  })

  it('excludes suspended shops', async () => {
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
        name: 'Active Shop',
        slug: 'active-shop',
        ownerId: u.id,
      })
      .returning()

    await db
      .insert(shop)
      .values({
        id: 'shop-2',
        name: 'Suspended Shop',
        slug: 'suspended-shop',
        ownerId: u.id,
        isSuspended: true,
      })
      .returning()

    const result = await getFeaturedShopsQuery(10)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Active Shop')
  })

  it('returns shops with zero products', async () => {
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
        name: 'Empty Shop',
        slug: 'empty-shop',
        ownerId: u.id,
      })
      .returning()

    const result = await getFeaturedShopsQuery(10)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Empty Shop')
    expect(result[0].productCount).toBe(0)
  })

  it('respects the limit', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    await db.insert(shop).values([
      { id: 'shop-1', name: 'Shop 1', slug: 'shop-1', ownerId: u.id },
      { id: 'shop-2', name: 'Shop 2', slug: 'shop-2', ownerId: u.id },
      { id: 'shop-3', name: 'Shop 3', slug: 'shop-3', ownerId: u.id },
    ])

    const result = await getFeaturedShopsQuery(2)
    expect(result).toHaveLength(2)
  })
})

describe('product database constraints', () => {
  beforeEach(async () => {
    await db.delete(inventoryReservation)
    await db.delete(orderItem)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(cartItem)
    await db.delete(cart)
    await db.delete(productImage)
    await db.delete(product)
    await db.delete(categories)
    await db.delete(shop)
    await db.delete(user)
  })

  it('enforces unique slug within the same shop', async () => {
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

    await expect(
      (async () => {
        await db.insert(product).values({
          id: 'prod-2',
          name: 'Another Vase',
          slug: 'vase',
          priceCents: 3999,
          shopId: s.id,
        })
      })(),
    ).rejects.toThrow()
  })

  it('allows duplicate slug across different shops at database level', async () => {
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

    const result = await db
      .insert(product)
      .values({
        id: 'prod-2',
        name: 'Another Vase',
        slug: 'vase',
        priceCents: 3999,
        shopId: s2.id,
      })
      .returning()

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('vase')
    expect(result[0].shopId).toBe(s2.id)
  })
})

describe('searchProductsQuery', () => {
  async function seedSearchProducts() {
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

    const [c1] = await db
      .insert(categories)
      .values({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'Pottery', slug: 'pottery' })
      .returning()

    const [c2] = await db
      .insert(categories)
      .values({ id: '550e8400-e29b-41d4-a716-446655440002', name: 'Tableware', slug: 'tableware' })
      .returning()

    await db.insert(product).values([
      {
        id: 'prod-1',
        name: 'Ceramic Vase',
        slug: 'ceramic-vase',
        priceCents: 2999,
        shopId: s1.id,
        categoryId: c1.id,
      },
      {
        id: 'prod-2',
        name: 'Wooden Bowl',
        slug: 'wooden-bowl',
        priceCents: 1999,
        shopId: s1.id,
        categoryId: c2.id,
      },
      {
        id: 'prod-3',
        name: 'Glass Plate',
        slug: 'glass-plate',
        priceCents: 4999,
        shopId: s2.id,
        categoryId: c2.id,
      },
      {
        id: 'prod-4',
        name: 'vase-like',
        slug: 'vase-like',
        priceCents: 999,
        shopId: s2.id,
        categoryId: c1.id,
      },
    ])

    return { s1, s2, c1, c2 }
  }

  it('returns products matching case-insensitive name', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery('vase', {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(2)
    expect(result.products.map((p) => p.name)).toContain('Ceramic Vase')
    expect(result.products.map((p) => p.name)).toContain('vase-like')
  })

  it('is case-insensitive', async () => {
    await seedSearchProducts()

    const lowerResult = await searchProductsQuery('bowl', {}, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(lowerResult.products).toHaveLength(1)
    expect(lowerResult.products[0].name).toBe('Wooden Bowl')

    const upperResult = await searchProductsQuery('BOWL', {}, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(upperResult.products).toHaveLength(1)
    expect(upperResult.products[0].name).toBe('Wooden Bowl')
  })

  it('matches full-word names with FTS', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery('ceramic', {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Ceramic Vase')
  })

  it('returns empty array when no matches', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery('xyz', {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('excludes products from suspended shops', async () => {
    const { s1 } = await seedSearchProducts()

    await db.update(shop).set({ isSuspended: true }).where(eq(shop.id, s1.id))

    const result = await searchProductsQuery('vase', {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('vase-like')
  })

  it('excludes inactive products', async () => {
    await seedSearchProducts()

    await db.update(product).set({ isActive: false }).where(eq(product.id, 'prod-1'))

    const result = await searchProductsQuery('vase', {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('vase-like')
  })

  it('applies pagination correctly', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, {}, 'relevance', { page: 1, pageSize: 2 })
    expect(result.products).toHaveLength(2)
    expect(result.total).toBe(4)
    expect(result.totalPages).toBe(2)
  })

  it('returns all active products when query is empty', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(4)
  })

  it('returns all active products when query is undefined', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(4)
  })

  it('filters by shop slug', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, { shopSlug: 'test-shop-1' }, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result.products).toHaveLength(2)
    expect(result.products.map((p) => p.name)).toContain('Ceramic Vase')
    expect(result.products.map((p) => p.name)).toContain('Wooden Bowl')
  })

  it('filters by category slug', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, { categorySlug: 'pottery' }, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result.products).toHaveLength(2)
    expect(result.products.map((p) => p.name)).toContain('Ceramic Vase')
    expect(result.products.map((p) => p.name)).toContain('vase-like')
  })

  it('filters by min price', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, { minPriceCents: 2000 }, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result.products).toHaveLength(2)
    expect(result.products.every((p) => p.priceCents >= 2000)).toBe(true)
  })

  it('filters by max price', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, { maxPriceCents: 2000 }, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result.products).toHaveLength(2)
    expect(result.products.every((p) => p.priceCents <= 2000)).toBe(true)
  })

  it('filters by price range', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(
      undefined,
      { minPriceCents: 1500, maxPriceCents: 3000 },
      'relevance',
      { page: 1, pageSize: 10 },
    )
    expect(result.products).toHaveLength(2)
    expect(result.products.every((p) => p.priceCents >= 1500 && p.priceCents <= 3000)).toBe(true)
  })

  it('combines query and filters', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery('vase', { shopSlug: 'test-shop-1' }, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Ceramic Vase')
  })

  it('sorts by price ascending', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, {}, 'price_asc', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(4)
    const prices = result.products.map((p) => p.priceCents)
    expect(prices).toEqual([999, 1999, 2999, 4999])
  })

  it('sorts by price descending', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, {}, 'price_desc', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(4)
    const prices = result.products.map((p) => p.priceCents)
    expect(prices).toEqual([4999, 2999, 1999, 999])
  })

  it('sorts by newest', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, {}, 'newest', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(4)
  })

  it('defaults pageSize to 24', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery(undefined, {}, 'relevance')
    expect(result.pageSize).toBe(24)
  })

  it('truncates queries longer than 100 characters', async () => {
    await seedSearchProducts()

    const longQuery = 'a'.repeat(150)
    const result = await searchProductsQuery(longQuery, {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

describe('Shop Status Visibility Constraints', () => {
  async function seedShopWithStatus(status: 'draft' | 'pending_review' | 'approved' | 'active') {
    const [u] = await db
      .insert(user)
      .values({
        id: `user-${status}`,
        name: 'Test Creator',
        email: `creator-${status}@example.com`,
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: `shop-${status}`,
        name: `Shop ${status}`,
        slug: `shop-${status}`,
        ownerId: u.id,
        status,
      })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: `Category ${status}`, slug: `cat-${status}` })
      .returning()

    const [p1] = await db
      .insert(product)
      .values({
        id: `prod-${status}-active`,
        name: `Product Active ${status}`,
        slug: `prod-active-${status}`,
        priceCents: 1000,
        stockCount: 10,
        isActive: true,
        shopId: s.id,
        categoryId: cat.id,
      })
      .returning()

    const [p2] = await db
      .insert(product)
      .values({
        id: `prod-${status}-inactive`,
        name: `Product Inactive ${status}`,
        slug: `prod-inactive-${status}`,
        priceCents: 2000,
        stockCount: 5,
        isActive: false,
        shopId: s.id,
        categoryId: cat.id,
      })
      .returning()

    return { user: u, shop: s, activeProduct: p1, inactiveProduct: p2 }
  }

  beforeEach(async () => {
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
    await db.delete(categories)
  })

  it('only returns products from active shops in listProductsQuery', async () => {
    await seedShopWithStatus('draft')
    await seedShopWithStatus('approved')
    await seedShopWithStatus('active')

    const result = await listProductsQuery()
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Product Active active')
  })

  it('fails to fetch product detail if the shop is not active', async () => {
    await seedShopWithStatus('approved')
    await seedShopWithStatus('active')

    // Approved shop product should not be accessible
    const p1 = await getProductBySlugQuery('shop-approved', 'prod-active-approved')
    expect(p1).toBeNull()

    // Active shop product should be accessible
    const p2 = await getProductBySlugQuery('shop-active', 'prod-active-active')
    expect(p2).not.toBeNull()
    expect(p2?.name).toBe('Product Active active')
  })

  it('only returns active shops in listShopsQuery', async () => {
    await seedShopWithStatus('draft')
    await seedShopWithStatus('approved')
    await seedShopWithStatus('active')

    const result = await listShopsQuery()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('shop-active')
  })

  it('enforces maximum limit of 100 in listShopsQuery', async () => {
    for (let i = 0; i < 3; i++) {
      const [u] = await db
        .insert(user)
        .values({
          id: `user-limit-${i}`,
          name: 'Test Creator',
          email: `creator-limit-${i}@example.com`,
          emailVerified: true,
        })
        .returning()

      await db
        .insert(shop)
        .values({
          id: `shop-limit-${i}`,
          name: `Shop ${i}`,
          slug: `shop-limit-${i}`,
          ownerId: u.id,
          status: 'active',
        })
        .returning()
    }

    const result = await listShopsQuery(200)
    expect(result).toHaveLength(3)
  })

  it('only returns active shops in getFeaturedShopsQuery and does not count inactive products', async () => {
    await seedShopWithStatus('approved')
    await seedShopWithStatus('active')

    const result = await getFeaturedShopsQuery(10)
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('shop-active')
    expect(result[0].productCount).toBe(1) // should not count the inactive product
  })

  it('fails to fetch shop by slug if the shop is not active', async () => {
    await seedShopWithStatus('approved')
    await seedShopWithStatus('active')

    const s1 = await getShopBySlugQuery('shop-approved')
    expect(s1).toBeNull()

    const s2 = await getShopBySlugQuery('shop-active')
    expect(s2).not.toBeNull()
    expect(s2?.slug).toBe('shop-active')
  })
})
