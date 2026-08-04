import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { product, shop } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import {
  createCategory,
  createProduct,
  createProductImage,
  createShop,
  createUser,
} from '#/test/factories'
import { logger } from './logger.server'
import { encryptJsonb } from './infra/encryption.server'
import { syncProductToMeilisearch } from './meilisearch-products.server'
import { updateShopInternal } from './shops/settings.server'
import { createProductSchema } from './products'
import {
  createProductInternal,
  getFeaturedShopsQuery,
  getMoreFromShopQuery,
  getMarketplaceStatsQuery,
  getProductBySlugQuery,
  getProductsByShopSlugQuery,
  getShopBySlugQuery,
  getShopProductCategoriesQuery,
  getShopProductsQuery,
  listProductsByCategorySlugQuery,
  listProductsByShopQuery,
  listProductsQuery,
  listRecentProductsQuery,
  listShopsQuery,
  searchProductsQuery,
} from './products.server'

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
  await clearTestTables()
})

afterAll(async () => {
  await clearTestTables()
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
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    await createProduct(s, { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999 })

    const result = await listProductsByShopQuery(s.id)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Vase')
  })

  it('enforces maximum limit of 100', async () => {
    const u = await createUser({ id: 'user-limit' })
    const s = await createShop(u, {
      id: 'shop-limit',
      name: 'Test Shop',
      slug: 'test-shop-limit',
    })

    // Insert 5 products
    for (let i = 0; i < 5; i++) {
      await createProduct(s, {
        id: `prod-limit-${i}`,
        name: `Product ${i}`,
        slug: `product-${i}`,
        priceCents: 1000,
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
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery' })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
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
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      isSuspended: true,
    })
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery' })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      categoryId: cat.id,
    })

    const result = await listProductsByCategorySlugQuery('pottery')
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('excludes inactive products', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery' })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      categoryId: cat.id,
      isActive: false,
    })

    const result = await listProductsByCategorySlugQuery('pottery')
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('enforces maximum page size of 100', async () => {
    const u = await createUser({ id: 'user-cat-limit' })
    const s = await createShop(u, {
      id: 'shop-cat-limit',
      name: 'Test Shop',
      slug: 'test-shop-cat-limit',
    })
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery-limit' })

    // Insert 5 products
    for (let i = 0; i < 5; i++) {
      await createProduct(s, {
        id: `prod-cat-limit-${i}`,
        name: `Product ${i}`,
        slug: `product-${i}`,
        priceCents: 1000,
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

  it('includes products in descendant categories', async () => {
    const u = await createUser({ id: 'user-cat-desc' })
    const s = await createShop(u, {
      id: 'shop-cat-desc',
      name: 'Test Shop',
      slug: 'test-shop-cat-desc',
    })
    const parent = await createCategory({ name: 'Pottery', slug: 'parent-slug' })
    const child = await createCategory({
      name: 'Ceramics',
      slug: 'child-slug',
      parentId: parent.id,
    })
    const p = await createProduct(s, {
      id: 'prod-cat-desc',
      name: 'Descendant Vase',
      slug: 'descendant-vase',
      priceCents: 2999,
      categoryId: child.id,
    })
    await createProductImage(p, {
      id: 'img-cat',
      url: 'https://example.com/category.jpg',
      sortOrder: 0,
    })

    const result = await listProductsByCategorySlugQuery('parent-slug')
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Descendant Vase')
    expect(result.products[0].imageUrl).toBe('https://example.com/category.jpg')
    expect(result.total).toBe(1)
  })

  describe('browsing options', () => {
    async function seedPricedCategory() {
      const u = await createUser({ id: 'user-cat-opts' })
      const s = await createShop(u, { id: 'shop-cat-opts', slug: 'shop-cat-opts' })
      const parent = await createCategory({ name: 'Opts', slug: 'opts-parent' })
      const child = await createCategory({
        name: 'Opts Child',
        slug: 'opts-child',
        parentId: parent.id,
      })
      // Cheapest sits in the child category, so sorting and descendant
      // inclusion are exercised by the same fixture.
      await createProduct(s, {
        id: 'prod-opts-cheap',
        name: 'Cheap',
        slug: 'opts-cheap',
        priceCents: 1000,
        stockCount: 5,
        categoryId: child.id,
      })
      await createProduct(s, {
        id: 'prod-opts-mid',
        name: 'Mid',
        slug: 'opts-mid',
        priceCents: 5000,
        stockCount: 0,
        categoryId: parent.id,
      })
      await createProduct(s, {
        id: 'prod-opts-dear',
        name: 'Dear',
        slug: 'opts-dear',
        priceCents: 9000,
        stockCount: 2,
        categoryId: parent.id,
      })
    }

    it('sorts by price ascending and descending', async () => {
      await seedPricedCategory()

      const asc = await listProductsByCategorySlugQuery(
        'opts-parent',
        { page: 1, pageSize: 20 },
        { sort: 'price_asc' },
      )
      expect(asc.products.map((p) => p.name)).toEqual(['Cheap', 'Mid', 'Dear'])

      const desc = await listProductsByCategorySlugQuery(
        'opts-parent',
        { page: 1, pageSize: 20 },
        { sort: 'price_desc' },
      )
      expect(desc.products.map((p) => p.name)).toEqual(['Dear', 'Mid', 'Cheap'])
    })

    it('orders deterministically by default, so paging cannot repeat or skip', async () => {
      await seedPricedCategory()

      // The previous implementation issued no ORDER BY at all, leaving row
      // order up to PostgreSQL. Two identical reads must agree.
      const first = await listProductsByCategorySlugQuery('opts-parent')
      const second = await listProductsByCategorySlugQuery('opts-parent')

      expect(first.products.map((p) => p.id)).toEqual(second.products.map((p) => p.id))

      const pageOne = await listProductsByCategorySlugQuery('opts-parent', {
        page: 1,
        pageSize: 2,
      })
      const pageTwo = await listProductsByCategorySlugQuery('opts-parent', {
        page: 2,
        pageSize: 2,
      })
      const seen = [...pageOne.products, ...pageTwo.products].map((p) => p.id)
      expect(new Set(seen).size).toBe(3)
    })

    it('filters by price bounds', async () => {
      await seedPricedCategory()

      const result = await listProductsByCategorySlugQuery(
        'opts-parent',
        { page: 1, pageSize: 20 },
        { minPriceCents: 2000, maxPriceCents: 8000 },
      )

      expect(result.products.map((p) => p.name)).toEqual(['Mid'])
      expect(result.total).toBe(1)
    })

    it('filters out-of-stock products, matching search semantics', async () => {
      await seedPricedCategory()

      const result = await listProductsByCategorySlugQuery(
        'opts-parent',
        { page: 1, pageSize: 20 },
        { inStockOnly: true },
      )

      expect(result.products.map((p) => p.name).sort()).toEqual(['Cheap', 'Dear'])
    })

    it('keeps descendant products under every filter combination', async () => {
      await seedPricedCategory()

      // The regression that consolidation could have introduced: routing this
      // through `buildProductWhere`'s exact-match `categorySlug` filter would
      // silently drop the child-category product.
      const result = await listProductsByCategorySlugQuery(
        'opts-parent',
        { page: 1, pageSize: 20 },
        { sort: 'price_asc', inStockOnly: true },
      )

      expect(result.products.map((p) => p.name)).toEqual(['Cheap', 'Dear'])
    })
  })
})

describe('getProductBySlugQuery', () => {
  it('returns product by slug with images ordered by sortOrder', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery' })
    const p = await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      categoryId: cat.id,
    })

    await createProductImage(p, {
      id: 'img-1',
      url: 'http://example.com/1.jpg',
      altText: 'First',
      sortOrder: 1,
    })
    await createProductImage(p, {
      id: 'img-2',
      url: 'http://example.com/2.jpg',
      altText: 'Second',
      sortOrder: 0,
    })

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
    expect(result?.imageUrl).toBe('http://example.com/2.jpg')
  })

  it('retains dispatch days after an address-only settings update', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      shippingOrigin: encryptJsonb({
        street: '1 Old Lane',
        city: 'Lyon',
        postalCode: '69001',
        country: 'FR',
        processingTimeDays: { min: 2, max: 4 },
        shipsInternational: true,
      }),
    })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
    })

    await updateShopInternal(s.id, {
      shippingOrigin: {
        street: '2 New Lane',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
    })

    const result = await getProductBySlugQuery('test-shop', 'vase')

    expect(result?.dispatchDays).toEqual({ min: 2, max: 4 })
  })

  it('returns null for nonexistent product', async () => {
    const result = await getProductBySlugQuery('test-shop', 'nonexistent-slug')
    expect(result).toBeNull()
  })

  it('returns null imageUrl when product has no images', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    await createProduct(s, {
      id: 'prod-no-img',
      name: 'Plain Vase',
      slug: 'plain-vase',
      priceCents: 2999,
    })

    const result = await getProductBySlugQuery('test-shop', 'plain-vase')
    expect(result).not.toBeNull()
    expect(result?.imageUrl).toBeNull()
    expect(result?.images).toEqual([])
  })

  it('returns null when shop is suspended', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      isSuspended: true,
    })
    await createProduct(s, { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999 })

    const result = await getProductBySlugQuery('test-shop', 'vase')
    expect(result).toBeNull()
  })

  it('returns null when product is inactive', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      isActive: false,
    })

    const result = await getProductBySlugQuery('test-shop', 'vase')
    expect(result).toBeNull()
  })
})

describe('listProductsQuery', () => {
  async function seedShopAndProducts() {
    const u = await createUser({ id: 'user-1' })
    const s1 = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop 1',
      slug: 'test-shop-1',
    })
    const s2 = await createShop(u, {
      id: 'shop-2',
      name: 'Test Shop 2',
      slug: 'test-shop-2',
    })
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery' })

    await createProduct(s1, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      categoryId: cat.id,
    })
    await createProduct(s1, {
      id: 'prod-2',
      name: 'Bowl',
      slug: 'bowl',
      priceCents: 1999,
      categoryId: cat.id,
    })
    await createProduct(s2, {
      id: 'prod-3',
      name: 'Plate',
      slug: 'plate',
      priceCents: 4999,
      categoryId: cat.id,
    })

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

  it('returns imageUrl for products with a primary image', async () => {
    const u = await createUser({ id: 'user-img' })
    const s = await createShop(u, { id: 'shop-img', name: 'Image Shop', slug: 'image-shop' })
    const p = await createProduct(s, {
      id: 'prod-img',
      name: 'Pictured Vase',
      slug: 'pictured-vase',
      priceCents: 2999,
    })
    await createProductImage(p, {
      id: 'img-primary',
      url: 'https://example.com/primary.jpg',
      sortOrder: 0,
    })

    const result = await listProductsQuery()
    const product = result.products.find((p) => p.id === 'prod-img')
    expect(product).toBeDefined()
    expect(product?.imageUrl).toBe('https://example.com/primary.jpg')
  })

  it('returns null imageUrl when product has no images', async () => {
    const u = await createUser({ id: 'user-no-img' })
    const s = await createShop(u, {
      id: 'shop-no-img',
      name: 'No Image Shop',
      slug: 'no-image-shop',
    })
    await createProduct(s, {
      id: 'prod-no-img',
      name: 'Plain Vase',
      slug: 'plain-vase',
      priceCents: 2999,
    })

    const result = await listProductsQuery()
    const product = result.products.find((p) => p.id === 'prod-no-img')
    expect(product).toBeDefined()
    expect(product?.imageUrl).toBeNull()
  })
})

describe('getProductsByShopSlugQuery', () => {
  it('returns paginated active products for a shop', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    await createProduct(s, { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999 })
    await createProduct(s, { id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 1999 })

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
    const u = await createUser({ id: 'user-1' })
    await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      isSuspended: true,
    })

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
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })

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
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })

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
    const u = await createUser({ id: 'user-1' })
    const s1 = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop 1',
      slug: 'test-shop-1',
    })
    const s2 = await createShop(u, {
      id: 'shop-2',
      name: 'Test Shop 2',
      slug: 'test-shop-2',
    })

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
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })

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
    const u = await createUser({ id: 'user-1' })
    await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      description: 'A test shop',
      slug: 'test-shop',
    })

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
    const u = await createUser({ id: 'user-1' })
    await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      isSuspended: true,
    })

    const result = await getShopBySlugQuery('test-shop')
    expect(result).toBeNull()
  })
})

describe('getShopProductsQuery', () => {
  async function seedShopWithProducts() {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })

    await createProduct(s, {
      id: 'prod-1',
      name: 'Ceramic Vase',
      slug: 'ceramic-vase',
      priceCents: 2999,
    })
    await createProduct(s, {
      id: 'prod-2',
      name: 'Wooden Bowl',
      slug: 'wooden-bowl',
      priceCents: 1999,
    })
    await createProduct(s, {
      id: 'prod-3',
      name: 'Glass Plate',
      slug: 'glass-plate',
      priceCents: 4999,
      isActive: false,
    })

    return { shop: s }
  }

  it('returns paginated active products for a shop', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', {
      pagination: { page: 1, pageSize: 10 },
    })
    expect(result.products).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.products.every((p) => p.shopSlug === 'test-shop')).toBe(true)
  })

  it('filters products by case-insensitive partial name search', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', {
      search: 'vase',
      pagination: { page: 1, pageSize: 10 },
    })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Ceramic Vase')
  })

  it('search is case-insensitive', async () => {
    await seedShopWithProducts()

    const lowerResult = await getShopProductsQuery('test-shop', {
      search: 'bowl',
      pagination: { page: 1, pageSize: 10 },
    })
    expect(lowerResult.products).toHaveLength(1)
    expect(lowerResult.products[0].name).toBe('Wooden Bowl')

    const upperResult = await getShopProductsQuery('test-shop', {
      search: 'BOWL',
      pagination: { page: 1, pageSize: 10 },
    })
    expect(upperResult.products).toHaveLength(1)
    expect(upperResult.products[0].name).toBe('Wooden Bowl')
  })

  it('search matches partial names', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', {
      search: 'cer',
      pagination: { page: 1, pageSize: 10 },
    })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Ceramic Vase')
  })

  it('returns empty array when search matches nothing', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', {
      search: 'xyz',
      pagination: { page: 1, pageSize: 10 },
    })
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('excludes inactive products', async () => {
    await seedShopWithProducts()

    const result = await getShopProductsQuery('test-shop', {
      pagination: { page: 1, pageSize: 10 },
    })
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
    const u = await createUser({ id: 'user-1' })
    await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      isSuspended: true,
    })

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

    const result = await getShopProductsQuery('test-shop', { pagination: { page: 1, pageSize: 1 } })
    expect(result.products).toHaveLength(1)
    expect(result.total).toBe(2)
    expect(result.totalPages).toBe(2)
  })

  it('returns imageUrl for products with a primary image', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, {
      id: 'prod-img',
      name: 'Pictured Vase',
      slug: 'pictured-vase',
      priceCents: 2999,
    })
    await createProductImage(p, {
      id: 'img-shop',
      url: 'https://example.com/shop-image.jpg',
      sortOrder: 0,
    })

    const result = await getShopProductsQuery('test-shop', {
      pagination: { page: 1, pageSize: 10 },
    })
    const product = result.products.find((p) => p.id === 'prod-img')
    expect(product).toBeDefined()
    expect(product?.imageUrl).toBe('https://example.com/shop-image.jpg')
  })

  describe('browsing filters', () => {
    async function seedShopForBrowsing() {
      const u = await createUser({ id: 'user-1' })
      const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
      const ceramics = await createCategory({ name: 'Ceramics', slug: 'ceramics' })
      const textiles = await createCategory({ name: 'Textiles', slug: 'textiles' })

      await createProduct(s, {
        id: 'prod-cheap',
        name: 'Small Cup',
        slug: 'small-cup',
        priceCents: 900,
        stockCount: 4,
        categoryId: ceramics.id,
      })
      await createProduct(s, {
        id: 'prod-dear',
        name: 'Large Vase',
        slug: 'large-vase',
        priceCents: 8000,
        stockCount: 0,
        categoryId: ceramics.id,
      })
      await createProduct(s, {
        id: 'prod-scarf',
        name: 'Wool Scarf',
        slug: 'wool-scarf',
        priceCents: 3000,
        stockCount: 2,
        categoryId: textiles.id,
      })

      return { shop: s }
    }

    it('filters to a single category', async () => {
      await seedShopForBrowsing()

      const result = await getShopProductsQuery('test-shop', { categorySlug: 'textiles' })
      expect(result.products.map((p) => p.id)).toEqual(['prod-scarf'])
      expect(result.total).toBe(1)
    })

    it('filters to products with stock on the product row', async () => {
      await seedShopForBrowsing()

      const result = await getShopProductsQuery('test-shop', { inStockOnly: true })
      expect(result.products.map((p) => p.id).sort()).toEqual(['prod-cheap', 'prod-scarf'])
      expect(result.total).toBe(2)
    })

    it('uses the same in-stock definition as search', async () => {
      await seedShopForBrowsing()

      const [storefront, search] = await Promise.all([
        getShopProductsQuery('test-shop', { inStockOnly: true }),
        searchProductsQuery(undefined, { shopSlug: 'test-shop', inStockOnly: true }),
      ])
      expect(storefront.products.map((p) => p.id).sort()).toEqual(
        search.products.map((p) => p.id).sort(),
      )
    })

    it('sorts by price in both directions', async () => {
      await seedShopForBrowsing()

      const ascending = await getShopProductsQuery('test-shop', { sort: 'price_asc' })
      expect(ascending.products.map((p) => p.priceCents)).toEqual([900, 3000, 8000])

      const descending = await getShopProductsQuery('test-shop', { sort: 'price_desc' })
      expect(descending.products.map((p) => p.priceCents)).toEqual([8000, 3000, 900])
    })

    it('combines a filter with a search term', async () => {
      await seedShopForBrowsing()

      const result = await getShopProductsQuery('test-shop', {
        search: 'cup',
        categorySlug: 'ceramics',
        inStockOnly: true,
      })
      expect(result.products.map((p) => p.id)).toEqual(['prod-cheap'])
    })

    it('counts the filtered total, not the whole catalogue', async () => {
      await seedShopForBrowsing()

      const result = await getShopProductsQuery('test-shop', {
        categorySlug: 'ceramics',
        pagination: { page: 1, pageSize: 1 },
      })
      expect(result.total).toBe(2)
      expect(result.totalPages).toBe(2)
      expect(result.products).toHaveLength(1)
    })
  })
})

describe('getShopProductCategoriesQuery', () => {
  it('returns only the categories the shop actually uses, sorted by name', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    const textiles = await createCategory({ name: 'Textiles', slug: 'textiles' })
    const ceramics = await createCategory({ name: 'Ceramics', slug: 'ceramics' })
    await createCategory({ name: 'Unused', slug: 'unused' })

    await createProduct(s, { slug: 'a', categoryId: textiles.id })
    await createProduct(s, { slug: 'b', categoryId: ceramics.id })
    await createProduct(s, { slug: 'c', categoryId: ceramics.id })

    const result = await getShopProductCategoriesQuery('test-shop')
    expect(result.map((c) => c.slug)).toEqual(['ceramics', 'textiles'])
  })

  it('ignores another shop’s categories', async () => {
    const u = await createUser({ id: 'user-1' })
    const mine = await createShop(u, { id: 'shop-1', name: 'Mine', slug: 'test-shop' })
    const theirs = await createShop(u, { id: 'shop-2', name: 'Theirs', slug: 'other-shop' })
    const ceramics = await createCategory({ name: 'Ceramics', slug: 'ceramics' })
    const textiles = await createCategory({ name: 'Textiles', slug: 'textiles' })

    await createProduct(mine, { slug: 'a', categoryId: ceramics.id })
    await createProduct(theirs, { slug: 'b', categoryId: textiles.id })

    const result = await getShopProductCategoriesQuery('test-shop')
    expect(result.map((c) => c.slug)).toEqual(['ceramics'])
  })

  it('ignores categories reachable only through hidden products', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    const ceramics = await createCategory({ name: 'Ceramics', slug: 'ceramics' })
    const drafts = await createCategory({ name: 'Drafts', slug: 'drafts' })
    const archived = await createCategory({ name: 'Archived', slug: 'archived' })

    await createProduct(s, { slug: 'a', categoryId: ceramics.id })
    await createProduct(s, { slug: 'b', categoryId: drafts.id, status: 'draft' })
    await createProduct(s, { slug: 'c', categoryId: archived.id, isActive: false })

    const result = await getShopProductCategoriesQuery('test-shop')
    expect(result.map((c) => c.slug)).toEqual(['ceramics'])
  })

  it('returns nothing for a suspended shop', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      isSuspended: true,
    })
    const ceramics = await createCategory({ name: 'Ceramics', slug: 'ceramics' })
    await createProduct(s, { slug: 'a', categoryId: ceramics.id })

    expect(await getShopProductCategoriesQuery('test-shop')).toEqual([])
  })

  it('returns nothing for a shop with no categorised products', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    await createProduct(s, { slug: 'a' })

    expect(await getShopProductCategoriesQuery('test-shop')).toEqual([])
  })
})

describe('listRecentProductsQuery', () => {
  it('includes the primary image for each product', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
    })

    await createProductImage(p, {
      id: 'img-1',
      url: 'http://example.com/1.jpg',
      altText: 'First',
      sortOrder: 1,
    })
    await createProductImage(p, {
      id: 'img-2',
      url: 'http://example.com/2.jpg',
      altText: 'Second',
      sortOrder: 0,
    })

    const result = await listRecentProductsQuery(8)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Vase')
    expect(result[0].image).not.toBeNull()
    expect(result[0].image?.id).toBe('img-2')
    expect(result[0].image?.url).toBe('http://example.com/2.jpg')
    expect(result[0].image?.sortOrder).toBe(0)
    expect(result[0].imageUrl).toBe('http://example.com/2.jpg')
  })

  it('returns null image when product has no images', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
    })

    const result = await listRecentProductsQuery(8)
    expect(result).toHaveLength(1)
    expect(result[0].image).toBeNull()
    expect(result[0].imageUrl).toBeNull()
  })

  it('excludes products from suspended shops', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      isSuspended: true,
    })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
    })

    const result = await listRecentProductsQuery(8)
    expect(result).toHaveLength(0)
  })

  it('excludes inactive products', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
    await createProduct(s, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      isActive: false,
    })

    const result = await listRecentProductsQuery(8)
    expect(result).toHaveLength(0)
  })
})

describe('getFeaturedShopsQuery', () => {
  it('returns active shops ordered by newest first with productCount', async () => {
    const u = await createUser({ id: 'user-1' })
    const s1 = await createShop(u, {
      id: 'shop-1',
      name: 'Old Shop',
      slug: 'old-shop',
      createdAt: new Date(Date.now() - 1000),
    })
    const s2 = await createShop(u, {
      id: 'shop-2',
      name: 'New Shop',
      slug: 'new-shop',
      createdAt: new Date(),
    })

    await createProduct(s1, { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999 })
    await createProduct(s2, { id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 1999 })
    await createProduct(s2, { id: 'prod-3', name: 'Plate', slug: 'plate', priceCents: 4999 })

    const result = await getFeaturedShopsQuery(10)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('New Shop')
    expect(result[0].productCount).toBe(2)
    expect(result[1].name).toBe('Old Shop')
    expect(result[1].productCount).toBe(1)
  })

  it('excludes suspended shops', async () => {
    const u = await createUser({ id: 'user-1' })
    await createShop(u, { id: 'shop-1', name: 'Active Shop', slug: 'active-shop' })
    await createShop(u, {
      id: 'shop-2',
      name: 'Suspended Shop',
      slug: 'suspended-shop',
      isSuspended: true,
    })

    const result = await getFeaturedShopsQuery(10)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Active Shop')
  })

  it('returns shops with zero products', async () => {
    const u = await createUser({ id: 'user-1' })
    await createShop(u, { id: 'shop-1', name: 'Empty Shop', slug: 'empty-shop' })

    const result = await getFeaturedShopsQuery(10)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Empty Shop')
    expect(result[0].productCount).toBe(0)
  })

  it('respects the limit', async () => {
    const u = await createUser({ id: 'user-1' })
    await createShop(u, { id: 'shop-1', name: 'Shop 1', slug: 'shop-1' })
    await createShop(u, { id: 'shop-2', name: 'Shop 2', slug: 'shop-2' })
    await createShop(u, { id: 'shop-3', name: 'Shop 3', slug: 'shop-3' })

    const result = await getFeaturedShopsQuery(2)
    expect(result).toHaveLength(2)
  })
})

describe('product database constraints', () => {
  it('enforces unique slug within the same shop', async () => {
    const u = await createUser({ id: 'user-1' })
    const s = await createShop(u, { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })

    await createProduct(s, { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999 })

    await expect(
      createProduct(s, {
        id: 'prod-2',
        name: 'Another Vase',
        slug: 'vase',
        priceCents: 3999,
      }),
    ).rejects.toThrow()
  })

  it('allows duplicate slug across different shops at database level', async () => {
    const u = await createUser({ id: 'user-1' })
    const s1 = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop 1',
      slug: 'test-shop-1',
    })
    const s2 = await createShop(u, {
      id: 'shop-2',
      name: 'Test Shop 2',
      slug: 'test-shop-2',
    })

    await createProduct(s1, { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999 })

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
    const u = await createUser({ id: 'user-1' })
    const s1 = await createShop(u, {
      id: 'shop-1',
      name: 'Test Shop 1',
      slug: 'test-shop-1',
    })
    const s2 = await createShop(u, {
      id: 'shop-2',
      name: 'Test Shop 2',
      slug: 'test-shop-2',
    })
    const c1 = await createCategory({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Pottery',
      slug: 'pottery',
    })
    const c2 = await createCategory({
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Tableware',
      slug: 'tableware',
    })

    await createProduct(s1, {
      id: 'prod-1',
      name: 'Ceramic Vase',
      slug: 'ceramic-vase',
      priceCents: 2999,
      categoryId: c1.id,
    })
    await createProduct(s1, {
      id: 'prod-2',
      name: 'Wooden Bowl',
      slug: 'wooden-bowl',
      priceCents: 1999,
      categoryId: c2.id,
    })
    await createProduct(s2, {
      id: 'prod-3',
      name: 'Glass Plate',
      slug: 'glass-plate',
      priceCents: 4999,
      categoryId: c2.id,
    })
    await createProduct(s2, {
      id: 'prod-4',
      name: 'vase-like',
      slug: 'vase-like',
      priceCents: 999,
      categoryId: c1.id,
    })

    return { s1, s2, c1, c2 }
  }

  it('matches Dutch inflections that the English stemmer leaves intact', async () => {
    const u = await createUser({ id: 'user-nl' })
    const s = await createShop(u, { id: 'shop-nl', name: 'Wolwinkel', slug: 'wolwinkel' })
    await createProduct(s, {
      id: 'prod-nl',
      name: 'Wollen sokken',
      slug: 'wollen-sokken',
      priceCents: 1500,
    })

    // "sokken" only reduces to "sok" under the Dutch dictionary.
    const result = await searchProductsQuery('sok', {}, 'relevance', { page: 1, pageSize: 10 })

    expect(result.products.map((p) => p.id)).toContain('prod-nl')
  })

  it('filters out sold-out products when inStockOnly is set', async () => {
    const u = await createUser({ id: 'user-stock' })
    const s = await createShop(u, { id: 'shop-stock', name: 'Stock', slug: 'stock' })
    await createProduct(s, {
      id: 'prod-in-stock',
      name: 'Available Lamp',
      slug: 'available-lamp',
      priceCents: 1000,
      stockCount: 4,
    })
    await createProduct(s, {
      id: 'prod-sold-out',
      name: 'Sold Out Lamp',
      slug: 'sold-out-lamp',
      priceCents: 1000,
      stockCount: 0,
    })

    const all = await searchProductsQuery('lamp', {}, 'relevance', { page: 1, pageSize: 10 })
    expect(all.products.map((p) => p.id)).toEqual(
      expect.arrayContaining(['prod-in-stock', 'prod-sold-out']),
    )

    const inStock = await searchProductsQuery('lamp', { inStockOnly: true }, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(inStock.products.map((p) => p.id)).toEqual(['prod-in-stock'])
  })

  it('returns products matching case-insensitive name', async () => {
    await seedSearchProducts()

    const result = await searchProductsQuery('vase', {}, 'relevance', { page: 1, pageSize: 10 })
    expect(result.products).toHaveLength(2)
    expect(result.products.map((p) => p.name)).toContain('Ceramic Vase')
    expect(result.products.map((p) => p.name)).toContain('vase-like')
  })

  it('returns imageUrl for products with a primary image', async () => {
    const u = await createUser({ id: 'user-search-img' })
    const s = await createShop(u, {
      id: 'shop-search-img',
      name: 'Search Image Shop',
      slug: 'search-image-shop',
    })
    const cat = await createCategory({ name: 'Searchables', slug: 'searchables' })
    const p = await createProduct(s, {
      id: 'prod-search-img',
      name: 'Searchable Vase',
      slug: 'searchable-vase',
      priceCents: 2999,
      categoryId: cat.id,
    })
    await createProductImage(p, {
      id: 'img-search',
      url: 'https://example.com/search.jpg',
      sortOrder: 0,
    })

    const result = await searchProductsQuery('Searchable Vase', {}, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].imageUrl).toBe('https://example.com/search.jpg')
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
    const u = await createUser({
      id: `user-${status}`,
      name: 'Test Creator',
      email: `creator-${status}@example.com`,
    })
    const s = await createShop(u, {
      id: `shop-${status}`,
      name: `Shop ${status}`,
      slug: `shop-${status}`,
      status,
    })
    const cat = await createCategory({
      name: `Category ${status}`,
      slug: `cat-${status}`,
    })
    const p1 = await createProduct(s, {
      id: `prod-${status}-active`,
      name: `Product Active ${status}`,
      slug: `prod-active-${status}`,
      priceCents: 1000,
      stockCount: 10,
      isActive: true,
      categoryId: cat.id,
    })
    const p2 = await createProduct(s, {
      id: `prod-${status}-inactive`,
      name: `Product Inactive ${status}`,
      slug: `prod-inactive-${status}`,
      priceCents: 2000,
      stockCount: 5,
      isActive: false,
      categoryId: cat.id,
    })

    return { user: u, shop: s, activeProduct: p1, inactiveProduct: p2 }
  }

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
      const u = await createUser({
        id: `user-limit-${i}`,
        name: 'Test Creator',
        email: `creator-limit-${i}@example.com`,
      })
      await createShop(u, {
        id: `shop-limit-${i}`,
        name: `Shop ${i}`,
        slug: `shop-limit-${i}`,
        status: 'active',
      })
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

describe('getMarketplaceStatsQuery', () => {
  async function seedShopWithOrigin(
    slug: string,
    origin: { country: string },
    overrides?: Partial<typeof shop.$inferInsert>,
  ) {
    await createShop('user-1', {
      id: slug,
      name: slug,
      slug,
      status: 'active',
      shippingOrigin: origin,
      ...overrides,
    })
  }

  it('counts active sellers, products, and distinct countries', async () => {
    await createUser({
      id: 'user-1',
      name: 'Creator',
      email: 'creator@example.com',
    })

    await seedShopWithOrigin('shop-de', { country: 'DE' })
    await seedShopWithOrigin('shop-fr', { country: 'FR' })
    await seedShopWithOrigin('shop-none', { country: 'DE' }, { status: 'pending_review' })

    await createProduct('shop-de', {
      id: 'prod-1',
      name: 'A',
      slug: 'a',
      priceCents: 1000,
      stockCount: 1,
    })
    await createProduct('shop-de', {
      id: 'prod-2',
      name: 'B',
      slug: 'b',
      priceCents: 1000,
      stockCount: 1,
    })
    await createProduct('shop-fr', {
      id: 'prod-3',
      name: 'C',
      slug: 'c',
      priceCents: 1000,
      stockCount: 1,
      isActive: false,
    })

    const stats = await getMarketplaceStatsQuery()
    expect(stats.sellerCount).toBe(2)
    expect(stats.productCount).toBe(2)
    expect(stats.countryCount).toBe(2)
  })
})

describe('getMoreFromShopQuery', () => {
  it('excludes the product the buyer is already looking at', async () => {
    const u = await createUser({ id: 'user-rail' })
    const s = await createShop(u, { id: 'shop-rail', name: 'Rail', slug: 'shop-rail' })
    const current = await createProduct(s, { id: 'prod-rail-current' })
    await createProduct(s, { id: 'prod-rail-other' })

    const result = await getMoreFromShopQuery('shop-rail', current.id)

    expect(result.map((p) => p.id)).toEqual(['prod-rail-other'])
  })

  it('returns nothing when the shop has only this product', async () => {
    const u = await createUser({ id: 'user-rail-solo' })
    const s = await createShop(u, { id: 'shop-rail-solo', name: 'Solo', slug: 'shop-rail-solo' })
    const only = await createProduct(s, { id: 'prod-rail-solo' })

    expect(await getMoreFromShopQuery('shop-rail-solo', only.id)).toEqual([])
  })

  it('never offers a draft or deactivated product', async () => {
    // Inherited from `listProductsQuery` rather than reimplemented, which is the
    // point of routing through it — the category page's hand-rolled query is
    // what got these wrong.
    const u = await createUser({ id: 'user-rail-hidden' })
    const s = await createShop(u, { id: 'shop-rail-hidden', name: 'H', slug: 'shop-rail-hidden' })
    const current = await createProduct(s, { id: 'prod-rail-h-current' })
    await createProduct(s, { id: 'prod-rail-h-draft', status: 'draft' })
    await createProduct(s, { id: 'prod-rail-h-inactive', isActive: false })
    await createProduct(s, { id: 'prod-rail-h-ok' })

    const result = await getMoreFromShopQuery('shop-rail-hidden', current.id)

    expect(result.map((p) => p.id)).toEqual(['prod-rail-h-ok'])
  })

  it('caps the rail at the requested size', async () => {
    const u = await createUser({ id: 'user-rail-cap' })
    const s = await createShop(u, { id: 'shop-rail-cap', name: 'Cap', slug: 'shop-rail-cap' })
    const current = await createProduct(s, { id: 'prod-rail-cap-current' })
    for (let i = 0; i < 6; i++) {
      await createProduct(s, { id: `prod-rail-cap-${i}` })
    }

    expect(await getMoreFromShopQuery('shop-rail-cap', current.id, 4)).toHaveLength(4)
  })
})
