# Eurtisan

A European-centered online marketplace for creatives, artisans, and makers.

**Status:** Hardened, Nearing Production Launch (P0/P1 production-readiness blockers resolved, final staging & operability verification in progress).  
**Contributions:** Not currently accepted — issues are reviewed and welcome.

---

## Overview

Eurtisan connects European makers with European buyers. It is built as a production-grade, full-stack marketplace with GDPR-conscious architecture, Euro-first pricing, and localization-ready design.

### Key traits

- **Region-first:** European data residency, EUR default currency, VAT-aware schema.
- **Security-first:** Server-enforced authorization, deny-by-default access, Zod-validated inputs, no secrets in client bundles.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (SSR + streaming) |
| Router | TanStack Router (file-based) |
| UI | React 19, Tailwind CSS v4, Base UI primitives |
| State / Cache | TanStack Query |
| Forms | TanStack Form |
| Validation | Zod |
| Auth | Better Auth (session-based, mounted at `/api/auth/$`) |
| Database | PostgreSQL 16 |
| ORM / Migrations | Drizzle ORM + Drizzle Kit |
| Search | Meilisearch |
| Payments | Mollie (connect + hosted checkout) |
| Email | Brevo (production), Mailpit (local dev) |
| Toolchain | Bun |
| Lint / Format | Biome |
| Testing | Vitest + Testing Library + Playwright (E2E) |
| i18n | Paraglide JS (URL + cookie strategy) |
| Telemetry / Observability | Grafana Stack (Loki, Tempo, Prometheus, Faro) |
| Shipping / Fulfillment | Sendcloud API v2 (rates, labels, tracking, service points) |
| Infrastructure | Docker Compose, Ansible, Caddy |

---

## Features

### Shoppers
- Search and browse products, categories, and shop fronts via Meilisearch.
- Anonymous session cart with automatic merge on login.
- Checkout with inventory reservation (15-minute lease), shipping address validation, and Mollie payment.
- Post-purchase: order tracking, product reviews, and dispute filing.

### Creators
- Eight-step onboarding wizard with draft persistence and admin review workflow.
- Shop management: settings, policies, visuals, social links.
- Product catalog: create, edit, activate/deactivate, image uploads.
- Order fulfillment: status updates, tracking registration, Sendcloud shipping label integration.
- Payout tracking and Mollie Connect onboarding.

### Admins
- Moderation: review shop applications, approve/reject/request changes, suspend shops, ban users.
- Catalog oversight: category CRUD with drag-and-drop ordering, product visibility controls.
- Operations: platform order inspection, dispute mediation with refund callbacks, payout queue, audit logs.

---

## Project structure

```
├── src/
│   ├── routes/           # File-based TanStack Router routes
│   ├── components/       # Shared components + route-specific pages
│   ├── db/               # Drizzle schema, migrations, seeds
│   ├── lib/              # Business logic and utilities
│   ├── integrations/     # External service clients
│   ├── router.tsx        # Router configuration
│   └── styles.css        # Global styles + Tailwind imports
├── drizzle/              # Generated migration files
├── infrastructure/       # Ansible playbooks and inventory
├── docker-compose.yml    # Local dev services (app, postgres, meilisearch, mailpit)
├── docker-compose.staging.yml
├── docker-compose.prod.yml
├── Makefile              # Standardized workflows
└── Caddyfile             # Production reverse proxy
```

---

## Development

### Prerequisites

- Docker and Docker Compose.

### Quick start

```bash
# 1. Copy environment variables
cp .env.example .env.local

# 2. Start services and install dependencies
make init
```

The app is available at `http://localhost:3000`.

### Common commands

| Command | Description |
|---|---|
| `make up` | Start Docker Compose services |
| `make down` | Stop services |
| `make dev` | Start dev server with hot reload |
| `make build` | Production build |
| `make preview` | Preview production build |
| `make lint` | Run Biome linter |
| `make format` | Run Biome formatter |
| `make check` | TypeScript type check |
| `make test` | Run Vitest suite |
| `make test-related <path>` | Run tests impacted by a file |
| `make e2e` | Run Playwright E2E tests |
| `make shell` | Open a shell in the app container |

### Database workflow

```bash
make db-generate   # Generate migration after schema changes
make db-migrate    # Run pending migrations
make db-push       # Push schema (local prototyping only)
make db-studio     # Open Drizzle Studio on port 4983
make db-seed       # Seed local dev data (destructive, random)
```

For staging environments, seed the database with the idempotent, curated staging seed:
```bash
# Open a shell in the app container and run
bun run db:staging-seed
```

### Auth secret

```bash
make auth-secret
```
Copy the output into `.env.local` as `BETTER_AUTH_SECRET`.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_ENCRYPTION_KEY` | 256-bit base64 key for encrypting sensitive fields at rest |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public auth endpoint base URL |
| `MEILISEARCH_HOST` / `MEILISEARCH_API_KEY` | Search index |
| `MOLLIE_API_KEY` | Payment provider |
| `SENDCLOUD_PUBLIC_KEY` / `SENDCLOUD_SECRET_KEY` | Sendcloud shipping integration credentials |
| `BREVO_API_KEY` | Transactional email |
| `MOCK_PAYMENTS_ENABLED` | Enable mock payment flow for local dev |
| `ENABLE_VIES_VALIDATION` | Enable live validation with EU VIES service |
| `PLATFORM_VAT_LIABLE` | Charge VAT on platform fees (French regime when false) |

---

## Testing

- **Unit / Component:** Vitest + Testing Library + vitest-axe (accessibility).
- **E2E:** Playwright.

Run selectively:

```bash
make test src/lib/pricing.test.ts
make test-related src/lib/pricing.ts
make e2e
```

---

## Deployment

Staging and production deploy via **Ansible** onto Ubuntu VPS instances with Docker Compose and Caddy.

```bash
# One-time: initialize inventory from examples
make infra-init

# Set secrets
make infra-secrets

# Provision and deploy
make infra-setup-staging
make infra-setup-production
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full details on DNS, SSH tunnels, IP whitelisting, backups, and restore procedures.

---

## Documentation Index

For deeper architectural, compliance, and operational details, refer to:

- **Developer Experience & Tooling:** [`docs/DEVELOPER_TOOLING.md`](docs/DEVELOPER_TOOLING.md) (SMTP/Mailpit email verification, Meilisearch checks, Drizzle Studio, and Playwright Agent CLI commands).
- **Deployment & Backups:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (Ansible setups, rollback procedures, database and WAL/offsite backup policies).
- **GDPR & Privacy:** [`docs/DATA_RETENTION.md`](docs/DATA_RETENTION.md) (Data portability exports, deletion/erasure rules, and anonymization pipelines).
- **Security Audit Logs:** [`docs/AUDIT_LOG_POLICY.md`](docs/AUDIT_LOG_POLICY.md) (Standard fields, events, and persistence rules).
- **User Flows:** [`docs/user_flow.md`](docs/user_flow.md) (Detailed product workflows for shopper, seller, and administrator personas).
- **Production Readiness:** [`docs/PRODUCTION_READINESS_AUDIT.md`](docs/PRODUCTION_READINESS_AUDIT.md) & [`docs/plans/production-readiness/README.md`](docs/plans/production-readiness/README.md) (Security audit, gaps mapping, and resolution tracking).

---

## Design system

- **Palette:** Warm OKLCH tones — moss green primary, sage accent, walnut neutrals. No purple or orange.
- **Typography:** Fraunces (display) + Manrope (UI).
- **Constraints:** WCAG 2.1 AA, `prefers-reduced-motion` support, flat-by-default elevation, ≤10% accent surface coverage on product UI.

Full tokens and rules are documented in [`DESIGN.md`](DESIGN.md).

---

## Contributing

This project is not currently accepting pull requests or external contributions.  
**Issues are welcome** — bug reports, feature suggestions, and security disclosures will be reviewed.

---

## License

This project is licensed under the [European Union Public Licence v. 1.2](LICENSE) (EUPL-1.2).
