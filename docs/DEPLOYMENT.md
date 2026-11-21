# Deployment Guide

Deploy Eurtisan to staging and production from a trusted controller using Ansible, Docker, and Cosign.

## Prerequisites

- **Controller tools:** Ansible 2.14+, Docker (with Buildx), and Cosign. Release images are built on the controller from a clean Git worktree, signed, and pushed to the environment's private registry. VPS hosts never compile application source.
- **Target VPS (Ubuntu 24.04 LTS):**
  - **Staging:** 2 vCPU / 4 GB RAM minimum. Persistent staging limits cap at 2,080 MiB across `app`, `worker`, `db`, `meilisearch`, `imgproxy`, `mailpit`, `garage`, and `release-registry`. Observability runs on demand (`staging_observability_on_demand: true`).
  - **Production:** 4 vCPU / 8 GB RAM recommended.
- **SSH access** to each VPS with passwordless `sudo` (or root).
- **Read-only GitHub deploy key** at `/root/.ssh/eurtisan_github_deploy` on each VPS, registered on the private repository.
- **DNS control** for `eurtisan.eu`.

## 1. Inventory and Secrets

Inventory files and encrypted Vault secrets are gitignored and stay on the controller.

```bash
make infra-init      # copies staging.example.yml and production.example.yml
make infra-secrets   # generates random secret values
```

Edit `infrastructure/ansible/inventory/staging.yml` (or `production.yml`) with your real `ansible_host`, `ansible_user`, and SSH key. If staging shares a VPS with Coolify or another reverse proxy, set `coexist_with_proxy: true` so Ansible skips Caddy/UFW and writes the staging Traefik config to `/data/coolify/proxy/dynamic/eurtisan-staging.yml`.

One encrypted Vault (`infrastructure/ansible/secrets.yml`) serves both environments:
- Staging secrets carry a `_staging` suffix and `group_vars/staging.yml` maps them to canonical role variables.
- Production owns the canonical names directly (start from `infrastructure/ansible/secrets.production.example.yml`).

See [infrastructure/ansible/README.md](../infrastructure/ansible/README.md) for Vault editing, rekeying, and preflight commands.

## 2. DNS Records

| Record | Target | Notes |
|---|---|---|
| `staging.eurtisan.eu` | Staging VPS IP | App (IP-whitelisted, except `/api/webhooks/*`) |
| `s3-staging.eurtisan.eu` | Staging VPS IP | Staging Garage authenticated S3 API |
| `registry-staging.eurtisan.eu` | Staging VPS IP | Self-hosted staging release registry |
| `eurtisan.eu` / `www.eurtisan.eu` | Production VPS IP | Production app (Caddy auto-TLS) |

Complete SPF, DKIM, and DMARC per [docs/EMAIL_DNS.md](./EMAIL_DNS.md) before sending production email.

## 3. Deploy and Promote

```bash
make infra-setup-staging
make infra-setup-production
```

Each rollout:
1. Runs Ansible preflight checks (secret formats, provider safety, backup policy).
2. Hardens the host (UFW, fail2ban, unattended upgrades; skipped when `coexist_with_proxy: true`) and installs Docker.
3. Checks out the exact Git SHA into a clean controller worktree, builds the environment-qualified image (`VITE_*` values are compiled in), pushes to the private registry, signs the digest with Cosign, and verifies the signature.
4. Pulls and verifies that exact digest on the VPS, renders mode-`0600` `.env`, runs database migrations, starts `app` and the consolidated `worker` service, and reloads Traefik/Caddy.
5. Installs systemd backup timers (`eurtisan-logical-backup`, `eurtisan-pgbackrest-diff`, `eurtisan-pgbackrest-full`, `eurtisan-backup-status`).

Production preflight requires the qualified staging digest as an explicit promotion input. See [release-promotion-and-rollback.md](./runbooks/release-promotion-and-rollback.md) for promotion, signing, canary, and rollback procedures.

`/opt/eurtisan/deploy.sh` is only for controlled local recovery of an already-pulled, Ansible-verified digest (it refuses to build source or run unverified digests). If a migration fails during rollout, the script rolls back the image only and exits non-zero; restore the database from backup/WAL if a destructive migration partially applied. Keep migrations backward-compatible whenever possible.

GitHub Actions is validation-only (lint, format, typecheck, tests, migrations, image smoke, Compose/Prometheus/Ansible checks). It never deploys to staging or production. See [release-quality-gates.md](./runbooks/release-quality-gates.md) and [staging-qualification.md](./runbooks/staging-qualification.md).

## 4. Environment and Provider Safety

Browser-visible `VITE_*` values are immutable build inputs (require a rebuild); server-only values are runtime inputs from Vault (require container recreation). See [environment-configuration.md](./runbooks/environment-configuration.md) for the full contract and credential rotation.

Staging enforces non-billable provider boundaries at both Ansible preflight and application boot:

- **Payments (Mollie):** Preflight and `server-environment.server.ts` require a `test_` key (`mollie_api_key_staging`) in staging and a `live_` key in production.
- **Shipping (Sendcloud API v3):** `SENDCLOUD_FORCE_UNSTAMPED_LETTER=true` and `SENDCLOUD_UNSTAMPED_LETTER_OPTION_CODE=sendcloud:letter` are pinned in staging so label creation fails closed instead of buying commercial carrier postage. Production requires `SENDCLOUD_FORCE_UNSTAMPED_LETTER=false`.
- **Email:** `docker-compose.staging.yml` hardcodes `EMAIL_SMTP_HOST=mailpit` (`1025`) so staging never sends external mail. Inspect Mailpit via SSH tunnel:
  ```bash
  ssh -L 8025:127.0.0.1:8025 <user>@<staging-ip> -N
  # open http://localhost:8025
  ```
- **Object storage & images:** Staging runs single-node Garage (`s3-staging.eurtisan.eu`); production uses Scaleway S3. Both expose imgproxy at same-origin `/uploads/*` via signed `/api/image` redirects.
- **Search (Meilisearch):** All search queries run through rate-limited server functions using the server-only master key (`MEILI_MASTER_KEY`, minimum 16 bytes). No search credential is shipped to browsers. After schema or ranking changes, rebuild atomically:
  ```bash
  # Production
  docker compose -f docker-compose.prod.yml run --rm app bun run search:reindex
  # Constrained staging host (avoids spawning a second app container)
  docker compose -f docker-compose.staging.yml exec -T worker bun run search:reindex
  ```
- **Staging access control:** Set `allowed_ips` in `secrets.yml`. In coexist mode, Ansible renders two Traefik routers in `/data/coolify/proxy/dynamic/eurtisan-staging.yml`: an IP-whitelisted router for the site and a higher-priority `/api/webhooks/` router so Mollie and Sendcloud webhooks reach staging. You can also tunnel directly to `127.0.0.1:3002`.

## 5. Backups and Recovery

Ansible configures systemd timers under the dedicated `eurtisan-backup` user:

| Schedule (UTC) | Unit | Purpose |
|---|---|---|
| Daily 03:00 | `eurtisan-logical-backup.timer` | Encrypted custom-format `pg_dump`, checksummed and test-restored into a disposable PG16 container (`256 MiB` limit) |
| Daily 02:00 | `eurtisan-pgbackrest-diff.timer` | Encrypted pgBackRest differential backup |
| Sunday 01:00 | `eurtisan-pgbackrest-full.timer` | Encrypted pgBackRest full backup |
| Continuous (`archive_timeout=900s`) | PostgreSQL `archive_command` | pgBackRest WAL archiving for PITR |
| Every 5 min | `eurtisan-backup-status.timer` | Publishes backup/WAL metrics to `POST /api/backup-report` |

**Recovery targets:**
- **RPO:** < 1 hour with remote WAL archiving; < 24 hours with nightly logical dumps only.
- **RTO:** < 4 hours (restore into a fresh isolated DB instance, verify, cut over).

Staging uses a local encrypted POSIX pgBackRest repo under `/opt/eurtisan/backups/` (exercises PITR locally, does not protect against host loss). Production preflight fails closed unless both encrypted off-site rclone replication and an HTTPS S3-compatible pgBackRest repository with separate least-privilege credentials are configured. Never run interactive `rclone config` on the VPS; Ansible renders rclone configuration from Vault.

Manual commands and restore steps live in [backup-restore.md](./runbooks/backup-restore.md). Run `make pgbackrest-check` locally to verify full backup, WAL archive, and PITR against a disposable container.

## 6. Metrics, Alerts, and Local Observability

- **Metrics:** `GET /api/metrics` (bearer-protected with `METRICS_TOKEN`), scraped by Prometheus/Alloy from `eurtisan-app:3000`.
- **Alert rules:** `infrastructure/observability/prometheus/rules/`, validated with `make promtool-check` and `make promtool-test`. Production preflight requires at least one Alertmanager receiver (`alertmanager_smtp_*` or `alertmanager_webhook_url`) in `secrets.yml`.
- **Local observability stack:** Run `make obs-up`, `make obs-status`, `make obs-logs`, and `make obs-down` (Grafana on `:3001`, Prometheus `:9090`, Alertmanager `:9093`, Loki `:3100`, Tempo `:3200`).

## Related References

- [Runbooks index](./runbooks/README.md) (outages, reconciliation, backups, qualification, rollbacks)
- [Audit log policy](./AUDIT_LOG_POLICY.md)
- [Infrastructure directory overview](../infrastructure/README.md)
