# Production environment and client-build configuration

## Contracts

Eurtisan has two separate configuration contracts:

1. **Browser-visible build values** are the approved `VITE_*` variables validated by
   `src/lib/infra/public-environment.ts`. They are passed to the builder stage of
   `Dockerfile.prod`; they are never read from runtime secrets. The validated values
   are recorded in `dist/client/client-config.json` for image smoke testing.
2. **Server runtime values** are validated by
   `src/lib/infra/server-environment.server.ts` before the web server or any packaged
   background job starts. Errors report variable names and constraints, never values.

Unknown `VITE_*` variables are rejected. Never prefix a server credential with
`VITE_`; Vite embeds every such value in browser assets.

## Public routing

Production and staging use same-origin routes already owned by the deployment proxy:

| Public route | Private upstream |
|---|---|
| `/uploads/*` | `imgproxy:8080` |
| `/meilisearch/*` | `meilisearch:7700` |
| `/collect*` | Grafana Alloy Faro receiver |
| `https://s3-staging.eurtisan.eu/*` (staging only) | Garage authenticated S3 API |

Caddy and the Ansible-managed staging Traefik configuration strip the first two
prefixes before proxying. Staging uses `http://garage:3900` internally while presigned
browser uploads use the dedicated HTTPS Garage domain; production uses Scaleway for
both S3 endpoints. Browser search uses only a Meilisearch key restricted to
`actions=["search"]` and `indexes=["products"]`. The Meilisearch master key remains
server-only.

## Rebuild versus restart

A change to any `VITE_*` value requires a **new image build and rollout**. Restarting
an existing container cannot change compiled browser assets. This includes public
URLs, the search-only key, Faro/Umami settings, consent policy, environment, and
release version.

A server-only value normally requires a **container recreation/restart** after the
Ansible-managed `.env` changes. If a value is used by both an app and a worker, all
of those services must be recreated. The read-only financial reconciliation worker
uses `FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS` (default six hours, validated
between five minutes and 24 hours) and `FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE`
(default 500, maximum 5,000). Recreate that worker after changing either value. `IMAGE_TAG` and `VITE_APP_VERSION` are set from
the deployed Git commit so runtime telemetry and compiled assets identify the same
release.

`NOTIFICATION_DIGEST_INTERVAL_MS` controls the advisory-locked seller digest poller
(default 3,600,000 ms; accepted range one minute through 24 hours).
`NOTIFICATION_DIGEST_RECIPIENT_BATCH_SIZE` controls its bounded recipient query batches
(default 100; maximum 500). The worker always aggregates the previous completed UTC
day, so changing these values affects recovery latency and database work, never the
digest window. Recreate `notification-digest` after changing either value and confirm
its Prometheus job-success and stale-job series after rollout.

Validate before promotion:

```bash
IMAGE_TAG=<immutable-tag> docker compose -f docker-compose.prod.yml config >/dev/null
make production-image-smoke
docker compose -f docker-compose.prod.yml run --rm --no-deps app bun run validate:server-env
```

## Ownership

- Secret values are owned by the service/infrastructure owner and stored only in
  encrypted `infrastructure/ansible/secrets.yml` (Ansible Vault) or a successor
  secret manager.
- Non-secret environment policy and integration flags are owned in
  `infrastructure/ansible/group_vars/`.
- The generated host `.env` is mode `0600`; it is deployment output, not a source of
  truth and must not be committed.
- Browser search-key restrictions are owned in Meilisearch. Creating a random key
  without assigning search-only actions is insufficient.

## Rotation

1. Create the replacement credential in the provider or secret manager.
2. Update Ansible Vault without printing the value in command output or logs.
3. For `VITE_MEILISEARCH_SEARCH_KEY`, rebuild the image; for server-only credentials,
   recreate every consuming service.
4. Run server validation, image configuration smoke tests, health checks, and one
   provider-specific staging transaction.
5. Revoke the old credential only after the replacement is verified.

`DATABASE_ENCRYPTION_KEY` is different: existing ciphertext requires the current
key. Back it up with the encrypted database backup, and never replace or revoke it
without a maintenance-window data re-encryption plan and a verified restore point.
The key must be canonical base64 encoding of exactly 32 random bytes. Imgproxy key
and salt must each be hex encoding of at least 32 random bytes and must be rotated
together with an image/cache rollout.

For emergency provider revocation, revoke first, update Vault, rebuild if the value
is browser-visible, recreate affected services, and verify the degraded or restored
flow. Do not place revoked or replacement values in tickets, chat, logs, or source.
