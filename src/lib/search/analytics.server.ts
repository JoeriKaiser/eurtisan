import { and, count, countDistinct, desc, eq, lt, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { searchEvent } from '#/db/schema'
import { logger } from '../logger.server'
import { normalizeQueryForAnalytics } from './utils'

export type SearchEventSource = 'meilisearch' | 'postgres'

export interface RecordSearchInput {
  query: string
  resultCount: number
  source: SearchEventSource
  locale?: string
}

export interface RecordSearchClickInput {
  query: string
  productId: string
  /** 1-based rank of the clicked result within the result list. */
  position: number
  locale?: string
}

/**
 * Record that a search was executed.
 *
 * Never throws: telemetry must not be able to fail a buyer's search. Empty
 * queries are ignored — a blank browse is not a search anyone can act on.
 */
export async function recordSearchEvent(input: RecordSearchInput): Promise<void> {
  const normalizedQuery = normalizeQueryForAnalytics(input.query)
  if (!normalizedQuery) return

  try {
    await db.insert(searchEvent).values({
      eventType: 'search',
      normalizedQuery,
      resultCount: input.resultCount,
      source: input.source,
      locale: input.locale ?? null,
    })
  } catch (err) {
    logger.error('Failed to record search event', err)
  }
}

/** Record that a buyer opened a result. Never throws, for the same reason. */
export async function recordSearchClick(input: RecordSearchClickInput): Promise<void> {
  const normalizedQuery = normalizeQueryForAnalytics(input.query)
  if (!normalizedQuery || input.position < 1) return

  try {
    await db.insert(searchEvent).values({
      eventType: 'click',
      normalizedQuery,
      clickedProductId: input.productId,
      clickedPosition: input.position,
      locale: input.locale ?? null,
    })
  } catch (err) {
    logger.error('Failed to record search click', err)
  }
}

export interface QueryReportRow {
  query: string
  searches: number
  clicks: number
  /** Clicks per search, 0–1. The core signal for whether ranking is working. */
  clickThroughRate: number
  averageClickPosition: number | null
}

/**
 * Top queries by volume, with click-through rate.
 *
 * A high-volume query with a low CTR means buyers are searching for something
 * the ranking is not surfacing — the highest-value thing to fix.
 */
export async function getTopQueriesReport(sinceDays = 30, limit = 50): Promise<QueryReportRow[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      query: searchEvent.normalizedQuery,
      searches: count(sql`CASE WHEN ${searchEvent.eventType} = 'search' THEN 1 END`),
      clicks: count(sql`CASE WHEN ${searchEvent.eventType} = 'click' THEN 1 END`),
      averageClickPosition: sql<number | null>`AVG(${searchEvent.clickedPosition})::float8`,
    })
    .from(searchEvent)
    .where(sql`${searchEvent.createdAt} >= ${since}`)
    .groupBy(searchEvent.normalizedQuery)
    .orderBy(desc(count(sql`CASE WHEN ${searchEvent.eventType} = 'search' THEN 1 END`)))
    .limit(limit)

  return rows.map((row) => {
    const searches = Number(row.searches ?? 0)
    const clicks = Number(row.clicks ?? 0)
    return {
      query: row.query,
      searches,
      clicks,
      clickThroughRate: searches > 0 ? clicks / searches : 0,
      averageClickPosition:
        row.averageClickPosition === null ? null : Number(row.averageClickPosition),
    }
  })
}

export interface ZeroResultRow {
  query: string
  searches: number
}

/**
 * Queries that returned nothing, most frequent first. Directly actionable:
 * each row is either a catalogue gap or a synonym the index is missing.
 */
export async function getZeroResultQueries(sinceDays = 30, limit = 50): Promise<ZeroResultRow[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      query: searchEvent.normalizedQuery,
      searches: count(),
    })
    .from(searchEvent)
    .where(
      and(
        eq(searchEvent.eventType, 'search'),
        eq(searchEvent.resultCount, 0),
        sql`${searchEvent.createdAt} >= ${since}`,
      ),
    )
    .groupBy(searchEvent.normalizedQuery)
    .orderBy(desc(count()))
    .limit(limit)

  return rows.map((row) => ({ query: row.query, searches: Number(row.searches ?? 0) }))
}

/**
 * Distinct queries seen recently, used to build the query-suggestion list.
 * Only queries that produced results are worth suggesting back to buyers.
 */
export async function getPopularQueries(sinceDays = 30, limit = 10): Promise<string[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({ query: searchEvent.normalizedQuery, searches: count() })
    .from(searchEvent)
    .where(
      and(
        eq(searchEvent.eventType, 'search'),
        sql`${searchEvent.resultCount} > 0`,
        sql`${searchEvent.createdAt} >= ${since}`,
      ),
    )
    .groupBy(searchEvent.normalizedQuery)
    .orderBy(desc(count()))
    .limit(limit)

  return rows.map((row) => row.query)
}

/**
 * Delete search telemetry past its retention window.
 *
 * Search queries are free text that can contain personal data, so they are not
 * kept indefinitely.
 */
export async function purgeOldSearchEvents(retentionDays: number): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const deleted = await db
    .delete(searchEvent)
    .where(lt(searchEvent.createdAt, cutoff))
    .returning({ id: searchEvent.id })

  return { deleted: deleted.length }
}

/** Distinct queries recorded in the window — used for reporting headline counts. */
export async function countDistinctQueries(sinceDays = 30): Promise<number> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const [row] = await db
    .select({ total: countDistinct(searchEvent.normalizedQuery) })
    .from(searchEvent)
    .where(sql`${searchEvent.createdAt} >= ${since}`)
  return Number(row?.total ?? 0)
}
