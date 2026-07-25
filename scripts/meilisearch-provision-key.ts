/**
 * Provision (or rotate) the browser-facing Meilisearch search key.
 *
 * The key that ships in the client bundle must be scoped to `search` on the
 * products index only. Creating it by hand invites a master key ending up in
 * VITE_MEILISEARCH_SEARCH_KEY, which would hand every visitor full write access
 * to the index.
 *
 * Usage:
 *   MEILISEARCH_HOST=... MEILISEARCH_API_KEY=<master key> \
 *     bun run scripts/meilisearch-provision-key.ts [--rotate]
 *
 * Prints the key value; copy it into VITE_MEILISEARCH_SEARCH_KEY and rebuild
 * the app (the value is baked in at build time).
 *
 * With --rotate, any existing key with the same name is deleted first. Rotating
 * invalidates the key in already-deployed bundles, so deploy a rebuilt app
 * promptly afterwards.
 */
import { Meilisearch } from 'meilisearch'

const KEY_NAME = 'eurtisan-browser-search'
const PRODUCTS_INDEX = 'products'

const host = process.env.MEILISEARCH_HOST
const apiKey = process.env.MEILISEARCH_API_KEY

if (!host) {
  console.error('MEILISEARCH_HOST is required.')
  process.exit(1)
}
if (!apiKey) {
  console.error('MEILISEARCH_API_KEY (the master key) is required.')
  process.exit(1)
}

const rotate = process.argv.includes('--rotate')
const client = new Meilisearch({ host, apiKey })

async function main(): Promise<void> {
  const { results: existingKeys } = await client.getKeys({ limit: 100 })
  const existing = existingKeys.filter((key) => key.name === KEY_NAME)

  if (existing.length > 0 && !rotate) {
    const [key] = existing
    console.log('A search key already exists; pass --rotate to replace it.\n')
    console.log(`  name:    ${key.name}`)
    console.log(`  uid:     ${key.uid}`)
    console.log(`  actions: ${key.actions.join(', ')}`)
    console.log(`  indexes: ${key.indexes.join(', ')}`)
    console.log(`\nVITE_MEILISEARCH_SEARCH_KEY=${key.key}`)
    return
  }

  for (const key of existing) {
    await client.deleteKey(key.uid)
    console.log(`Deleted previous key ${key.uid}.`)
  }

  const created = await client.createKey({
    name: KEY_NAME,
    description: 'Browser-facing search-only key for the storefront bundle',
    // Search only. Notably excludes documents.get, which would otherwise let
    // anyone dump the whole catalogue through the public /meilisearch route.
    actions: ['search'],
    indexes: [PRODUCTS_INDEX],
    expiresAt: null,
  })

  console.log('Created search-only key.\n')
  console.log(`  uid:     ${created.uid}`)
  console.log(`  actions: ${created.actions.join(', ')}`)
  console.log(`  indexes: ${created.indexes.join(', ')}`)
  console.log(`\nVITE_MEILISEARCH_SEARCH_KEY=${created.key}`)
  console.log('\nRebuild the app so the new value is baked into the client bundle.')
}

main().catch((err) => {
  console.error('Failed to provision the Meilisearch search key:', err)
  process.exit(1)
})
