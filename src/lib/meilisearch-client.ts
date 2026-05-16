/**
 * Browser-safe Meilisearch client configuration.
 *
 * In production, VITE_MEILISEARCH_SEARCH_KEY should be a search-only API key
 * with restricted permissions (search only, specific indexes).
 * The master key must NEVER be exposed to the client bundle.
 */
import { Meilisearch } from 'meilisearch'

const host = import.meta.env.VITE_MEILISEARCH_HOST
const apiKey = import.meta.env.VITE_MEILISEARCH_SEARCH_KEY

export const meilisearchClient = host ? new Meilisearch({ host, apiKey }) : null

export function isMeilisearchClientConfigured(): boolean {
  return meilisearchClient !== null
}

export const PRODUCTS_INDEX = 'products'
