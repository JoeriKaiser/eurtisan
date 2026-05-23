/**
 * Standalone script to configure and populate the Meilisearch products index.
 *
 * Run via: make meili-setup
 *
 * Use this when the Meilisearch index exists but is missing filterable/sortable
 * attribute configuration (e.g. after a fresh Meilisearch container start or
 * when the index settings have drifted from what the application expects).
 */
import { pool } from '../db.ts'
import {
  configureProductsIndex,
  isMeilisearchHealthy,
  populateProductsIndex,
} from './meilisearch-products.server.ts'

async function main() {
  const healthy = await isMeilisearchHealthy()
  if (!healthy) {
    console.error(
      'Meilisearch is not reachable. Ensure MEILISEARCH_HOST and MEILISEARCH_API_KEY are set and the service is running.',
    )
    process.exit(1)
  }

  console.log('Configuring Meilisearch products index...')
  await configureProductsIndex()
  console.log('Index settings updated (filterable and sortable attributes applied).')

  console.log('Populating Meilisearch products index from PostgreSQL...')
  const { synced, errors } = await populateProductsIndex()
  console.log(`Done: synced ${synced} products, ${errors} errors.`)
}

main()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Meilisearch setup failed:', err)
    await pool.end()
    process.exit(1)
  })
