# Meilisearch Failure

## Symptoms

- Search falls back to PostgreSQL (slower) or returns errors
- `/api/health/ready` shows `meilisearch: unhealthy`
- Metric `eurtisan_meilisearch_sync_queue_failed_total` increasing

## Immediate actions

1. `docker compose -f docker-compose.prod.yml ps meilisearch`
2. Restart Meilisearch: `docker compose -f docker-compose.prod.yml restart meilisearch`
3. Run sync job: `docker compose -f docker-compose.prod.yml run --rm app bun run job:meilisearch-sync`

## Re-index

If index is corrupt, re-run full reindex from admin or `meilisearch-products` bulk sync after service is healthy.
