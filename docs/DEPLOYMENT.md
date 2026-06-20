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

Deploy manually via SSH. Run the deploy script on the VPS:

```bash
# Deploy latest main to staging
ssh -i ~/.ssh/server_id_rsa_1 ubuntu@STAGING_IP 'COMPOSE_FILE=docker-compose.staging.yml /opt/eurtisan/deploy.sh main'

# Deploy a specific tag to production
ssh -i ~/.ssh/server_id_rsa_1 ubuntu@PROD_IP '/opt/eurtisan/deploy.sh v1.2.3'
```

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

### Automated CI/CD (optional, future)

Codeberg uses Forgejo, which supports [Forgejo Actions](https://forgejo.org/docs/next/user/actions/) (GitHub Actions–compatible). You can add a `.forgejo/workflows/deploy.yml` later to automate deploys on push/tag. For now, manual deployment keeps things simple and avoids relying on third-party CI runners.

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

Database backups run automatically every night at 03:00 UTC. Backups are stored in `/opt/eurtisan/backups/` and retained for 7 days.

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

Production should enable continuous archiving to S3-compatible storage (same bucket family as uploads):

1. Mount or configure `archive_command` to copy `%p` WAL segments to object storage
2. Set `archive_mode = on`, `wal_level = replica` in PostgreSQL config
3. Test restore quarterly using [docs/runbooks/backup-restore.md](./runbooks/backup-restore.md)

Ansible variables (see `infrastructure/ansible/group_vars/all.yml`):

- `postgres_wal_archive_enabled: true`
- `postgres_wal_archive_path` — object storage prefix for WAL files

## Transactional email DNS

Before sending live mail, complete SPF, DKIM, and DMARC per [docs/EMAIL_DNS.md](./EMAIL_DNS.md).

## Object storage (uploads)

Product and shop images use **S3-compatible storage** (Garage locally, Scaleway in production) with presigned uploads — see `.env.example` (`S3_*`, `IMGPROXY_*`). This allows horizontal scaling without shared local disk.

## Prometheus metrics

The app exposes `GET /api/metrics` for Prometheus. Optional protection: set `METRICS_TOKEN` and configure scrape `authorization: Bearer <token>`.

Grafana Alloy/Prometheus should scrape `eurtisan-app:3000` with `metrics_path: /api/metrics`.

## Incident runbooks

See [docs/runbooks/README.md](./runbooks/README.md) for database, payments, Meilisearch, disk, backup, and chargeback procedures.

## Audit logging

See [AUDIT_LOG_POLICY.md](./AUDIT_LOG_POLICY.md) for which admin actions are audited.
