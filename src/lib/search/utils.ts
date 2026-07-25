/**
 * Pure utilities for building Meilisearch filter strings and handling
 * search result presentation.
 */

const FILTER_SPECIAL_CHARS = /["\\]/g

/**
 * Escape a string value for use in a Meilisearch filter expression.
 * Meilisearch filters use double quotes for string literals; backslashes
 * and double quotes must be escaped.
 */
export function escapeFilterValue(value: string): string {
  return value.replace(FILTER_SPECIAL_CHARS, '\\$&')
}

export type FilterOperator = 'eq' | 'gte' | 'lte' | 'gt' | 'lt' | 'in'

export interface FilterCondition {
  field: string
  operator: FilterOperator
  value: string | number | boolean | string[]
}

/**
 * Build a Meilisearch filter string from an array of conditions.
 * Returns an empty string if no valid conditions are provided.
 *
 * Example:
 *   buildFilterString([
 *     { field: 'isActive', operator: 'eq', value: true },
 *     { field: 'priceCents', operator: 'gte', value: 1000 },
 *   ])
 *   // => 'isActive = true AND priceCents >= 1000'
 */
export function buildFilterString(conditions: FilterCondition[]): string {
  const parts: string[] = []

  for (const cond of conditions) {
    if (cond.value === undefined || cond.value === null || cond.value === '') {
      continue
    }

    const part = buildSingleCondition(cond)
    if (part) {
      parts.push(part)
    }
  }

  return parts.join(' AND ')
}

function buildSingleCondition(cond: FilterCondition): string | null {
  const { field, operator, value } = cond

  switch (operator) {
    case 'eq':
      if (typeof value === 'boolean') {
        return `${field} = ${value}`
      }
      if (typeof value === 'number') {
        return `${field} = ${value}`
      }
      if (typeof value === 'string') {
        return `${field} = "${escapeFilterValue(value)}"`
      }
      return null

    case 'gte':
      if (typeof value === 'number') {
        return `${field} >= ${value}`
      }
      return null

    case 'lte':
      if (typeof value === 'number') {
        return `${field} <= ${value}`
      }
      return null

    case 'gt':
      if (typeof value === 'number') {
        return `${field} > ${value}`
      }
      return null

    case 'lt':
      if (typeof value === 'number') {
        return `${field} < ${value}`
      }
      return null

    case 'in':
      if (Array.isArray(value) && value.length > 0) {
        const escaped = value.map((v) => `"${escapeFilterValue(v)}"`).join(', ')
        return `${field} IN [${escaped}]`
      }
      return null

    default:
      return null
  }
}

/**
 * Wrap matching query terms in <mark> tags for visual highlighting.
 * Preserves the original casing of the text.
 */
export function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text

  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (terms.length === 0) return text

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi')
  return text.replace(pattern, '<mark>$1</mark>')
}

/** Upper bound on a stored analytics query, matching the search input limit. */
const MAX_ANALYTICS_QUERY_LENGTH = 100

/**
 * Canonical form of a search query for analytics grouping.
 *
 * Collapses case and whitespace so "Ceramic  Mug" and "ceramic mug" aggregate
 * into one row, and truncates so a pathological query cannot bloat the table.
 * Returns an empty string for queries not worth recording.
 */
export function normalizeQueryForAnalytics(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_ANALYTICS_QUERY_LENGTH)
}

/**
 * Parse a Meilisearch price range filter string back into min/max cents.
 * Returns nulls when the range is unbounded.
 */
export function parsePriceFilter(filterString: string): {
  minCents: number | null
  maxCents: number | null
} {
  let minCents: number | null = null
  let maxCents: number | null = null

  const gteMatch = filterString.match(/priceCents\s*>=\s*(\d+)/)
  if (gteMatch) {
    minCents = Number.parseInt(gteMatch[1], 10)
  }

  const lteMatch = filterString.match(/priceCents\s*<=\s*(\d+)/)
  if (lteMatch) {
    maxCents = Number.parseInt(lteMatch[1], 10)
  }

  return { minCents, maxCents }
}
