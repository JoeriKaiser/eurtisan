# Eurtisan Infrastructure

Provider-agnostic IaC for deploying Eurtisan on Ubuntu 24.04 VPS hosts. Full provisioning, DNS, backup, and rollout procedures live in [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Stack

| Component | Role |
|---|---|
| **Ansible** (`ansible/`) | Host hardening, Docker setup, signed image build/promotion, Compose rollout, systemd backups |
| **Docker Compose** | `app`, consolidated `worker` (all scheduled jobs), PostgreSQL 16 + pgBackRest, Meilisearch, imgproxy; plus Garage, Mailpit, and self-hosted release registry on staging |
| **Caddy / Traefik** | Automatic HTTPS in production (Caddy) or Coolify proxy integration in staging (Traefik) |
| **Observability** (`observability/`) | Grafana, Prometheus, Alertmanager, Loki, Alloy, and optional Tempo (`full-obs` profile); on-demand on staging |

## Directory Layout

```text
infrastructure/
├── ansible/
│   ├── ansible.cfg
│   ├── playbook.yml
│   ├── preflight.yml
│   ├── inventory/          # *.example.yml committed; staging.yml and production.yml gitignored
│   ├── group_vars/         # all.yml, staging.yml, production.yml
│   ├── roles/
│   │   ├── common/         # Host hardening, fail2ban, Docker
│   │   └── eurtisan/       # Preflight, signed release rollout, Compose, backups, proxy config
│   └── files/
│       └── deploy.sh       # Verified-digest local recovery script
├── observability/          # Prometheus rules, Grafana dashboards, Loki/Alloy/Alertmanager configs
└── README.md
```

## Common Commands

Run from the repository root (see [`infrastructure/ansible/README.md`](./ansible/README.md) for Vault and preflight details):

```bash
make infra-init              # Create gitignored inventory files from examples
make ansible-check           # Syntax, synthetic preflight, and template checks (no Vault/host needed)
make infra-setup-staging     # Build, sign, push, and roll out staging
make infra-setup-production  # Build, sign, push, and roll out production (requires qualified staging digest)
```

## Staging Seed Data

Curated demo data for staging is idempotent and safe to re-run (existing records are skipped; missing `traderStatus` or `shippingOrigin.street` fields are backfilled). Never run staging seed against production.

```bash
docker exec -e ALLOW_STAGING_SEED=true eurtisan-app-staging bun run src/db/seed-staging.ts
```

Creates 5 `@eurtisan.local` test users, 6 shops (2 active: `the-forge` in Lyon, FR and `silver-and-stone` in Innsbruck, AT), 14 categories with 42 subcategories, 10 curated products, 7 sample orders, reviews, 1 open dispute, and syncs Meilisearch.

## Repository Source

GitHub (`https://github.com/JoeriKaiser/eurtisan`) is the canonical repository and runs validation-only CI. VPS hosts pull metadata via a host-specific read-only deploy key (`/root/.ssh/eurtisan_github_deploy`).
