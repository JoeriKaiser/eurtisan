# Meilisearch Failure

## Symptoms

- Search falls back to PostgreSQL (slower) or returns errors
- `/api/health/ready` shows `meilisearch: unhealthy`
- Metric `eurtisan_meilisearch_sync_queue_failed_total` increasing

## Meilisearch will not start

`MEILI_ENV=production` enforces a master key of **at least 16 bytes**. If
`MEILI_MASTER_KEY` is shorter the container exits immediately on boot, before
serving any request. Generate a long key with `openssl rand -base64 32`.

## Immediate actions

1. `docker compose -f docker-compose.prod.yml ps meilisearch`
2. Restart Meilisearch: `docker compose -f docker-compose.prod.yml restart meilisearch`
3. Run sync job: `docker compose -f docker-compose.prod.yml run --rm app bun run job:meilisearch-sync`

PostgreSQL is the source of truth, so the index can always be rebuilt from it;
nothing is lost by recreating it.

## Re-index

Use the zero-downtime rebuild. It builds a complete index alongside the live one
and swaps them atomically, so search keeps serving the previous generation
throughout:

```
docker compose -f docker-compose.prod.yml run --rm app bun run search:reindex
```

Run this after **any change to index settings** — searchable attributes, ranking
rules, synonyms, `localizedAttributes`, filterable/sortable attributes. Settings
only apply to documents indexed after the change, so existing documents keep the
old behaviour until they are rewritten.

Do **not** clear the index and repopulate it in production: that leaves search
returning nothing for the whole rebuild, which on a marketplace means an empty
storefront.

If a rebuild crashes partway it leaves a `products_rebuild` index behind. The
next run deletes it before starting, so simply re-run the command.

## Stale results

A document that no longer satisfies the index invariant (published, active,
non-suspended shop) is dropped from the result set on read and deleted from the
index in the background, so isolated staleness self-corrects. Persistent
staleness across many queries means the sync queue is not draining — check the
`meilisearch-sync` container and the `meilisearch_sync_queue` table for rows with
`status = 'failed'`.

## Search key rotation

The browser bundle ships a **search-only** key scoped to the `products` index.
The master key must never be exposed to the client.

```
MEILISEARCH_HOST=... MEILISEARCH_API_KEY=<master key> \
  bun run search:provision-key --rotate
```

Copy the printed value into `VITE_MEILISEARCH_SEARCH_KEY` and **rebuild the app**
— the value is baked into the client bundle at build time. Rotating invalidates
the key in already-deployed bundles, so deploy promptly after rotating.

The build refuses to start if `VITE_MEILISEARCH_SEARCH_KEY` matches any server
secret (including `MEILI_MASTER_KEY`), which catches the worst misconfiguration.

## Search telemetry

Search events (queries, result counts, clicked results) are recorded in the
`search_event` table and purged by the `search-event-cleanup` job after
`SEARCH_EVENT_RETENTION_DAYS` (default 180). Queries are user-typed free text, so
this retention window is a privacy commitment — keep it aligned with the privacy
notice, and do not add raw queries to application logs, which are not covered by
it.

Useful reports (`src/lib/search/analytics.server.ts`):

- `getZeroResultQueries` — queries returning nothing; each row is a catalogue gap
  or a missing synonym
- `getTopQueriesReport` — volume and click-through rate; a high-volume query with
  a low CTR means ranking is not surfacing what buyers want
