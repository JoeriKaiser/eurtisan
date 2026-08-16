# Eurtisan

A European-centered online marketplace for creatives, artisans, and makers.

**Status:** Pre-launch — application remediation and the signed staging deployment channel are operational; release qualification and production approval remain in progress.

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
- Five-stage onboarding with draft persistence, admin review feedback, and an explicit go-live handoff.
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
│   ├── routes/           # TanStack route declarations and API handlers
│   ├── route-components/ # Route-owned page UI and pending/error states
│   ├── components/       # Reusable UI and design-system primitives
│   ├── hooks/            # Reusable client-side React hooks
│   ├── db/               # Drizzle schema, seeds, and DB maintenance scripts
│   ├── db.ts             # PostgreSQL pool
│   ├── lib/              # Domain logic, server functions, and validation
│   │   ├── admin/        # Admin dashboards, moderation, and operations
│   │   ├── audit/        # Audit logging and record keeping
│   │   ├── auth/         # Authentication, authorization, sessions, and hooks
│   │   ├── cart/         # Cart session, mutations, hooks, and UI helpers
│   │   ├── checkout/     # Checkout orchestration, shipping, tax, and payment
│   │   ├── customers/    # Customer profiles and order history queries
│   │   ├── disputes/     # Dispute lifecycle, schemas, and operations
│   │   ├── email/        # Email provider, templates, outbox, and preferences
│   │   ├── images/       # Image URL, upload, storage, and responsive helpers
│   │   ├── infra/        # Logging, metrics, caching, S3, encryption, env, db helpers
│   │   ├── invoices/     # Invoice generation, credit notes, and VAT logic
│   │   ├── jobs/         # Background jobs, cleanup, and reconciliation
│   │   ├── marketing/    # SEO, structured data, sitemap, and robots.txt
│   │   ├── notifications/# User notifications and hooks
│   │   ├── orders/       # Order lifecycle, buyer queries, and UI helpers
│   │   ├── payouts/      # Payout lifecycle, operations, and reconciliation
│   │   ├── products/     # Public product catalog, search, creator dashboard, and visibility
│   │   ├── reviews/      # Product reviews and ratings
│   │   ├── search/       # Meilisearch client and search utilities
│   │   ├── security/     # CSRF, CSP, rate limiting, and route guards
│   │   ├── shared/       # Cross-cutting utilities and helpers
│   │   ├── shipping/     # Shipping providers, rates, and estimates
│   │   ├── shops/        # Shop lifecycle, settings, moderation, and onboarding
│   │   ├── shop-orders/  # Domain types, lifecycle rules, and server operations
│   │   ├── tax/          # VAT, pricing, payment providers, and tax reporting
│   │   └── users/        # User queries, account data, and account operations
│   │   └── ...           # Shared cross-cutting utilities remain at root
│   ├── integrations/     # External service adapters
│   ├── jobs/             # Cleanup, worker, sync, and reconciliation entrypoints
│   ├── test/             # Shared test factories, scenarios, and helpers
│   ├── types/            # Ambient and shared type declarations
│   ├── paraglide/        # Generated localization runtime (do not edit)
│   ├── routeTree.gen.ts  # Generated TanStack route tree (do not edit)
│   ├── router.tsx        # Router configuration
│   ├── start.ts          # Request middleware and TanStack Start setup
│   └── styles.css        # Global styles + Tailwind imports
├── messages/             # Paraglide translation sources
├── drizzle/              # Committed Drizzle migrations and metadata
├── e2e/                  # Playwright fixtures, setup, and workflows
├── docs/                 # Architecture, operations, compliance, and runbooks
├── infra/observability/  # Separately deployed Grafana stack configuration
├── infrastructure/       # VPS provisioning and deployment automation
├── public/               # Static assets
├── scripts/              # Development and operational helpers
├── docker-compose.yml    # Local dev services (app, postgres, search, mail)
├── docker-compose.staging.yml
├── docker-compose.prod.yml
├── Dockerfile.postgres   # Pinned PostgreSQL 16 + pgBackRest runtime
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
| `make lint` | Run the read-only Biome lint check |
| `make format` | Run the read-only Biome format check |
| `make format-fix` | Apply Biome formatting explicitly |
| `make check` | TypeScript type check |
| `make test` | Run Vitest with release-warning enforcement |
| `make test-related <path>` | Run tests impacted by a file |
| `make test-accessibility` | Run focused component accessibility scans plus contrast/reflow contracts |
| `make db-check` | Validate the Drizzle migration chain |
| `make db-migrate-fresh` | Apply all migrations to an ephemeral PostgreSQL database |
| `make bundle-check` | Enforce measured production client bundle budgets |
| `make production-image-smoke` | Build and validate the production image/configuration |
| `make compose-check` | Validate production and staging Compose models |
| `make ansible-check` | Validate Ansible syntax, preflight, and templates |
| `make pgbackrest-check` | Exercise a disposable physical backup, WAL archive, and PITR restore |
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
| `MEILISEARCH_HOST` / `MEILISEARCH_API_KEY` | Private search index and master key |
| `S3_*` / `IMGPROXY_*` | Object storage and signed image delivery |
| `MOLLIE_API_KEY` | Payment provider |
| `SENDCLOUD_PUBLIC_KEY` / `SENDCLOUD_SECRET_KEY` | Sendcloud shipping integration credentials |
| `BREVO_API_KEY` | Transactional email |
| `MOCK_PAYMENTS_ENABLED` | Enable mock payment flow for local dev |
| `ENABLE_VIES_VALIDATION` | Enable live validation with EU VIES service |
| `PLATFORM_VAT_LIABLE` | Charge VAT on platform fees (French regime when false) |

`VITE_*` values are validated image-build inputs and require a rebuild when changed.
Server secrets are validated separately at process startup and must never use the
`VITE_` prefix. See
[`docs/runbooks/environment-configuration.md`](docs/runbooks/environment-configuration.md).

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

Staging and production deploy via **Ansible** onto Ubuntu VPS instances with Docker Compose and the environment-owned reverse proxy (Caddy for standalone hosts or the existing Traefik proxy on shared staging).

```bash
# One-time: initialize inventory from examples
make infra-init

# Set secrets
make infra-secrets

# Provision and deploy
make infra-setup-staging
make infra-setup-production
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for deployment details. Release gates and the evidence-oriented staging process are documented in [`docs/runbooks/release-quality-gates.md`](docs/runbooks/release-quality-gates.md) and [`docs/runbooks/staging-qualification.md`](docs/runbooks/staging-qualification.md).

---

## Documentation Index

For deeper architectural, compliance, and operational details, refer to:

- **Architecture & Code Placement:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (directory ownership, route splitting, route/UI conventions, React lifecycle ownership, server/client boundaries, and generated files).
- **Developer Experience & Tooling:** [`docs/DEVELOPER_TOOLING.md`](docs/DEVELOPER_TOOLING.md) (SMTP/Mailpit email verification, Meilisearch checks, Drizzle Studio, and Playwright Agent CLI commands).
- **Deployment & Backups:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (Ansible setups, rollback procedures, database and WAL/offsite backup policies).
- **GDPR & Privacy:** [`docs/DATA_RETENTION.md`](docs/DATA_RETENTION.md) (Data portability exports, deletion/erasure rules, and anonymization pipelines).
- **Security Audit Logs:** [`docs/AUDIT_LOG_POLICY.md`](docs/AUDIT_LOG_POLICY.md) (Standard fields, events, and persistence rules).
- **User Flows:** [`docs/user_flow.md`](docs/user_flow.md) (Detailed product workflows for shopper, seller, and administrator personas).

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
