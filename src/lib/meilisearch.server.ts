import { Meilisearch } from 'meilisearch'

const host = process.env.MEILISEARCH_HOST
const apiKey = process.env.MEILISEARCH_API_KEY

if (!host) {
  throw new Error('Missing environment variable: MEILISEARCH_HOST')
}

export const meilisearch = new Meilisearch({
  host,
  apiKey,
})
