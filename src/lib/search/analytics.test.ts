import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { searchEvent } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createProduct, createShop, createUser } from '#/test/factories'

import {
  getPopularQueries,
  getTopQueriesReport,
  getZeroResultQueries,
  purgeOldSearchEvents,
  recordSearchClick,
  recordSearchEvent,
} from './analytics.server'

beforeEach(async () => {
  await clearTestTables()
})

async function seedProduct() {
  const user = await createUser({ id: 'user-1', email: 'u@example.com', emailVerified: true })
  const shop = await createShop(user, { id: 'shop-1', name: 'Shop', slug: 'shop' })
  return createProduct(shop, { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 1000 })
}

describe('recordSearchEvent', () => {
  it('stores a normalized query', async () => {
    await recordSearchEvent({ query: '  Ceramic   MUG ', resultCount: 3, source: 'meilisearch' })

    const [row] = await db.select().from(searchEvent)
    expect(row.normalizedQuery).toBe('ceramic mug')
    expect(row.resultCount).toBe(3)
    expect(row.source).toBe('meilisearch')
    expect(row.eventType).toBe('search')
  })

  it('ignores blank queries', async () => {
    await recordSearchEvent({ query: '   ', resultCount: 0, source: 'postgres' })
    expect(await db.select().from(searchEvent)).toHaveLength(0)
  })

  it('records zero-result searches, which are the point of the report', async () => {
    await recordSearchEvent({ query: 'unobtainium', resultCount: 0, source: 'meilisearch' })
    const [row] = await db.select().from(searchEvent)
    expect(row.resultCount).toBe(0)
  })
})

describe('recordSearchClick', () => {
  it('stores the clicked product and its rank', async () => {
    await seedProduct()
    await recordSearchClick({ query: 'vase', productId: 'prod-1', position: 2 })

    const [row] = await db.select().from(searchEvent)
    expect(row.eventType).toBe('click')
    expect(row.clickedProductId).toBe('prod-1')
    expect(row.clickedPosition).toBe(2)
  })

  it('rejects a non-positive position rather than storing nonsense', async () => {
    await seedProduct()
    await recordSearchClick({ query: 'vase', productId: 'prod-1', position: 0 })
    expect(await db.select().from(searchEvent)).toHaveLength(0)
  })

  it('never throws when the product no longer exists', async () => {
    await expect(
      recordSearchClick({ query: 'vase', productId: 'missing', position: 1 }),
    ).resolves.toBeUndefined()
  })
})

describe('getTopQueriesReport', () => {
  it('computes click-through rate per query', async () => {
    await seedProduct()
    await recordSearchEvent({ query: 'vase', resultCount: 5, source: 'meilisearch' })
    await recordSearchEvent({ query: 'vase', resultCount: 5, source: 'meilisearch' })
    await recordSearchClick({ query: 'vase', productId: 'prod-1', position: 1 })

    const [row] = await getTopQueriesReport()
    expect(row.query).toBe('vase')
    expect(row.searches).toBe(2)
    expect(row.clicks).toBe(1)
    expect(row.clickThroughRate).toBeCloseTo(0.5)
    expect(row.averageClickPosition).toBeCloseTo(1)
  })

  it('reports a zero rate for a query nobody clicked', async () => {
    await recordSearchEvent({ query: 'ghost', resultCount: 4, source: 'meilisearch' })
    const [row] = await getTopQueriesReport()
    expect(row.clickThroughRate).toBe(0)
    expect(row.averageClickPosition).toBeNull()
  })
})

describe('getZeroResultQueries', () => {
  it('returns only queries that produced nothing, most frequent first', async () => {
    await recordSearchEvent({ query: 'unobtainium', resultCount: 0, source: 'meilisearch' })
    await recordSearchEvent({ query: 'unobtainium', resultCount: 0, source: 'meilisearch' })
    await recordSearchEvent({ query: 'rare', resultCount: 0, source: 'meilisearch' })
    await recordSearchEvent({ query: 'vase', resultCount: 7, source: 'meilisearch' })

    const rows = await getZeroResultQueries()
    expect(rows.map((r) => r.query)).toEqual(['unobtainium', 'rare'])
    expect(rows[0].searches).toBe(2)
  })
})

describe('getPopularQueries', () => {
  it('suggests only queries that actually returned results', async () => {
    await recordSearchEvent({ query: 'vase', resultCount: 7, source: 'meilisearch' })
    await recordSearchEvent({ query: 'unobtainium', resultCount: 0, source: 'meilisearch' })

    expect(await getPopularQueries()).toEqual(['vase'])
  })
})

describe('purgeOldSearchEvents', () => {
  it('deletes rows past the retention window and keeps the rest', async () => {
    await recordSearchEvent({ query: 'recent', resultCount: 1, source: 'meilisearch' })
    await db.insert(searchEvent).values({
      eventType: 'search',
      normalizedQuery: 'ancient',
      resultCount: 1,
      createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
    })

    const result = await purgeOldSearchEvents(180)

    expect(result.deleted).toBe(1)
    const remaining = await db.select().from(searchEvent)
    expect(remaining.map((r) => r.normalizedQuery)).toEqual(['recent'])
  })
})
