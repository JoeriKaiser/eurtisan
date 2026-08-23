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
| `/collect*` | Grafana Alloy Faro receiver |
| `https://s3-staging.eurtisan.eu/*` (staging only) | Garage authenticated S3 API |

Caddy and the Ansible-managed staging Traefik configuration strip the uploads
prefix before proxying. Staging uses `http://garage:3900` internally while presigned
browser uploads use the dedicated HTTPS Garage domain; production uses Scaleway for
both S3 endpoints. Browser search never reaches Meilisearch directly: every query
goes through the app's rate-limited server functions, so `MEILISEARCH_API_KEY` and
all storage and imgproxy signing secrets remain server-only.

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

## Operator legal identity (LCEN imprint)

French LCEN Article 6-III requires the `/imprint` page to disclose the
publisher's registration identifiers and hosting provider details. These are
plain server-runtime values (not secrets) rendered from the operator profile;
they must be accurate and match the company registry.

| Variable | Example (placeholder) | Requirement |
|---|---|---|
| `OPERATOR_LEGAL_FORM` | `SAS` | required in production |
| `OPERATOR_SHARE_CAPITAL` | `10 000 euros` | optional everywhere |
| `OPERATOR_SIREN` | `000000000` (9 digits) | required in production |
| `OPERATOR_SIRET` | `00000000000000` (14 digits) | required in production |
| `OPERATOR_RCS_CITY` | `Paris` | required in production |
| `OPERATOR_PUBLICATION_DIRECTOR` | `First Last` | required in production |
| `HOSTING_PROVIDER_NAME` | `Example VPS Provider` | required in production |
| `HOSTING_PROVIDER_ADDRESS` | `1 Rue des Exemples, 75002 Paris, France` | required in production |
| `HOSTING_PROVIDER_PHONE` | `+33 1 00 00 00 00` | required in production |

Requirement semantics: all of these variables parse as optional strings so
development and staging environments degrade gracefully (the page simply omits
the missing rows instead of crashing). In production,
`src/lib/infra/server-environment.server.ts` fails startup when any variable
marked "required in production" is unset; `OPERATOR_SIREN` must be exactly
nine digits and `OPERATOR_SIRET` exactly fourteen. Hosting provider refers to
the provider operating the self-hosted VPS. None of these values is
browser-visible at build time, so changing them requires only recreating the
app service — no image rebuild.

## Database connection pools and job metrics

`DATABASE_POOL_MAX` is pinned per service class in both Compose stacks,
overriding any `.env` value: the web app allows 10 connections and every
background job 4. The `db` services raise Postgres to `max_connections=200`
via command flags, mirrored in the WAL-archive compose overlay. Worst case,
all pools saturate simultaneously: 10 + 18 × 4 = 82 client connections against
200, leaving 118 for migrations, ad-hoc psql, and backup tooling. Treat pool
sizes and `max_connections` as one budget — raise them together and recreate
the affected services.

Production-critical background jobs serve Prometheus metrics from their own
container on port 3001 (`METRICS_TOKEN` required; `METRICS_PORT` overrides the
default port): `notification-digest`, `email-outbox-worker`,
`payout-reconciliation`, `mollie-payment-reconciliation`,
`sendcloud-reconciliation`, `inventory-cleanup`, and
`financial-totals-reconciliation`. Prometheus scrapes each as an
`eurtisan-<job-name>` target rendered by Ansible. Housekeeping cleanup jobs
(session, cart, audit-log, search-event, notification, payout-log,
verification, and email retention cleanups) deliberately have no metrics
endpoint: they are low-risk retention pollers without dedicated alerts; wire
one with `startJobMetricsServerFromEnv`, an `expose: ["3001"]`, and a scrape
entry when that changes. With `METRICS_TOKEN` unset the endpoint is skipped
(local runs), which surfaces as a down scrape target rather than silent
staleness.

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
- Logical-backup, rclone crypt, and pgBackRest credentials/passphrases are rendered
  into dedicated root-owned backup/pgBackRest environment files, not the application
  environment. Production uses separate logical-backup, pgBackRest, and
  primary-uploads read credentials; do not reuse the application storage key.

## Rotation

1. Create the replacement credential in the provider or secret manager.
2. Update Ansible Vault without printing the value in command output or logs.
3. For immutable `VITE_*` build inputs, rebuild the image and roll it out; for
   server-only credentials, recreate every consuming service.
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
