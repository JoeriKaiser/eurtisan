# Deployment Guide

Deploy Eurtisan to staging and production using Ansible and Docker.

---

## Prerequisites

- **Ansible** installed locally: `pip install ansible`
- **Docker and Cosign** on the trusted Ansible controller; release images are built there from a clean Git worktree, signed, and published to the environment's private registry
- **Two VPSes** (or one for staging + one for production):
  - Ubuntu 24.04 LTS
  - Staging: 2 vCPU / 4GB RAM minimum
  - Production: 4 vCPU / 8GB RAM recommended
- **SSH access** to the VPS as a user with passwordless `sudo` (or root)
- A host-specific read-only GitHub deploy key at `/root/.ssh/eurtisan_github_deploy`, registered for the private repository
- Domain **eurtisan.eu** with DNS management access

---

## 1. Configure Inventory

Inventory files are not committed (they contain your VPS IPs). Copy the examples and fill in your real values:

```bash
# One-time setup — copy examples to real files
make infra-init

# Then edit with your actual details
vi infrastructure/ansible/inventory/staging.yml
```

Replace the placeholders:

```yaml
ansible_host: REDACTED                # ← your VPS IP
ansible_user: ubuntu                      # ← your VPS username
ansible_ssh_private_key_file: ~/.ssh/id_rsa  # ← your SSH private key
```

### Staging on an existing VPS (e.g. with Coolify)

If staging shares a VPS with Coolify or another reverse proxy, set:

```yaml
coexist_with_proxy: true
```

This skips Caddy and UFW configuration. The app exposes an optional HTTP fallback at `127.0.0.1:3002`; the existing proxy handles SSL and routes to the container over the shared Docker network.

---

## 2. Set Secrets

Create `infrastructure/ansible/secrets.yml` (never commit this file). One
encrypted Vault serves both environments: staging values carry a `_staging`
suffix, production owns the canonical names, and `group_vars/staging.yml`
maps the suffixed keys to the canonical ones the role consumes. That keeps
colliding credentials (database password, Meilisearch keys, Mollie test/live
API keys, storage keys) separate in a single file.

Staging keys: `postgres_password_staging`, `meilisearch_api_key_staging`, …
Production keys: start from `infrastructure/ansible/secrets.production.example.yml`,
which lists every launch-required key with its source and generation command.

Generate secrets quickly:

```bash
make infra-secrets
```

---

## 3. Provision the Servers

### Staging

```bash
make infra-setup-staging
```

### Production

```bash
make infra-setup-production
```

Ansible will:

1. Harden the server (UFW, fail2ban, auto-updates) — skipped on staging if `coexist_with_proxy: true`
2. Install Docker + Docker Compose plugin
3. Clone the repository to `/opt/eurtisan`
4. Build the exact release in an isolated controller worktree, publish and sign its immutable digest, then pull and verify that digest on the target
5. Write the `.env` file with the qualified repository digest
6. Run database migrations and start all services
7. Schedule nightly database backups at 03:00 UTC

---

## 4. Point DNS

Add A records:

| Record | Target |
|--------|--------|
| `staging.eurtisan.eu` | Staging VPS IP |
| `registry-staging.eurtisan.eu` | Staging VPS IP (required for the self-hosted registry) |
| `eurtisan.eu` | Production VPS IP |
| `www.eurtisan.eu` | Production VPS IP (optional) |

Caddy on production automatically provisions Let's Encrypt certificates on the first HTTPS request.

---

## 5. Deployment

Production configuration is validated before application startup. Browser-visible
`VITE_*` values are immutable image build inputs; changing one requires rebuilding
and rolling out the image, not merely restarting a container. Server-only secrets
remain runtime inputs from Ansible Vault. See
[Production environment and client-build configuration](./runbooks/environment-configuration.md)
for routing, validation, ownership, and rotation procedures.

Deploy through Ansible from the trusted controller:

```bash
make infra-setup-staging
make infra-setup-production
```

The controller checks out the exact remote Git SHA into a clean temporary worktree,
builds the environment-qualified variant, and publishes it to the environment's
private registry. Staging uses the authenticated registry on the existing staging
VPS at `registry-staging.eurtisan.eu`; production uses Scaleway Container Registry
in `fr-par`. The controller signs the immutable digest with the protected offline
Cosign key and verifies the signature before the target pulls that digest. The
target verifies the repository digest and OCI revision before migrations. No
application image compilation occurs on a VPS. Production additionally requires
the qualified staging digest as an explicit promotion input; see
[Signed release promotion and rollback](./runbooks/release-promotion-and-rollback.md).

`/opt/eurtisan/deploy.sh` is retained for controlled recovery of an image digest that
Ansible already pulled and verified. It refuses to build source or deploy an image
whose OCI revision or repository digest differs from Ansible-managed metadata.

### Smoke tests & rollback

After `docker compose up -d`, the script polls:

- `/api/health/ready` — critical dependencies (DB, Meilisearch, disk)
- `/api/health/live` — process liveness
- `/api/health` — critical dependencies (lightweight)

If any probe fails within the timeout (120s by default), the script:

1. Sends an alert to `DEPLOY_ALERT_WEBHOOK` (or `BACKUP_ALERT_WEBHOOK` if unset).
2. Rolls back to `eurtisan-app:rollback-before-deploy`, which Ansible creates only after verifying the previous registry digest's signature.
3. Re-runs smoke tests against the rollback image.
4. Exits non-zero so callers (CI/CD, `make deploy`) know the deploy failed.

To bypass smoke tests in an emergency:

```bash
/opt/eurtisan/deploy.sh --skip-smoke-test main
```

### Migration rollback plan

Migrations run **before** services are restarted. If a migration fails, the deploy script rolls back to the previous image and exits. The database is not touched by the rollback; because migrations run first, a failed migration leaves the schema partially applied. Treat migration failures as a production incident:

1. Inspect the migration output from the deploy script.
2. If the migration was destructive or inconsistent, restore the database from the most recent nightly backup plus WAL archives (see [docs/runbooks/backup-restore.md](./runbooks/backup-restore.md)).
3. Fix the migration in a new commit and redeploy.

For this reason, migrations must be backward-compatible when possible, and a current verified backup must exist before every production deploy.

### Deploy notifications

Set in `infrastructure/ansible/secrets.yml`:

```yaml
deploy_alert_webhook: "https://hooks.slack.com/services/..."
```

### Canary deployments

For a cautious rollout, deploy a single canary container before switching all traffic:

```bash
# Deploy latest main to production with canary validation
ssh -i ~/.ssh/server_id_rsa_1 ubuntu@PROD_IP '/opt/eurtisan/deploy.sh --canary main'
```

What it does:

1. Verifies the controller-built image and runs database migrations as usual.
2. Starts one temporary `eurtisan-app-canary` container on `127.0.0.1:3001`.
3. Polls `/api/health/ready` until the canary reports healthy.
4. Observes the canary for `CANARY_STABILIZE_SECONDS` (default: 300).
5. If the canary stays healthy, removes it and proceeds with the normal full rollout (`docker compose up -d`) and smoke tests.

Failure behavior:

- If the canary never becomes healthy or fails during stabilization, the script stops and removes the canary container and exits non-zero.
- Production remains on the previous image; no traffic is switched.
- An alert is sent to `DEPLOY_ALERT_WEBHOOK`.

Environment variables:

- `CANARY_PORT` — port the canary binds to (default: `3001`). On staging, set this to `3003` because Grafana and the staging app fallback use ports `3001` and `3002`.
- `CANARY_STABILIZE_SECONDS` — observation period after initial health (default: `300`).

This is a single-host manual canary; it validates the new image in isolation but does not route live production traffic to the canary. True blue/green load-balanced canaries are future work.

### Accessing Staging

**Option A — SSH Tunnel (most secure):**

From your local machine:

```bash
ssh -i ~/.ssh/server_id_rsa -L 3002:127.0.0.1:3002 ubuntu@STAGING_IP -N
```

Then open `http://localhost:3002` in your browser.

**Option B — Direct access with IP whitelist:**

Add `app_access_ips` to your `secrets.yml` and re-run the playbook:

```yaml
# secrets.yml
app_access_ips: "YOUR_PUBLIC_IP"
```

Find your public IP at https://ip.sb/

Then run:

```bash
make infra-setup-staging
```

Ansible will open port 3002 in UFW, restricted to your IP only, and rebind the app to all interfaces. Access it at `http://STAGING_IP:3002`.

---

### Staging Configuration

**Object storage:** Staging runs a single-node Garage service in the staging Compose
stack. Add an A record for `s3-staging.eurtisan.eu` pointing to the staging VPS before
provisioning. Ansible initializes the Garage layout, imports the staging-only S3 key,
creates `eurtisan-staging-uploads`, grants access, and configures browser-upload CORS.
Scaleway S3 is reserved for production.

**Emails:** Staging automatically routes emails through **Mailpit** (captured, not sent). View captured emails at `http://STAGING_IP:8025` via SSH tunnel:

```bash
ssh -i ~/.ssh/server_id_rsa -L 8025:127.0.0.1:8025 ubuntu@STAGING_IP -N
```

Then open `http://localhost:8025`.

Staging email is hardcoded to Mailpit in `docker-compose.staging.yml` (`EMAIL_SMTP_HOST=mailpit`, `EMAIL_SMTP_PORT=1025`). These compose-level environment variables override any accidental `.env` value, so staging can never send real email even if a production `.env` is copied in by mistake. `BREVO_API_KEY` must never be set in staging `.env`.

**Seller notification digest:** `notification-digest` is a production-critical, advisory-locked worker in both Compose stacks. It retries the previous completed UTC day on its hourly poll, creates at most one `seller_updates` outbox row per seller/day, and staging deliveries remain visible only in Mailpit. Confirm the worker is running after rollout and investigate a stale `notification-digest` job metric or failed tick before the next UTC day closes.

**Payments (Mollie):** Use Mollie's **test API key** in staging. No real money is charged. Set in `secrets.yml`:

```yaml
mollie_api_key: "test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Shipping (Mondial Relay):** Use their sandbox/test credentials in staging. No real shipments are created.

---

### CI and deployment boundary

GitHub Actions runs validation for pull requests and pushes to `main`:

- unit and browser tests
- TypeScript, formatting, and lint checks
- migration-chain validation
- Prometheus and Ansible validation
- production image build validation

The workflow is deliberately not a deployment pipeline. It never invokes
`deploy.sh`, accesses a VPS, or changes staging/production. Deployments remain
manual through the SSH commands in this document. Reproduce each CI stage with
[release-quality-gates.md](./runbooks/release-quality-gates.md). Before any production
promotion, complete the evidence process in
[staging-qualification.md](./runbooks/staging-qualification.md); local CI and mocked E2E
are not substitutes for authorized provider, backup/restore, alert, and EU-region
staging evidence.

---

## 6. Restrict Staging Access (IP Whitelisting)

### Option A: Coolify / Traefik (recommended for coexist mode)

If staging runs behind Coolify, add an IP whitelist middleware in your Coolify service configuration:

```yaml
# In Coolify's Traefik labels or middleware config
traefik.http.middlewares.staging-whitelist.ipwhitelist.sourcerange=REDACTED.1/32,REDACTED.2/32
traefik.http.routers.staging.middlewares=staging-whitelist
```

### Option B: UFW (for standalone staging)

If staging uses its own Caddy (`coexist_with_proxy: false`), pass `allowed_ips` in your `secrets.yml` and Ansible configures UFW automatically during provisioning:

```yaml
# secrets.yml
allowed_ips: "REDACTED.1,REDACTED.2"
```

Or configure manually:

```bash
# Allow only specific IPs to reach HTTP/HTTPS
ufw delete allow 80/tcp
ufw delete allow 443/tcp
ufw allow from REDACTED.1 to any port 80 proto tcp
ufw allow from REDACTED.1 to any port 443 proto tcp
ufw allow from REDACTED.2 to any port 80 proto tcp
ufw allow from REDACTED.2 to any port 443 proto tcp
ufw reload
```

### Option C: Caddy `remote_ip` matcher

For standalone staging, you can also edit the `Caddyfile` to block by IP before the request reaches the app:

```caddy
{$CADDY_DOMAIN} {
	@not_whitelisted not remote_ip REDACTED.1 REDACTED.2
	respond @not_whitelisted "Forbidden" 403

	reverse_proxy app:3000
}
```

Restart Caddy after editing:

```bash
docker compose -f docker-compose.prod.yml restart caddy
```

---

## 7. Backups

Ansible manages three complementary recovery paths:

1. A verified PostgreSQL custom-format logical dump at 03:00 UTC.
2. An encrypted pgBackRest differential backup at 02:00 UTC and full backup on Sunday at 01:00 UTC.
3. Continuous pgBackRest WAL archiving with a 15-minute `archive_timeout`.

Staging uses a local encrypted pgBackRest repository so backup and PITR behavior can
be exercised before remote storage exists. This does not protect against loss of the
staging host. Production preflight requires both encrypted rclone replication and an
S3-compatible pgBackRest repository, so production cannot deploy with the local-only
configuration.

Systemd owns scheduling, persistence after missed runs, execution timeouts, and
journald state. Structured backup logs are also appended to
`/var/log/eurtisan-backup.log`. The backup scripts and protected configuration are
readable only by root and the `eurtisan-backup` operator.

Logical dumps are written under `/opt/eurtisan/backups/logical`, checksummed, restored
into a disposable PostgreSQL 16 container, and checked for critical tables before
being retained or uploaded. Off-site logical backups and upload replicas are encrypted
with rclone crypt. Upload replication uses copy-only credentials; destination
versioning/Object Lock and lifecycle retain overwritten or source-deleted objects.
The VPS is not granted broad deletion solely to implement retention.

Do not run interactive `rclone config` on the VPS. Ansible renders rclone remotes from
Vault-backed values for the scheduled operator. Remote bootstrap still requires an
EU object-storage endpoint, buckets, lifecycle/Object Lock policy, and least-privilege
credentials. Once available, add the values documented in
`infrastructure/ansible/group_vars/all.yml` to encrypted `secrets.yml`, then run:

```bash
make infra-setup-staging
make infra-setup-production
```

Manual operations:

```bash
sudo systemctl start eurtisan-logical-backup.service
sudo -u eurtisan-backup /opt/eurtisan/pgbackrest-backup.sh diff
sudo -u eurtisan-backup /opt/eurtisan/pgbackrest-backup.sh full
systemctl list-timers 'eurtisan-*backup*'
```

Never restore a dump over the existing production database. Follow
[Backup and point-in-time recovery](./runbooks/backup-restore.md) to restore into a
fresh isolated PostgreSQL instance or volume, verify it, and perform an approved
cutover.

---

## Directory Reference

```
infrastructure/
├── ansible/
│   ├── inventory/
│   │   ├── staging.yml              # Your real staging IP (gitignored)
│   │   ├── staging.example.yml      # Example template (committed)
│   │   ├── production.yml           # Your real production IP (gitignored)
│   │   └── production.example.yml   # Example template (committed)
│   ├── group_vars/
│   │   └── all.yml                  # Shared variables
│   ├── playbook.yml                 # Main Ansible playbook
│   └── roles/
│       ├── common/                  # Server hardening + Docker
│       └── eurtisan/                # App deployment
├── README.md                        # Detailed infrastructure docs
```


---

## Recovery objectives (RTO / RPO)

| Objective | Target | Notes |
|-----------|--------|-------|
| **RPO** (max data loss) | **< 1 hour** with remote WAL archiving; **< 24 hours** with nightly logical backups only | 15-minute WAL segment timeout plus transfer time; nightly verified logical dump |
| **RTO** (max downtime) | **< 4 hours** | Restore DB from backup + redeploy app; communicate via status channel |

## WAL archiving (PostgreSQL PITR)

`Dockerfile.postgres` adds a pinned pgBackRest client to the pinned PostgreSQL 16
image. Ansible builds this infrastructure image in a clean release worktree on
the trusted controller, verifies both versions, transfers it over the protected
Ansible channel, and never compiles it on the VPS.

When `postgres_wal_archive_enabled` is true, the managed Compose override configures:

```text
archive_mode=on
archive_command=pgbackrest --stanza=eurtisan archive-push %p
archive_timeout=900s
```

The pgBackRest repository is encrypted independently of application column
encryption. Staging uses `pgbackrest_repository_type: posix`; production preflight
requires `pgbackrest_repository_type: s3`, HTTPS object storage, a repository bucket,
and dedicated credentials. pgBackRest owns WAL expiration relative to retained base
backups—WAL files are never pruned independently by file age.

Run `make pgbackrest-check` to exercise a disposable full backup, WAL archive, and
time-targeted restore. A real isolated staging restore, encrypted-column verification,
and measured RPO/RTO remain mandatory before production approval. See
[Backup and point-in-time recovery](./runbooks/backup-restore.md).

## Transactional email DNS

Before sending live mail, complete SPF, DKIM, and DMARC per [docs/EMAIL_DNS.md](./EMAIL_DNS.md).

## Object storage, image, and search routing

Product and shop images use **S3-compatible storage** (Garage locally and on staging, Scaleway in production) with presigned uploads — see `.env.example` (`S3_*`, `IMGPROXY_*`). Staging exposes Garage's authenticated S3 API at `s3-staging.eurtisan.eu`; the Garage admin API remains private. This allows horizontal scaling without shared local disk.

Shared environments expose imgproxy at the same-origin `/uploads` route. Caddy and
the Ansible-managed staging Traefik route strip this prefix before forwarding to
the private container. Browser image elements use `/api/image` with bounded
object-key and resize parameters; that server endpoint redirects to a signed
`/uploads/...` path. This preserves responsive images without shipping the
imgproxy key or permitting unsigned open-proxy requests.

Search runs through the app: overlay suggestions and search results go through
rate-limited server functions that query Meilisearch with the server-only master
key. No Meilisearch route is exposed at the edge, and no search credential ships
in the client bundle. See the [Meilisearch runbook](runbooks/meilisearch-failure.md).

### Reindexing after a deploy

Meilisearch applies index settings only to documents indexed *after* the change, so a
deploy that alters searchable attributes, ranking rules, synonyms, `localizedAttributes`,
or the document shape must be followed by a rebuild:

```
docker compose -f docker-compose.prod.yml run --rm app bun run search:reindex
```

This builds a complete index alongside the live one and swaps them atomically, so
search keeps serving the previous generation throughout — never clear the index and
repopulate in production, which empties the storefront for the duration.

Note that `MEILI_MASTER_KEY` must be at least 16 bytes: the containers run with
`MEILI_ENV=production`, which enforces that minimum and exits on boot if the key is
shorter.

## Prometheus metrics

The app exposes `GET /api/metrics` for Prometheus. Optional protection: set `METRICS_TOKEN` and configure scrape `authorization: Bearer <token>`.

Grafana Alloy/Prometheus should scrape `eurtisan-app:3000` with `metrics_path: /api/metrics`.

Alert rules live in `infra/observability/prometheus/rules/` and cover app health, database connectivity, Meilisearch health, disk space, job alert logs, payment-webhook errors, and checkout failures. Validate them with:

```bash
make promtool-check
```

### Backup metrics

Logical and physical jobs report results to `POST /api/backup-report` using
`BACKUP_REPORT_TOKEN` (falling back to `METRICS_TOKEN`). A five-minute status timer
re-publishes persisted completion times and PostgreSQL archive state after app
restarts. Prometheus exposes:

- `eurtisan_backup_success_total`
- `eurtisan_backup_failures_total`
- `eurtisan_backup_last_success_timestamp_seconds{backup_type=...}`
- `eurtisan_postgres_wal_archive_failed_count`
- `eurtisan_postgres_wal_archive_pending_files`

The backup alert group covers explicit failures, stale logical/full/differential
backups, WAL failures, and a WAL backlog that does not drain. See
[Backup and point-in-time recovery](./runbooks/backup-restore.md).

## Local observability stack

A self-contained Grafana stack (Prometheus, Loki, Tempo, Alertmanager, Alloy) is available for local development. It tails logs from all `eurtisan-*` Docker containers, receives Faro RUM beacons, and scrapes app metrics.

Start it after the main dev stack is up:

```bash
cp .env.observability.example .env.local   # adjust if needed
make obs-up
```

Check status:

```bash
make obs-status
```

Default local endpoints:

| Service | URL |
|---------|-----|
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| Loki | http://localhost:3100 |
| Tempo | http://localhost:3200 |

> **Note:** Grafana defaults to port `3001` in the observability compose file to avoid conflicting with the app on port `3000`.

Stop the stack:

```bash
make obs-down
```

View logs:

```bash
make obs-logs
```

## Alertmanager configuration

At least one alert receiver is required in production. Configure one or both of the following in `infrastructure/ansible/secrets.yml`:

```yaml
alertmanager_smtp_host: "smtp.example.com"
alertmanager_smtp_port: "587"
alertmanager_smtp_from: "alerts@eurtisan.eu"
alertmanager_smtp_to: "ops@eurtisan.eu"
# or
alertmanager_webhook_url: "https://hooks.slack.com/services/..."
```

The playbook fails fast if neither is configured in production (`coexist_with_proxy: false`). In local/dev mode, Alertmanager defaults to the `null` receiver (alerts are logged but not sent).

## Incident runbooks

See [docs/runbooks/README.md](./runbooks/README.md) for database, payments, Meilisearch, disk, backup, and chargeback procedures.

## Audit logging

See [AUDIT_LOG_POLICY.md](./AUDIT_LOG_POLICY.md) for which admin actions are audited.
