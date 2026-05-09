import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { categories, product, productImage, shop, user } from '#/db/schema'

import {
  configureProductsIndex,
  PRODUCTS_INDEX,
  populateProductsIndex,
  removeProductFromMeilisearch,
  removeShopProductsFromMeilisearch,
  searchProductsMeilisearch,
  syncProductToMeilisearch,
} from './meilisearch-products.server'

const {
  mockAddDocuments,
  mockUpdateSettings,
  mockDeleteDocument,
  mockDeleteDocuments,
  mockSearch,
  mockHealth,
} = vi.hoisted(() => ({
  mockAddDocuments: vi.fn().mockResolvedValue(undefined),
  mockUpdateSettings: vi.fn().mockResolvedValue(undefined),
  mockDeleteDocument: vi.fn().mockResolvedValue(undefined),
  mockDeleteDocuments: vi.fn().mockResolvedValue(undefined),
  mockSearch: vi.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 }),
  mockHealth: vi.fn().mockResolvedValue({ status: 'available' }),
}))

vi.mock('./meilisearch.server', () => ({
  meilisearch: {
    index: vi.fn(() => ({
      addDocuments: mockAddDocuments,
      updateSettings: mockUpdateSettings,
      deleteDocument: mockDeleteDocument,
      deleteDocuments: mockDeleteDocuments,
      search: mockSearch,
    })),
    health: mockHealth,
  },
  isMeilisearchConfigured: vi.fn().mockReturnValue(true),
}))

beforeEach(async () => {
  await db.delete(productImage)
  await db.delete(product)
  await db.delete(categories)
  await db.delete(shop)
  await db.delete(user)

  mockAddDocuments.mockClear()
  mockUpdateSettings.mockClear()
  mockDeleteDocument.mockClear()
  mockDeleteDocuments.mockClear()
  mockSearch.mockClear()
  mockHealth.mockClear()
  mockHealth.mockResolvedValue({ status: 'available' })
})

/* -------------------------------------------------------------------------- */
/*                              Index Configuration                           */
/* -------------------------------------------------------------------------- */

describe('configureProductsIndex', () => {
  it('updates index settings with correct attributes', async () => {
    const { meilisearch } = await import('./meilisearch.server')
    await configureProductsIndex()

    expect(meilisearch?.index).toHaveBeenCalledWith(PRODUCTS_INDEX)
    const index = meilisearch?.index(PRODUCTS_INDEX)
    expect(index!.updateSettings).toHaveBeenCalledWith({
      searchableAttributes: ['name', 'description'],
      filterableAttributes: [
        'categoryId',
        'shopId',
        'priceCents',
        'isActive',
        'shopSlug',
        'categorySlug',
      ],
      sortableAttributes: ['priceCents', 'createdAt'],
    })
  })
})

/* -------------------------------------------------------------------------- */
/*                              Sync Product                                  */
/* -------------------------------------------------------------------------- */

describe('syncProductToMeilisearch', () => {
  async function seedShopAndProduct(
    overrides: { shopSuspended?: boolean; productActive?: boolean; categoryId?: string } = {},
  ) {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
        isSuspended: overrides.shopSuspended ?? false,
      })
      .returning()

    let catId: string | undefined
    if (overrides.categoryId !== undefined) {
      const [cat] = await db
        .insert(categories)
        .values({ id: overrides.categoryId, name: 'Pottery', slug: 'pottery' })
        .returning()
      catId = cat.id
    }

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        categoryId: catId ?? null,
        isActive: overrides.productActive ?? true,
      })
      .returning()

    return { shop: s, product: p, categoryId: catId }
  }

  it('adds an active product from a non-suspended shop to the index', async () => {
    const { product: p } = await seedShopAndProduct({
      categoryId: '550e8400-e29b-41d4-a716-446655440001',
    })

    await syncProductToMeilisearch(p)

    expect(mockAddDocuments).toHaveBeenCalledTimes(1)
    const doc = mockAddDocuments.mock.calls[0][0][0]
    expect(doc.id).toBe('prod-1')
    expect(doc.name).toBe('Vase')
    expect(doc.priceCents).toBe(2999)
    expect(doc.isActive).toBe(true)
    expect(doc.shopSlug).toBe('test-shop')
    expect(doc.categorySlug).toBe('pottery')
  })

  it('removes product from index when product is inactive', async () => {
    const { product: p } = await seedShopAndProduct({ productActive: false })

    await syncProductToMeilisearch(p)

    expect(mockDeleteDocument).toHaveBeenCalledWith('prod-1')
    expect(mockAddDocuments).not.toHaveBeenCalled()
  })

  it('removes product from index when shop is suspended', async () => {
    const { product: p } = await seedShopAndProduct({ shopSuspended: true })

    await syncProductToMeilisearch(p)

    expect(mockDeleteDocument).toHaveBeenCalledWith('prod-1')
    expect(mockAddDocuments).not.toHaveBeenCalled()
  })

  it('indexes product without category when categoryId is null', async () => {
    const { product: p } = await seedShopAndProduct()

    await syncProductToMeilisearch(p)

    const doc = mockAddDocuments.mock.calls[0][0][0]
    expect(doc.categoryId).toBeNull()
    expect(doc.categorySlug).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*                              Remove Product                                */
/* -------------------------------------------------------------------------- */

describe('removeProductFromMeilisearch', () => {
  it('deletes a single document from the index', async () => {
    await removeProductFromMeilisearch('prod-1')
    expect(mockDeleteDocument).toHaveBeenCalledWith('prod-1')
  })
})

/* -------------------------------------------------------------------------- */
/*                              Remove Shop Products                          */
/* -------------------------------------------------------------------------- */

describe('removeShopProductsFromMeilisearch', () => {
  it('deletes all documents for a shop using filter', async () => {
    await removeShopProductsFromMeilisearch('shop-1')
    expect(mockDeleteDocuments).toHaveBeenCalledWith({ filter: 'shopId = "shop-1"' })
  })
})

/* -------------------------------------------------------------------------- */
/*                              Populate Index                                */
/* -------------------------------------------------------------------------- */

describe('populateProductsIndex', () => {
  async function seedData() {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s1] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Shop 1', slug: 'shop-1', ownerId: u.id })
      .returning()

    const [s2] = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Shop 2', slug: 'shop-2', ownerId: u.id, isSuspended: true })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'Pottery', slug: 'pottery' })
      .returning()

    await db.insert(product).values([
      {
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s1.id,
        categoryId: cat.id,
        isActive: true,
      },
      {
        id: 'prod-2',
        name: 'Bowl',
        slug: 'bowl',
        priceCents: 1999,
        shopId: s1.id,
        isActive: false,
      },
      {
        id: 'prod-3',
        name: 'Plate',
        slug: 'plate',
        priceCents: 4999,
        shopId: s2.id,
        categoryId: cat.id,
        isActive: true,
      },
    ])

    return { s1, s2, cat }
  }

  it('syncs only active products from non-suspended shops', async () => {
    await seedData()

    const result = await populateProductsIndex()
    expect(result.synced).toBe(1)
    expect(result.errors).toBe(0)

    expect(mockAddDocuments).toHaveBeenCalledTimes(1)
    const docs = mockAddDocuments.mock.calls[0][0]
    expect(docs).toHaveLength(1)
    expect(docs[0].id).toBe('prod-1')
  })
})

/* -------------------------------------------------------------------------- */
/*                              Search                                        */
/* -------------------------------------------------------------------------- */

describe('searchProductsMeilisearch', () => {
  async function seedSearchData() {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s1] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Shop 1', slug: 'shop-1', ownerId: u.id })
      .returning()

    const [s2] = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Shop 2', slug: 'shop-2', ownerId: u.id })
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
        isActive: true,
      },
      {
        id: 'prod-2',
        name: 'Wooden Bowl',
        slug: 'wooden-bowl',
        priceCents: 1999,
        shopId: s1.id,
        categoryId: c2.id,
        isActive: true,
      },
      {
        id: 'prod-3',
        name: 'Glass Plate',
        slug: 'glass-plate',
        priceCents: 4999,
        shopId: s2.id,
        categoryId: c2.id,
        isActive: true,
      },
    ])

    return { s1, s2, c1, c2 }
  }

  it('returns null when meilisearch is not available', async () => {
    mockHealth.mockRejectedValueOnce(new Error('down'))

    const result = await searchProductsMeilisearch('vase', {}, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result).toBeNull()
  })

  it('searches meilisearch and hydrates from database', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({
      hits: [{ id: 'prod-1' }],
      estimatedTotalHits: 1,
    })

    const result = await searchProductsMeilisearch('vase', {}, 'relevance', {
      page: 1,
      pageSize: 10,
    })

    expect(result).not.toBeNull()
    expect(result?.products).toHaveLength(1)
    expect(result?.products[0].name).toBe('Ceramic Vase')
    expect(result?.total).toBe(1)
  })

  it('filters by shopSlug', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({
      hits: [{ id: 'prod-1' }, { id: 'prod-2' }],
      estimatedTotalHits: 2,
    })

    const result = await searchProductsMeilisearch(undefined, { shopSlug: 'shop-1' }, 'relevance', {
      page: 1,
      pageSize: 10,
    })

    expect(mockSearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        filter: expect.arrayContaining(['isActive = true', 'shopSlug = "shop-1"']),
      }),
    )
    expect(result?.products).toHaveLength(2)
  })

  it('filters by categorySlug', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({
      hits: [{ id: 'prod-1' }],
      estimatedTotalHits: 1,
    })

    await searchProductsMeilisearch(
      undefined,
      { categorySlug: 'pottery' },
      'relevance',
      {
        page: 1,
        pageSize: 10,
      },
    )

    expect(mockSearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        filter: expect.arrayContaining(['isActive = true', 'categorySlug = "pottery"']),
      }),
    )
  })

  it('filters by price range', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({ hits: [], estimatedTotalHits: 0 })

    await searchProductsMeilisearch(
      undefined,
      { minPriceCents: 1000, maxPriceCents: 3000 },
      'relevance',
      {
        page: 1,
        pageSize: 10,
      },
    )

    expect(mockSearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        filter: expect.arrayContaining([
          'isActive = true',
          'priceCents >= 1000',
          'priceCents <= 3000',
        ]),
      }),
    )
  })

  it('sorts by price ascending', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({ hits: [], estimatedTotalHits: 0 })

    await searchProductsMeilisearch(undefined, {}, 'price_asc', { page: 1, pageSize: 10 })

    expect(mockSearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        sort: ['priceCents:asc'],
      }),
    )
  })

  it('sorts by price descending', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({ hits: [], estimatedTotalHits: 0 })

    await searchProductsMeilisearch(undefined, {}, 'price_desc', { page: 1, pageSize: 10 })

    expect(mockSearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        sort: ['priceCents:desc'],
      }),
    )
  })

  it('sorts by newest', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({ hits: [], estimatedTotalHits: 0 })

    await searchProductsMeilisearch(undefined, {}, 'newest', { page: 1, pageSize: 10 })

    expect(mockSearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        sort: ['createdAt:desc'],
      }),
    )
  })

  it('excludes products from suspended shops when hydrating', async () => {
    const { s1 } = await seedSearchData()

    // Suspend shop-1 after seeding
    await db.update(shop).set({ isSuspended: true }).where(eq(shop.id, s1.id))

    mockSearch.mockResolvedValueOnce({
      hits: [{ id: 'prod-1' }, { id: 'prod-2' }],
      estimatedTotalHits: 2,
    })

    const result = await searchProductsMeilisearch(undefined, {}, 'relevance', {
      page: 1,
      pageSize: 10,
    })

    expect(result?.products).toHaveLength(0)
  })

  it('falls back to null on search error', async () => {
    mockSearch.mockRejectedValueOnce(new Error('search error'))

    const result = await searchProductsMeilisearch('vase', {}, 'relevance', {
      page: 1,
      pageSize: 10,
    })
    expect(result).toBeNull()
  })
})
