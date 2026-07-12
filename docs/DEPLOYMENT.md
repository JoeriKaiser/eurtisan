# Deployment Guide

Deploy Eurtisan to staging and production using Ansible and Docker.

---

## Prerequisites

- **Ansible** installed locally: `pip install ansible`
- **Two VPSes** (or one for staging + one for production):
  - Ubuntu 24.04 LTS
  - Staging: 4 vCPU / 8GB RAM recommended (2 vCPU / 4GB is the bare minimum and will rely heavily on swap during builds)
  - Production: 4 vCPU / 8GB RAM recommended
- **SSH access** to the VPS as a user with passwordless `sudo` (or root)
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

This skips Caddy and UFW configuration. The app binds to `127.0.0.1:3001` and your existing proxy handles SSL and routing.

---

## 2. Set Secrets

Create `infrastructure/ansible/secrets.yml` (never commit this file):

```yaml
postgres_password: "your-very-strong-db-password"
better_auth_secret: "$(openssl rand -base64 32)"
meilisearch_api_key: "$(openssl rand -base64 32)"

# Optional — restrict standalone staging to specific IPs (comma-separated)
# Not used when coexist_with_proxy is true (configure whitelist in your proxy instead)
allowed_ips: ""
```

Generate secrets quickly:

```bash
make infra-secrets
```

Add optional secrets (Mollie, Brevo, Grafana) to the same file as needed.

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
4. Write the `.env` file
5. Start all services
6. Run database migrations
7. Schedule nightly database backups at 03:00 UTC

---

## 4. Point DNS

Add A records:

| Record | Target |
|--------|--------|
| `staging.eurtisan.eu` | Staging VPS IP |
| `eurtisan.eu` | Production VPS IP |
| `www.eurtisan.eu` | Production VPS IP (optional) |

Caddy on production automatically provisions Let's Encrypt certificates on the first HTTPS request.

---

## 5. Deployment

Deploy manually via SSH. The deploy script tags the currently running image as `eurtisan-app:rollback-before-deploy`, builds the new image, runs migrations, starts the services, and then performs post-deploy smoke tests.

```bash
# Deploy latest main to staging
ssh -i ~/.ssh/server_id_rsa_1 ubuntu@STAGING_IP 'COMPOSE_FILE=docker-compose.staging.yml /opt/eurtisan/deploy.sh main'

# Deploy a specific tag to production
ssh -i ~/.ssh/server_id_rsa_1 ubuntu@PROD_IP '/opt/eurtisan/deploy.sh v1.2.3'
```

### Smoke tests & rollback

After `docker compose up -d`, the script polls:

- `/api/health/ready` — critical dependencies (DB, Meilisearch, disk)
- `/api/health/live` — process liveness
- `/api/health` — critical dependencies (lightweight)

If any probe fails within the timeout (120s by default), the script:

1. Sends an alert to `DEPLOY_ALERT_WEBHOOK` (or `BACKUP_ALERT_WEBHOOK` if unset).
2. Rolls back to `eurtisan-app:rollback-before-deploy`.
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

1. Builds the new image and runs database migrations as usual.
2. Starts one temporary `eurtisan-app-canary` container on `127.0.0.1:3001`.
3. Polls `/api/health/ready` until the canary reports healthy.
4. Observes the canary for `CANARY_STABILIZE_SECONDS` (default: 300).
5. If the canary stays healthy, removes it and proceeds with the normal full rollout (`docker compose up -d`) and smoke tests.

Failure behavior:

- If the canary never becomes healthy or fails during stabilization, the script stops and removes the canary container and exits non-zero.
- Production remains on the previous image; no traffic is switched.
- An alert is sent to `DEPLOY_ALERT_WEBHOOK`.

Environment variables:

- `CANARY_PORT` — port the canary binds to (default: `3001`). On staging, set this to `3002` because `docker-compose.staging.yml` already maps `127.0.0.1:3001:3000`.
- `CANARY_STABILIZE_SECONDS` — observation period after initial health (default: `300`).

This is a single-host manual canary; it validates the new image in isolation but does not route live production traffic to the canary. True blue/green load-balanced canaries are future work.

### Accessing Staging

**Option A — SSH Tunnel (most secure):**

From your local machine:

```bash
ssh -i ~/.ssh/server_id_rsa -L 3001:127.0.0.1:3001 ubuntu@STAGING_IP -N
```

Then open `http://localhost:3001` in your browser.

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

Ansible will open port 3001 in UFW, restricted to your IP only, and rebind the app to all interfaces. Access it at `http://STAGING_IP:3001`.

---

### Staging Configuration

**Emails:** Staging automatically routes emails through **Mailpit** (captured, not sent). View captured emails at `http://STAGING_IP:8025` via SSH tunnel:

```bash
ssh -i ~/.ssh/server_id_rsa -L 8025:127.0.0.1:8025 ubuntu@STAGING_IP -N
```

Then open `http://localhost:8025`.

Staging email is hardcoded to Mailpit in `docker-compose.staging.yml` (`EMAIL_SMTP_HOST=mailpit`, `EMAIL_SMTP_PORT=1025`). These compose-level environment variables override any accidental `.env` value, so staging can never send real email even if a production `.env` is copied in by mistake. `BREVO_API_KEY` must never be set in staging `.env`.

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
manual through the SSH commands in this document.

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

Database backups run automatically every night at 03:00 UTC. Backups are stored in `/opt/eurtisan/backups/` and retained for **30 days** (`BACKUP_RETENTION_DAYS`).

Every backup is:

1. Dumped with `pg_dump` and compressed with `gzip`.
2. Restored into a temporary PostgreSQL container to verify integrity and expected tables.
3. Optionally uploaded off-site via `rclone` when `BACKUP_OFFSITE_RCLONE_REMOTE` is configured.
4. Pruned locally and off-site according to retention policies.

When off-site upload is configured, the backup script sends a warning alert if the upload fails but exits non-zero, so the failure is surfaced even though the local backup is valid.

### Meilisearch & S3 uploads

The backup script also creates a Meilisearch dump and, when `BACKUP_S3_UPLOADS_RCLONE_REMOTE` is set, syncs the S3 uploads bucket off-site. These are best-effort: failures are logged and alerted but do not fail the database backup.

### Configure off-site upload

1. Install and configure an rclone remote on the VPS:

   ```bash
   ssh ubuntu@PROD_IP
   rclone config
   ```

2. Set in `infrastructure/ansible/secrets.yml` or `group_vars/all.yml`:

   ```yaml
   backup_offsite_rclone_remote: "s3:eurtisan-backups/database"
   backup_s3_uploads_rclone_remote: "s3:eurtisan-backups/uploads"
   ```

3. Re-run the playbook to render the updated backup script:

   ```bash
   make infra-setup-production
   ```

### Manual backup

```bash
ssh -i ~/.ssh/server_id_rsa_1 ubuntu@VPS_IP '/opt/eurtisan/backup.sh'
```

### Restore from backup

```bash
ssh -i ~/.ssh/server_id_rsa_1 ubuntu@VPS_IP
cd /opt/eurtisan

# Stop the app
docker compose -f docker-compose.prod.yml stop app

# Restore
gunzip -c backups/eurtisan-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U eurtisan -d eurtisan

# Restart the app
docker compose -f docker-compose.prod.yml start app
```

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
| **RPO** (max data loss) | **< 1 hour** with WAL archiving to object storage; **< 24 hours** with nightly backups only | Nightly dump at 03:00 UTC; enable WAL for production |
| **RTO** (max downtime) | **< 4 hours** | Restore DB from backup + redeploy app; communicate via status channel |

## WAL archiving (PostgreSQL PITR)

Production should enable continuous archiving. The default Ansible configuration writes WAL segments to a local host path mounted into the container:

```yaml
# infrastructure/ansible/group_vars/all.yml
postgres_wal_archive_enabled: true
postgres_wal_archive_path: "/opt/eurtisan/backups/wal"
```

This path is mounted into the `db` service via `docker-compose.wal-archive.yml` and `archive_command` copies each completed WAL segment there.

For S3-compatible object storage, set the S3 variables in `secrets.yml` or `group_vars/all.yml`:

```yaml
postgres_wal_archive_s3_bucket: "eurtisan-backups"
postgres_wal_archive_s3_endpoint: "https://s3.fr-par.scw.cloud"
postgres_wal_archive_s3_region: "fr-par"
postgres_wal_archive_s3_access_key: "your-access-key"
postgres_wal_archive_s3_secret_key: "your-secret-key"
```

When the S3 bucket is configured, Ansible installs the AWS CLI in the DB container and uses `aws s3 cp` as the `archive_command`. Do **not** enable `archive_mode` without a working archive path, or PostgreSQL will stall.

Quarterly restore tests (including PITR) are required — see [docs/runbooks/backup-restore.md](./runbooks/backup-restore.md).

Ansible variables (see `infrastructure/ansible/group_vars/all.yml`):

- `postgres_wal_archive_enabled: true`
- `postgres_wal_archive_path` — local path for WAL files
- `postgres_wal_archive_s3_*` — optional S3 destination for WAL segments

## Transactional email DNS

Before sending live mail, complete SPF, DKIM, and DMARC per [docs/EMAIL_DNS.md](./EMAIL_DNS.md).

## Object storage (uploads)

Product and shop images use **S3-compatible storage** (Garage locally, Scaleway in production) with presigned uploads — see `.env.example` (`S3_*`, `IMGPROXY_*`). This allows horizontal scaling without shared local disk.

## Prometheus metrics

The app exposes `GET /api/metrics` for Prometheus. Optional protection: set `METRICS_TOKEN` and configure scrape `authorization: Bearer <token>`.

Grafana Alloy/Prometheus should scrape `eurtisan-app:3000` with `metrics_path: /api/metrics`.

Alert rules live in `infra/observability/prometheus/rules/` and cover app health, database connectivity, Meilisearch health, disk space, job alert logs, payment-webhook errors, and checkout failures. Validate them with:

```bash
make promtool-check
```

### Backup metrics

The backup script reports the outcome of every nightly run to `POST /api/backup-report` using `BACKUP_REPORT_TOKEN` (falls back to `METRICS_TOKEN`). This exposes two Prometheus counters:

- `eurtisan_backup_success_total`
- `eurtisan_backup_failures_total`

The alert rule `EurtisanBackupFailed` fires when `eurtisan_backup_failures_total` increases. See [docs/runbooks/backup-restore.md](./runbooks/backup-restore.md) for restore procedures.

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
