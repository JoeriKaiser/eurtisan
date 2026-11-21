# Production Environment and Client-Build Configuration

## Contracts

Eurtisan separates build-time browser config from runtime server config:

1. **Browser-visible build values (`VITE_*`)** are validated by `src/lib/infra/public-environment.ts`, compiled into `Dockerfile.prod`, and written to `dist/client/client-config.json` for image smoke testing. Unknown `VITE_*` variables are rejected. Never prefix a secret with `VITE_`.
2. **Server runtime values** are validated by `src/lib/infra/server-environment.server.ts` before `app` or `worker` starts. Validation errors report variable names and constraints, never values.

## Public Routing

| Public route | Private upstream |
|---|---|
| `/uploads/*` | `imgproxy:8080` (prefix stripped by Caddy/Traefik) |
| `/collect*` | Grafana Alloy Faro receiver |
| `https://s3-staging.eurtisan.eu/*` (staging only) | Garage authenticated S3 API |

Staging uses `http://garage:3900` internally and `https://s3-staging.eurtisan.eu` for presigned browser uploads; production uses Scaleway S3 for both. Browser search calls rate-limited server functions, so `MEILISEARCH_API_KEY` and all storage/imgproxy signing secrets remain server-only.

## Provider Safety Contracts

Enforced by both Ansible preflight (`infrastructure/ansible/roles/eurtisan/tasks/preflight.yml`) and `src/lib/infra/server-environment.server.ts`:

- **`MOLLIE_API_KEY`**: Must start with `test_` in staging and `live_` in production.
- **`SENDCLOUD_FORCE_UNSTAMPED_LETTER`**: Must be `true` in staging and `false` in production. When `true`, `SendcloudProvider.createLabel` pins the v3 `shipping_option_code` to `SENDCLOUD_UNSTAMPED_LETTER_OPTION_CODE` (default `sendcloud:letter`) and fails closed on invalid overrides.
- **Email**: Staging Compose overrides `EMAIL_SMTP_HOST=mailpit` (`1025`) and leaves `BREVO_API_KEY` empty. Production uses Brevo.

## Rebuild Versus Restart

- **Any `VITE_*` change** (URLs, Faro/Umami flags, consent policy, `VITE_APP_VERSION`) requires a **new image build and rollout**. Restarting an existing container will not update compiled browser assets.
- **Server-only env changes** require **recreating all consuming containers** (`app` and/or `worker`) after Ansible updates `/opt/eurtisan/.env`. Changing worker cadence/batch settings (`FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS`, `FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE`, `NOTIFICATION_DIGEST_INTERVAL_MS`, `NOTIFICATION_DIGEST_RECIPIENT_BATCH_SIZE`) requires recreating `worker`.
- `IMAGE_TAG` and `VITE_APP_VERSION` are derived from the deployed Git commit so runtime telemetry and client bundles match.

Validate locally before promotion:

```bash
make compose-check
make production-image-smoke
docker compose -f docker-compose.prod.yml run --rm --no-deps app bun run validate:server-env
```

## Ownership

- **Secrets:** Stored only in encrypted `infrastructure/ansible/secrets.yml` (Ansible Vault). Staging secrets use a `_staging` suffix mapped in `group_vars/staging.yml`; production uses canonical names.
- **Non-secret policy:** Stored in `infrastructure/ansible/group_vars/`.
- **Host `.env`:** Rendered mode `0600` by Ansible; deployment output only, never committed.
- **Backup credentials:** Rendered into dedicated root/backup-owned env files (`backup.env`, `pgbackrest.env`), separate from application S3 keys.

## Rotation

1. Create the replacement credential in the provider.
2. Update `infrastructure/ansible/secrets.yml` via `ansible-vault edit` without printing values in logs.
3. Rebuild and roll out for `VITE_*` changes, or recreate consuming containers (`app` / `worker`) for server-only changes.
4. Run `validate:server-env`, health checks, and one staging transaction for the affected provider.
5. Revoke the old credential only after the replacement is verified.

Special cases:
- **`DATABASE_ENCRYPTION_KEY`** (canonical base64, exactly 32 random bytes): Existing encrypted columns require the active key. Back it up separately from the VPS and never rotate it without a maintenance-window re-encryption plan and verified restore point.
- **`IMGPROXY_KEY` and `IMGPROXY_SALT`** (hex, >= 32 random bytes each): Rotate together with an app/cache rollout.
- **Emergency compromise:** Revoke first, update Vault, roll out affected services, and verify recovery. Never place credentials in tickets, chat, logs, or Git.
