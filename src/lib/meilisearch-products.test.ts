import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { meilisearchSyncQueue, shop } from '#/db/schema'

import { clearTestTables } from '#/test/cleanup'
import { createCategory, createProduct, createShop, createUser } from '#/test/factories'

import {
  configureProductsIndex,
  PRODUCTS_INDEX,
  populateProductsIndex,
  processMeilisearchSyncQueue,
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
  mockCreateIndex,
  mockUpdateIndex,
} = vi.hoisted(() => ({
  mockAddDocuments: vi.fn().mockResolvedValue(undefined),
  mockUpdateSettings: vi.fn().mockResolvedValue(undefined),
  mockDeleteDocument: vi.fn().mockResolvedValue(undefined),
  mockDeleteDocuments: vi.fn().mockResolvedValue(undefined),
  mockSearch: vi.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 }),
  mockHealth: vi.fn().mockResolvedValue({ status: 'available' }),
  mockCreateIndex: vi.fn().mockResolvedValue(undefined),
  mockUpdateIndex: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./meilisearch.server', () => ({
  meilisearch: {
    createIndex: mockCreateIndex,
    index: vi.fn(() => ({
      addDocuments: mockAddDocuments,
      updateSettings: mockUpdateSettings,
      deleteDocument: mockDeleteDocument,
      deleteDocuments: mockDeleteDocuments,
      search: mockSearch,
      update: mockUpdateIndex,
    })),
    health: mockHealth,
  },
  isMeilisearchConfigured: vi.fn().mockReturnValue(true),
}))

beforeEach(async () => {
  await clearTestTables()

  mockAddDocuments.mockClear()
  mockUpdateSettings.mockClear()
  mockDeleteDocument.mockClear()
  mockDeleteDocuments.mockClear()
  mockSearch.mockClear()
  mockHealth.mockClear()
  mockCreateIndex.mockClear()
  mockUpdateIndex.mockClear()
  mockHealth.mockResolvedValue({ status: 'available' })
})

/* -------------------------------------------------------------------------- */
/*                              Index Configuration                           */
/* -------------------------------------------------------------------------- */

describe('configureProductsIndex', () => {
  it('updates index settings with correct attributes', async () => {
    const { meilisearch } = await import('./meilisearch.server')
    await configureProductsIndex()

    expect(meilisearch?.createIndex).toHaveBeenCalledWith(PRODUCTS_INDEX, { primaryKey: 'id' })
    expect(meilisearch?.index).toHaveBeenCalledWith(PRODUCTS_INDEX)
    const index = meilisearch?.index(PRODUCTS_INDEX)
    expect(index?.updateSettings).toHaveBeenCalledWith({
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
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      },
    })
  })

  it('attempts to update index primary key if creation fails', async () => {
    const { meilisearch } = await import('./meilisearch.server')
    mockCreateIndex.mockRejectedValueOnce(new Error('Index already exists'))

    await configureProductsIndex()

    expect(meilisearch?.createIndex).toHaveBeenCalledWith(PRODUCTS_INDEX, { primaryKey: 'id' })
    const index = meilisearch?.index(PRODUCTS_INDEX)
    expect(index?.update).toHaveBeenCalledWith({ primaryKey: 'id' })
  })
})

/* -------------------------------------------------------------------------- */
/*                              Sync Product                                  */
/* -------------------------------------------------------------------------- */

async function seedShopAndProduct(
  overrides: { shopSuspended?: boolean; productActive?: boolean; categoryId?: string } = {},
) {
  const u = await createUser({
    id: 'user-1',
    name: 'Test',
    email: 'test@example.com',
    emailVerified: true,
  })

  const s = await createShop(u, {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    isSuspended: overrides.shopSuspended ?? false,
    status: 'active',
  })

  let catId: string | undefined
  if (overrides.categoryId !== undefined) {
    const cat = await createCategory({
      id: overrides.categoryId,
      name: 'Pottery',
      slug: 'pottery',
    })
    catId = cat.id
  }

  const p = await createProduct(s, {
    id: 'prod-1',
    name: 'Vase',
    slug: 'vase',
    priceCents: 2999,
    categoryId: catId ?? null,
    isActive: overrides.productActive ?? true,
  })

  return { shop: s, product: p, categoryId: catId }
}

describe('syncProductToMeilisearch', () => {
  it('adds an active product from a non-suspended shop to the index', async () => {
    const { product: p } = await seedShopAndProduct({
      categoryId: '550e8400-e29b-41d4-a716-446655440001',
    })

    await syncProductToMeilisearch(p)

    expect(mockAddDocuments).toHaveBeenCalledTimes(1)
    const doc = mockAddDocuments.mock.calls[0][0][0]
    expect(doc.id).toBe('prod-1')
    expect(doc.name).toBe('Vase')
    expect(doc.slug).toBe('vase')
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
    const u = await createUser({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      emailVerified: true,
    })

    const s1 = await createShop(u, {
      id: 'shop-1',
      name: 'Shop 1',
      slug: 'shop-1',
      status: 'active',
    })

    const s2 = await createShop(u, {
      id: 'shop-2',
      name: 'Shop 2',
      slug: 'shop-2',
      isSuspended: true,
      status: 'active',
    })

    const cat = await createCategory({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Pottery',
      slug: 'pottery',
    })

    await createProduct(s1, {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      categoryId: cat.id,
      isActive: true,
    })

    await createProduct(s1, {
      id: 'prod-2',
      name: 'Bowl',
      slug: 'bowl',
      priceCents: 1999,
      isActive: false,
    })

    await createProduct(s2, {
      id: 'prod-3',
      name: 'Plate',
      slug: 'plate',
      priceCents: 4999,
      categoryId: cat.id,
      isActive: true,
    })

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
    expect(docs[0].slug).toBe('vase')
  })

  it('streams products in batches without accumulating all docs in memory', async () => {
    const u = await createUser({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      emailVerified: true,
    })

    const s = await createShop(u, {
      id: 'shop-1',
      name: 'Shop 1',
      slug: 'shop-1',
      status: 'active',
    })

    // Seed 5 active products
    for (let i = 0; i < 5; i++) {
      await createProduct(s, {
        name: `Product ${i + 1}`,
        slug: `product-${i + 1}`,
        priceCents: 1000 + i * 100,
        isActive: true,
      })
    }

    const result = await populateProductsIndex(2)
    expect(result.synced).toBe(5)
    expect(result.errors).toBe(0)

    // Should make 3 addDocuments calls: batches of 2, 2, 1
    expect(mockAddDocuments).toHaveBeenCalledTimes(3)
    expect(mockAddDocuments.mock.calls[0][0]).toHaveLength(2)
    expect(mockAddDocuments.mock.calls[1][0]).toHaveLength(2)
    expect(mockAddDocuments.mock.calls[2][0]).toHaveLength(1)
  })
})

/* -------------------------------------------------------------------------- */
/*                              Search                                        */
/* -------------------------------------------------------------------------- */

describe('searchProductsMeilisearch', () => {
  async function seedSearchData() {
    const u = await createUser({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      emailVerified: true,
    })

    const s1 = await createShop(u, {
      id: 'shop-1',
      name: 'Shop 1',
      slug: 'shop-1',
      status: 'active',
    })

    const s2 = await createShop(u, {
      id: 'shop-2',
      name: 'Shop 2',
      slug: 'shop-2',
      status: 'active',
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
      isActive: true,
    })

    await createProduct(s1, {
      id: 'prod-2',
      name: 'Wooden Bowl',
      slug: 'wooden-bowl',
      priceCents: 1999,
      categoryId: c2.id,
      isActive: true,
    })

    await createProduct(s2, {
      id: 'prod-3',
      name: 'Glass Plate',
      slug: 'glass-plate',
      priceCents: 4999,
      categoryId: c2.id,
      isActive: true,
    })

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

  it('escapes double quotes in shopSlug and categorySlug filters', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({ hits: [], estimatedTotalHits: 0 })

    await searchProductsMeilisearch(
      undefined,
      { shopSlug: 'evil" OR isActive = false', categorySlug: 'pot"tery' },
      'relevance',
      { page: 1, pageSize: 10 },
    )

    expect(mockSearch).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        filter: expect.arrayContaining([
          'isActive = true',
          'shopSlug = "evil\\" OR isActive = false"',
          'categorySlug = "pot\\"tery"',
        ]),
      }),
    )
  })

  it('filters by categorySlug', async () => {
    await seedSearchData()

    mockSearch.mockResolvedValueOnce({
      hits: [{ id: 'prod-1' }],
      estimatedTotalHits: 1,
    })

    await searchProductsMeilisearch(undefined, { categorySlug: 'pottery' }, 'relevance', {
      page: 1,
      pageSize: 10,
    })

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

describe('processMeilisearchSyncQueue', () => {
  it('does nothing when the queue is empty', async () => {
    const result = await processMeilisearchSyncQueue()
    expect(result.processedCount).toBe(0)
  })

  it('processes index operations for existing products', async () => {
    const { product: p } = await seedShopAndProduct()

    await db.insert(meilisearchSyncQueue).values({
      productId: p.id,
      action: 'index',
      status: 'pending',
    })

    const result = await processMeilisearchSyncQueue()
    expect(result.processedCount).toBe(1)

    const items = await db.select().from(meilisearchSyncQueue)
    expect(items).toHaveLength(0)
    expect(mockAddDocuments).toHaveBeenCalledTimes(1)
  })

  it('processes index operations for deleted products by calling removeProductFromMeilisearch', async () => {
    await db.insert(meilisearchSyncQueue).values({
      productId: 'nonexistent-prod',
      action: 'index',
      status: 'pending',
    })

    const result = await processMeilisearchSyncQueue()
    expect(result.processedCount).toBe(1)

    const items = await db.select().from(meilisearchSyncQueue)
    expect(items).toHaveLength(0)
    expect(mockDeleteDocument).toHaveBeenCalledTimes(1)
  })

  it('processes delete operations', async () => {
    await db.insert(meilisearchSyncQueue).values({
      productId: 'deleted-prod',
      action: 'delete',
      status: 'pending',
    })

    const result = await processMeilisearchSyncQueue()
    expect(result.processedCount).toBe(1)

    const items = await db.select().from(meilisearchSyncQueue)
    expect(items).toHaveLength(0)
    expect(mockDeleteDocument).toHaveBeenCalledTimes(1)
  })

  it('handles errors by incrementing attempts and calculating backoff', async () => {
    mockDeleteDocument.mockRejectedValueOnce(new Error('Meili down'))

    await db.insert(meilisearchSyncQueue).values({
      productId: 'error-prod',
      action: 'delete',
      status: 'pending',
    })

    const result = await processMeilisearchSyncQueue()
    expect(result.processedCount).toBe(1)

    const [item] = await db.select().from(meilisearchSyncQueue)
    expect(item.status).toBe('pending')
    expect(item.attempts).toBe(1)
    expect(item.lastError).toBe('Meili down')
    expect(item.runAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('marks item as failed after 5 attempts', async () => {
    mockDeleteDocument.mockRejectedValue(new Error('Meili down'))

    const [inserted] = await db
      .insert(meilisearchSyncQueue)
      .values({
        productId: 'failed-prod',
        action: 'delete',
        status: 'pending',
        attempts: 4,
      })
      .returning()

    const result = await processMeilisearchSyncQueue()
    expect(result.processedCount).toBe(1)

    const [item] = await db
      .select()
      .from(meilisearchSyncQueue)
      .where(eq(meilisearchSyncQueue.id, inserted.id))
    expect(item.status).toBe('failed')
    expect(item.attempts).toBe(5)
  })
})
