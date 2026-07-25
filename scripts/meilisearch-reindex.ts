/**
 * Rebuild the Meilisearch products index from PostgreSQL, without downtime.
 *
 * Builds a complete index alongside the live one and swaps them atomically, so
 * search keeps serving the previous generation throughout. Use this after
 * changing index settings (searchable attributes, ranking rules, synonyms),
 * which only take effect for documents indexed afterwards.
 *
 * Usage:
 *   bun run search:reindex
 */
import { rebuildProductsIndex } from '../src/lib/meilisearch-products.server'

async function main(): Promise<void> {
  const result = await rebuildProductsIndex()

  if (result === null) {
    console.error('Meilisearch is not configured; nothing to do.')
    process.exit(1)
  }

  console.log(`Reindexed ${result.synced} product(s) with ${result.errors} error(s).`)
  if (result.errors > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Reindex failed:', err)
  process.exit(1)
})
