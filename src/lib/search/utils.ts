/**
 * Pure helpers shared by the search server modules.
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
