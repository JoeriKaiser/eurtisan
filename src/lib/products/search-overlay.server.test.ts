import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_OVERLAY_RESULTS, searchOverlayQuery } from './search-overlay.server'

const { mockMultiSearch, mockHealthy, mockFallbackQuery } = vi.hoisted(() => ({
  mockMultiSearch: vi.fn(),
  mockHealthy: vi.fn().mockResolvedValue(true),
  mockFallbackQuery: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

vi.mock('../meilisearch.server', () => ({
  meilisearch: { multiSearch: mockMultiSearch },
}))

vi.mock('./meilisearch.server', () => ({
  isMeilisearchHealthy: mockHealthy,
  PRODUCTS_INDEX: 'products',
}))
vi.mock('./operations.server', () => ({
  searchProductsQuery: mockFallbackQuery,
}))

function hit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    name: 'Ceramic Mug',
    description: 'Handthrown',
    slug: 'ceramic-mug',
    shopSlug: 'atelier',
    shopName: 'Atelier',
    categorySlug: 'pottery',
    categoryName: 'Pottery',
    priceCents: 2400,
    stockCount: 3,
    imageUrl: 'https://cdn.example/mug.jpg',
    weightGrams: 350,
    volumeMl: null,
    soldBy: 'weight',
    ...overrides,
  }
}

describe('searchOverlayQuery', () => {
  it('returns empty without touching any engine for blank input', async () => {
    await expect(searchOverlayQuery('   ')).resolves.toEqual(EMPTY_OVERLAY_RESULTS)
    expect(mockMultiSearch).not.toHaveBeenCalled()
    expect(mockFallbackQuery).not.toHaveBeenCalled()
  })

  it('maps Meilisearch hits, highlighting, and facets into the overlay shape', async () => {
    mockMultiSearch.mockResolvedValueOnce({
      results: [
        {
          hits: [hit({ _formatted: { name: '<em>Ceramic</em> Mug' } })],
          estimatedTotalHits: 42,
          facetDistribution: { categorySlug: { pottery: 40, glass: 2 } },
        },
      ],
    })

    const result = await searchOverlayQuery('mug')

    expect(mockMultiSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: [
          expect.objectContaining({ indexUid: 'products', q: 'mug', filter: ['isActive = true'] }),
        ],
      }),
    )
    expect(result.total).toBe(42)
    expect(result.products[0]).toMatchObject({
      id: 'prod-1',
      name: 'Ceramic Mug',
      formattedName: '<em>Ceramic</em> Mug',
      shopSlug: 'atelier',
      weightGrams: 350,
      soldBy: 'weight',
    })
    // Facet names come from the hits; unknown slugs are humanized, not dropped.
    expect(result.categories).toEqual([
      { slug: 'pottery', name: 'Pottery', count: 40 },
      { slug: 'glass', name: 'Glass', count: 2 },
    ])
  })

  it('falls back to the PostgreSQL search path when Meilisearch is unhealthy', async () => {
    mockHealthy.mockResolvedValueOnce(false)
    mockFallbackQuery.mockResolvedValueOnce({
      products: [
        {
          id: 'prod-2',
          name: 'Bowl',
          description: null,
          slug: 'bowl',
          shopSlug: null,
          shopName: null,
          categorySlug: 'pottery',
          categoryName: 'Pottery',
          priceCents: 1000,
          stockCount: 1,
          imageUrl: null,
          weightGrams: null,
          volumeMl: null,
          soldBy: null,
        },
      ],
      total: 1,
    })

    const result = await searchOverlayQuery('bowl')

    expect(mockMultiSearch).not.toHaveBeenCalled()
    expect(mockFallbackQuery).toHaveBeenCalledWith('bowl', {}, 'relevance', {
      page: 1,
      pageSize: 12,
    })
    expect(result.products[0]).toMatchObject({ id: 'prod-2', formattedName: null })
    expect(result.categories).toEqual([{ slug: 'pottery', name: 'Pottery', count: 1 }])
  })

  it('falls back when the Meilisearch request errors mid-flight', async () => {
    mockMultiSearch.mockRejectedValueOnce(new Error('connection reset'))
    mockFallbackQuery.mockResolvedValueOnce({ products: [], total: 0 })

    await expect(searchOverlayQuery('vase')).resolves.toEqual({
      products: [],
      total: 0,
      categories: [],
    })
    expect(mockFallbackQuery).toHaveBeenCalledTimes(1)
  })

  it('returns empty when the engine responds without a result set', async () => {
    mockMultiSearch.mockResolvedValueOnce({ results: [] })

    await expect(searchOverlayQuery('vase')).resolves.toEqual(EMPTY_OVERLAY_RESULTS)
    expect(mockFallbackQuery).not.toHaveBeenCalled()
  })
})
