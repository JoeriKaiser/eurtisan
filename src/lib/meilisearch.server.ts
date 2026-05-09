import { Meilisearch } from 'meilisearch'

const host = process.env.MEILISEARCH_HOST
const apiKey = process.env.MEILISEARCH_API_KEY

export const meilisearch = host ? new Meilisearch({ host, apiKey }) : null

export function isMeilisearchConfigured(): boolean {
  return meilisearch !== null
}
