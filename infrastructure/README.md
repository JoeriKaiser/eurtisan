# Eurtisan Infrastructure

Provider-agnostic IaC for deploying Eurtisan on any VPS.

## What's Included

| Tool | Purpose |
|------|---------|
| **Ansible** | Server hardening, Docker installation, app deployment |
| **Caddy** | Reverse proxy with automatic HTTPS (Let's Encrypt) |
| **Docker Compose** | Container orchestration (app, PostgreSQL, Meilisearch) |
| **Forgejo Actions** | Optional future CI/CD via Codeberg (not configured yet) |

## Prerequisites

1. **A VPS** running Ubuntu 24.04 (or any Debian-based distro)
   - Staging: 2 vCPU / 4GB RAM minimum
   - Production: 4 vCPU / 8GB RAM recommended
2. **Ansible** installed on your local machine:
   ```bash
   pip install ansible
   ```
3. **SSH access** to the VPS as root (for initial provisioning)
4. A **Codeberg** account with the repository pushed

## Quick Start

### 1. Configure Inventory

Inventory files contain your VPS IPs and are **not committed**. Copy the examples and fill in your real values:

```bash
# One-time setup
cp infrastructure/ansible/inventory/staging.example.yml infrastructure/ansible/inventory/staging.yml
cp infrastructure/ansible/inventory/production.example.yml infrastructure/ansible/inventory/production.yml

# Edit with your actual IPs
vi infrastructure/ansible/inventory/staging.yml
vi infrastructure/ansible/inventory/production.yml
```

**Staging on an existing VPS (e.g. with Coolify):**
Set `coexist_with_proxy: true` in `inventory/staging.yml`. This skips Caddy and UFW so the existing reverse proxy owns ports 80/443. The app binds to `127.0.0.1:3001` and your proxy routes to it.

### 2. Set Secrets

Secrets are passed at runtime (never committed). Create a secrets file:

```yaml
# secrets.yml
postgres_password: "your-very-strong-db-password"
better_auth_secret: "$(openssl rand -base64 32)"
meilisearch_api_key: "$(openssl rand -base64 32)"
```

### 3. Run the Playbook

**Staging:**
```bash
cd infrastructure/ansible
ansible-playbook -i inventory/staging.yml playbook.yml -e @secrets.yml
```

**Production:**
```bash
cd infrastructure/ansible
ansible-playbook -i inventory/production.yml playbook.yml -e @secrets.yml
```

The playbook will:
1. Harden the server (UFW, fail2ban, auto-updates)
2. Install Docker + Docker Compose plugin
3. Clone the repository to `/opt/eurtisan`
4. Write the `.env` file
5. Start all services
6. Run database migrations
7. Set up nightly database backups

### 4. Point DNS

Set an A record for your domain/subdomain pointing to the VPS IP:
- `staging.eurtisan.eu` → staging VPS IP
- `eurtisan.eu` + `www.eurtisan.eu` → production VPS IP

Caddy will automatically provision Let's Encrypt certificates on first request.

## Deployment

### Manual Deploy

SSH to the VPS and run the deploy script:

```bash
# Deploy latest main to staging
ssh root@STAGING_IP 'COMPOSE_FILE=docker-compose.staging.yml /opt/eurtisan/deploy.sh main'

# Deploy a specific tag to production
ssh root@PROD_IP '/opt/eurtisan/deploy.sh v1.2.3'
```

### Automated Deploy (optional, future)

Codeberg uses Forgejo, which supports [Forgejo Actions](https://forgejo.org/docs/next/user/actions/) (GitHub Actions–compatible). You can add a `.forgejo/workflows/deploy.yml` later to automate deploys on push/tag. For now, manual deployment keeps things simple and avoids relying on third-party CI runners.

## Directory Structure

```
infrastructure/
├── ansible/
│   ├── ansible.cfg
│   ├── inventory/
│   │   ├── staging.yml              # Your real staging IP (gitignored)
│   │   ├── staging.example.yml      # Example template (committed)
│   │   ├── production.yml           # Your real production IP (gitignored)
│   │   └── production.example.yml   # Example template (committed)
│   ├── group_vars/
│   │   ├── all.yml                  # Shared variables
│   │   ├── staging.yml              # Staging overrides
│   │   └── production.yml           # Production overrides
│   ├── playbook.yml
│   ├── roles/
│   │   ├── common/                  # Server hardening + Docker
│   │   └── eurtisan/                # App deployment
│   └── files/
│       └── deploy.sh                # VPS deploy script
└── README.md
```

## Backup & Recovery

Database backups run nightly at 03:00 UTC and are stored in `/opt/eurtisan/backups/`.
Backups older than 7 days are automatically pruned.

### Manual backup
```bash
ssh root@VPS_IP '/opt/eurtisan/backup.sh'
```

### Restore from backup
```bash
ssh root@VPS_IP
cd /opt/eurtisan
# Stop app
docker compose -f docker-compose.prod.yml stop app
# Restore
gunzip -c backups/eurtisan-YYYYMMDD-HHMMSS.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U eurtisan -d eurtisan
# Restart app
docker compose -f docker-compose.prod.yml start app
```

## Staging Access Control

When `coexist_with_proxy: true`, the app binds to `127.0.0.1:3001` and is **not** publicly accessible.

**Access options:**

1. **SSH Tunnel (most secure):**
   ```bash
   ssh -i ~/.ssh/key -L 3001:127.0.0.1:3001 user@STAGING_IP -N
   # Then open http://localhost:3001
   ```

2. **Direct access with IP whitelist:**
   Add to `secrets.yml`:
   ```yaml
   app_access_ips: "YOUR_PUBLIC_IP"
   ```
   Re-run the playbook. UFW will open port 3001 for your IP only.

3. **Coolify proxy (proper way):**
   Add a Coolify application resource for `staging.eurtisan.eu` → `http://127.0.0.1:3001`.
   Then configure Traefik labels for IP whitelisting.

See `docs/DEPLOYMENT.md` for full details.

## Staging Seed Data

After the initial deployment, inject permanent curated demo data. The seed is idempotent —
safe to re-run; existing records are skipped.

### Run on staging (via Coolify proxy)

```bash
ssh root@STAGING_IP 'cd /opt/eurtisan && docker compose -f docker-compose.staging.yml run --rm app bun run seed-staging.bundle.mjs'
```

### Run on production

```bash
ssh root@PROD_IP 'cd /opt/eurtisan && docker compose -f docker-compose.prod.yml run --rm app bun run seed-staging.bundle.mjs'
```

### What it creates

| Resource | Details |
|---|---|
| Users | admin, moderator, creator, creator2, customer (@eurtisan.local) |
| Shops | The Forge (active), Ceramic Dreams (draft), Nordic Knits (pending review), Rustic Woodworks (approved), Silver & Stone (active), Quick Print Co (suspended) |
| Categories | 15 categories with 45 subcategories |
| Products | 10 curated products across active shops |
| Orders | 7 sample orders covering all statuses (delivered, completed, shipped, processing, paid, cancelled, disputed) |
| Reviews | Product reviews on delivered/completed orders |
| Disputes | 1 open dispute with message thread |

The seed also populates the Meilisearch product index.

## Adding OpenTofu Later

If you move to an API-driven cloud provider (Hetzner Cloud, AWS, DigitalOcean, etc.),
you can add an `infrastructure/tofu/` directory to provision VMs, managed databases,
or object storage. Ansible remains the configuration layer regardless of how the
VPS is provisioned.

## Security Notes

- The playbook uses SSH key authentication (password auth should be disabled manually)
- UFW allows only 22, 80, and 443 (skipped when `coexist_with_proxy: true`)
- fail2ban bans IPs after 5 failed SSH attempts
- Unattended upgrades apply security patches automatically
- `.env` file has `0600` permissions
- App runs as a non-root user inside the container
