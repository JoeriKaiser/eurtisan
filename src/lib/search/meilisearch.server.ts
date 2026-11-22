import { Meilisearch } from 'meilisearch'

const host = process.env.MEILISEARCH_HOST
const apiKey = process.env.MEILISEARCH_API_KEY

const MEILISEARCH_HTTP_TIMEOUT_MS = 5_000

export const meilisearch = host
  ? new Meilisearch({ host, apiKey, timeout: MEILISEARCH_HTTP_TIMEOUT_MS })
  : null

export function isMeilisearchConfigured(): boolean {
  return meilisearch !== null
}
