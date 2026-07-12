# Project Context — Eurtisan

> Durable reference for AI agents and contributors working on this full-stack marketplace application.
>
> Purpose: A European-centered online marketplace where creatives, artisans, and makers sell custom merchandise.
>
> Quality Constraint: Production-grade by default. No shortcuts. If an implementation is incomplete or deviates from best practices, it must be improved before it is considered done.

---

<!-- intent-skills:start -->
## Skill Loading

Before substantial work:

- Run:
  ```bash
  npx @tanstack/intent@latest list
  ```

- If a local skill clearly matches the task, load it:
  ```bash
  npx @tanstack/intent@latest load <package>#<skill>
  ```

- Follow all instructions defined in the returned `SKILL.md`.
- In monorepos, run skill checks from the workspace root.
- Prefer the most specific skill relevant to the package or concern being modified.
- Load multiple skills only if the task spans multiple domains.

<!-- intent-skills:end -->

---

# Project Identity

Eurtisan is a full-stack marketplace built for Europe.

## Product Focus

- Audience: European creatives, artisans, and makers.
- Primary use case: Selling custom merchandise and artisan goods.
- Region-first architecture:
  - GDPR-conscious
  - Euro-first pricing
  - Localization-ready
  - European data residency
- Development stage: Early-stage product, but all code should be written to production standards.

---

# Agent Behavioral Contract

When modifying this project, agents must:

- Prefer existing architectural patterns over introducing new abstractions.
- Keep changes minimal, cohesive, and task-focused.
- Avoid speculative architecture or premature optimization unless explicitly requested.
- Preserve backward compatibility unless behavior changes are intentional.
- Avoid rewriting unrelated code during focused tasks.
- Favor readability and explicitness over cleverness.
- Reuse existing utilities and infrastructure before introducing new solutions.
- Leave the codebase in a better state than it was found.

Agents must verify:

- Relevant and impacted tests pass (either by running targeted test files or checking for regression on related modules).
- Formatting and linting pass.
- TypeScript passes without ignored errors.
- Accessibility implications are considered.
- Security implications are considered.
- Performance implications are considered.
- Server/client boundaries remain correct.

If requirements are ambiguous or risky, request clarification instead of making assumptions.

---

# Decision Hierarchy

When tradeoffs exist, prioritize in this order:

1. Security
2. Correctness
3. Data integrity
4. Accessibility
5. Reliability
6. Performance
7. Maintainability
8. Developer experience
9. Convenience

---

# Change Scope Discipline

Agents must keep diffs tightly scoped to the requested task.

Avoid:

- Drive-by refactors
- Broad renaming
- Unrelated formatting changes
- Moving files without justification
- Introducing architectural patterns not required by the task

If unrelated issues are discovered:

- Mention them separately
- Optionally recommend follow-up work
- Do not fix them unless they block:
  - correctness
  - security
  - maintainability
  - performance

---

# Existing Pattern Discovery

Before implementing new functionality, agents must:

1. Identify similar existing implementations.
2. Reuse established patterns where practical.
3. Match surrounding naming, structure, and conventions.
4. Prefer consistency over novelty.

Before modifying a subsystem, agents must inspect:
- adjacent modules
- shared abstractions
- existing tests
- related routes/components
- relevant schemas/types

When introducing a new pattern or abstraction, agents must justify:

- Why existing patterns are insufficient
- Why the new abstraction improves maintainability, correctness, or reliability

---

# Accuracy Requirements

Agents must not:

- Fabricate APIs
- Invent library behavior
- Assume undocumented framework capabilities
- Reference nonexistent files or modules

When uncertain:

- Inspect the codebase
- Verify assumptions
- Request clarification

---

# Dependency Verification

Before using a library feature or API:

- Verify it exists in the installed version.
- Match current project conventions.
- Avoid relying on outdated examples or documentation.

---

# Hard Quality Constraints

These rules are non-negotiable.

- No temporary hacks intended to be fixed later.
- No skipped validation on external input.
- No plaintext secrets in source code.
- No ignored TypeScript errors without explicit justification.
- No silent failures.
- No useEffect
- No inaccessible UI for core functionality.
- No unreviewable database schema changes.
- No production-sensitive logic without tests.
- No architectural drift from documented patterns.
- Do not claim work is done if `make lint` or `make format` return errors or warnings.
- Do not claim work is done if `make check` returns an error or warning.
- Do not claim work is done if relevant/impacted tests (run via targeted file paths, e.g. `make test src/lib/pricing.test.ts`, or related tests, e.g. via `make test-related src/lib/pricing.ts`) return failures. Note that running the full test suite with `make test` is recommended before opening a pull request or when making broad changes, but not required for every individual task.

Improve adjacent low-quality implementations only when they directly impact:

- Correctness
- Security
- Maintainability
- Performance
- Ability to complete the requested task safely

---

# Explicitly Prohibited

Do not:

- Introduce `any` types without justification.
- Disable lint/type rules globally.
- Commit dead code or commented-out code.
- Leave placeholder TODOs as substitutes for implementation.
- Store secrets in source files, tests, fixtures, logs, or examples.
- Introduce duplicate business logic.
- Add dependencies with overlapping responsibilities.
- Bypass schema validation on mutations or APIs.
- Use client-side data fetching where server rendering/server functions are more appropriate.
- Introduce global mutable state without strong justification.
- Use `db:push` in shared, persistent, staging, or production environments.
- Refactor unrelated systems during focused feature work.
- Silence errors instead of handling them correctly.

---

# Implementation Authenticity

Do not:

- Simulate production behavior with fake implementations.
- Hardcode temporary mock data in production paths.
- Claim features work when critical logic is incomplete.
- Leave partial implementations hidden behind optimistic comments.

If implementation cannot be completed safely:

- Explain the blocker explicitly.
- Leave the system in a correct and honest state.

---

# Definition of Done

A task is only considered complete when:

- The implementation works end-to-end.
- Relevant tests exist and pass.
- `make lint` and `make format` run without errors or warnings.
- `make check` runs without errors or warnings.
- TypeScript passes cleanly.
- Relevant and impacted tests pass (using targeted test execution or related test runs). The full suite via `make test` is run if changes are wide-ranging or architectural.
- Accessibility concerns are addressed.
- Loading, empty, and error states are handled.
- Security implications are reviewed.
- Performance implications are reviewed.
- Database changes include migrations.
- Documentation is updated if behavior changes.
- New environment variables are documented.
- New dependencies are justified.
- Changes align with the architectural rules in this document.

---

# When to Ask for Clarification

Agents should request clarification when:

- Requirements are ambiguous.
- Multiple architectural directions are equally valid.
- A schema migration may cause data loss.
- A change impacts authentication or authorization semantics.
- A change impacts infrastructure or deployment behavior.
- A dependency addition significantly alters the stack.
- A task requires broad refactoring outside the requested scope.
- A requested implementation conflicts with this document.

---

# Docker-First Development

All commands run inside the Docker Compose environment.

The host machine only requires Docker.

Node.js, Bun, PostgreSQL, and tooling must remain containerized to ensure reproducible development and eliminate environment drift.

Every workflow is exposed through `make` targets.

Do not run tooling directly on the host machine unless explicitly documented.

# Additional Developer Experience (DX) & Agent Tooling

For helper targets to accelerate test validation and integration debugging (such as programmatic email testing, local search engine inspection, and database schema visualization), see [DEVELOPER_TOOLING.md](file:///home/joeri/Projects/Eurtisan/docs/DEVELOPER_TOOLING.md).



---

# Service Topology

| Service | Container | Role |
|---|---|---|
| `app` | `eurtisan-app` | TanStack Start application + Bun toolchain |
| `db` | `eurtisan-postgres` | PostgreSQL 16 |

Both services share the `eurtisan` bridge network.

Database hostname inside containers:

```txt
db:5432
```

---

# Chosen Stack & Integrations

| Concern | Library / Service | Notes |
|---|---|---|
| Framework | TanStack Start | SSR, streaming, server functions |
| Routing | TanStack Router | File-based, type-safe routing |
| State / Cache | TanStack Query | Remote state and SSR hydration |
| Forms | TanStack Form | Form state + validation |
| Validation | Zod | Runtime-safe schemas |
| Auth | Better Auth | Mounted at `/api/auth/$` |
| Database | PostgreSQL 16 | Primary relational database |
| ORM | Drizzle ORM | Typed SQL access |
| Migrations | Drizzle Kit | Migration generation and execution |
| Monitoring | Grafana Stack (self-hosted) | Loki (logs), Tempo (traces), Prometheus (metrics), Grafana (UI) |
| Shipping | Sendcloud | Labels, rates, tracking, and service points via Sendcloud API v2; webhook endpoint at `/api/webhooks/sendcloud` |
| Styling | Tailwind CSS v4 | Utility-first styling |
| Toolchain | Bun | Runtime/package manager |
| Lint / Format | Biome | Formatting + linting |
| Testing | Vitest + Testing Library | Unit and component testing |
| Browser Automation (Agents) | Playwright Agent CLI | `@playwright/cli` run inside the container for token-efficient agent interactions |

---

# European / Marketplace Constraints

## GDPR Readiness

- Collect only necessary data.
- Plan for deletion/export workflows.
- Avoid retaining unnecessary personally identifiable information.
- Treat privacy as a core architectural concern.
- Account deletion must anonymize or redact PII across all retained records (user, shop, invoices, payouts, orders, disputes, reviews, audit logs). See `docs/DATA_RETENTION.md` for the exact retention exceptions and why they remain.

## Currency

- EUR is the default currency.
- Pricing logic must remain isolated and testable.
- Future VAT/tax systems must be injectable.

## Localization

- UI strings must be localization-ready.
- Avoid deeply embedded hardcoded user-facing strings.
- New UI systems must support future i18n integration.

## Data Residency

- Production infrastructure must remain in European regions whenever possible.

## Business Location & Entity Rules

- Eurtisan is established in France (FR). All platform fee calculations, domestic/cross-border B2B/B2C rules, and legal disclosures are based on French tax regulations.
- A detailed company profile, tax residency status, and VAT/Reverse Charge rules are documented in the ignored [BUSINESS.md](file:///home/joeri/Projects/Eurtisan/BUSINESS.md) file in the project root.

---

# File & Naming Conventions

## File Organization

- `src/routes/` contains TanStack route declarations, loaders, search validation, metadata, guards, and API/server handlers. Keep route orchestration thin.
- `src/route-components/` contains route-owned page UI plus pending/error states and page-specific subcomponents, organized to mirror the route path.
- Shared reusable components belong in `src/components`; small design-system primitives belong in `src/components/ui`.
- Reusable client-side React hooks belong in `src/hooks/`; keep server-only logic out of hook modules.
- `src/lib/` contains cohesive domain logic, server-function contracts, validation, authorization, and focused shared utilities. Keep `*.server.ts` implementations server-only and introduce domain subdirectories gradually when they improve ownership.
- For migrated `src/lib/<domain>/` families, keep established root imports as compatibility contracts: browser-importable `createServerFn` modules own Zod validation and RPC authorization, while root `*.server.ts` modules re-export server-only implementations when existing consumers depend on them. Colocate browser-safe schemas, types, pure rules, and focused tests in the domain folder; place persistence/provider orchestration in `*.server.ts` files. Never import a domain `*.server.ts` module from browser code.
- External provider clients and adapters belong in `src/integrations/`; cleanup, worker, synchronization, and reconciliation entrypoints belong in `src/jobs/`.
- Database access belongs in `src/db/`, `src/db.ts`, or server-side modules/functions only. Shared test factories, scenarios, and cleanup helpers belong in `src/test/`.
- Validation schemas should live near the domain they validate.
- Existing page implementations in `src/components/`, `src/components/routes/`, and a few route files are transitional. Do not mass-move them solely for consistency; migrate touched features opportunistically. Do not add new route pages to `src/components/routes/` unless they are intentionally shared or part of an explicit migration.
- Avoid generic dumping grounds like:
  - `helpers.ts`
  - `utils.ts`
  - `misc.ts`

Prefer cohesive modules with clear responsibilities. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the complete ownership map.

## Naming Conventions

### Components

Use PascalCase:

```txt
ProductCard.tsx
CheckoutForm.tsx
```

### Hooks

Use camelCase with `use` prefix:

```txt
useCart.ts
useCurrentUser.ts
```

### Server Functions

Use action-oriented naming:

```txt
createProduct.ts
updateProfile.ts
deleteListing.ts
```

### Route Files

Follow TanStack Router conventions exactly.

### Database

- Tables: snake_case plural
- Columns: snake_case
- Enum names: descriptive and explicit

### Tests

Prefer colocated tests:

```txt
ProductCard.test.tsx
```

---

# Code Organization Conventions

- Prefer small composable modules over giant files.
- Keep business logic outside UI components.
- Server-only code must never leak into client bundles.
- Prefer composition over inheritance.
- Prefer explicit types over unreadable inferred generics.
- Avoid deeply nested component trees when simpler composition is possible.

---

# Preferred Patterns

- Zod for runtime validation.
- TanStack Query for remote state.
- Server functions for authenticated mutations, with browser-importable contracts separated from server-only implementations.
- Keep route orchestration in `src/routes/` and route-owned UI in the matching `src/route-components/` subtree.
- Typed database access through Drizzle only.
- Explicit loading/error states.
- Small focused server functions.
- Dependency injection through parameters instead of hidden globals.

---

# Server / Client Boundary Rules

Never:

- Import server-only modules (`*.server.*` or modules marked with `@tanstack/react-start/server-only`) into client code.
- Expose secrets through serialized props or APIs.
- Access the database from client components.
- Perform authorization checks exclusively on the client.

Prefer:

- Server functions for mutations.
- SSR/server-side data loading when appropriate.
- Explicit serialization boundaries.
- Minimal client-side state.

---

# Security Requirements

- Treat all client input as untrusted.
- Validate all external input on the server.
- Never expose secrets to the client bundle.
- Use parameterized queries through Drizzle.
- Authorization checks must happen server-side.
- Sanitize user-generated content before rendering.
- Avoid leaking internal implementation details to users.
- Use least-privilege principles whenever possible.
- Enforce two-factor authentication for privileged roles (`creator`, `admin`) on every route and server function they can reach; route-level guards alone are not sufficient.
- Treat deleted accounts as deactivated: reject sessions, server functions, and mutations for users with `deletedAt` set.

---

# Authorization Principles

Authorization must be:

- Explicit
- Server-enforced
- Deny-by-default

Do not assume:

- Authenticated users are authorized
- Ownership without verification
- Client-provided identifiers are trustworthy

All resource access must validate:

- User identity
- Ownership or permissions
- Organization/store relationships where applicable
- Two-factor authentication for privileged roles (`creator`, `admin`) on both routes and server functions
- Whether the account has been deleted or banned (deleted users must not be able to act through sessions or server functions)

---

# Accessibility Requirements

- All interactive elements must be keyboard accessible.
- Inputs require labels and validation messaging.
- Use semantic HTML before ARIA.
- Ensure sufficient color contrast.
- Loading/error states must be accessible.
- Dialogs and modals must manage focus correctly.
- Avoid inaccessible custom controls when native elements suffice.

---

# UI / UX Consistency

Prefer:

- Existing design primitives
- Consistent spacing and typography
- Predictable interaction patterns
- Reusable UI composition

Avoid:

- One-off styling systems
- Inconsistent interaction behavior
- Unnecessary visual complexity

## Production-Grade UI & Style Constraints

To maintain a premium, cohesive, and production-grade marketplace visual standard:

- **Rich Aesthetics & Premium Feel:** Implement modern web design best practices (e.g., custom gradients, cohesive dark/light palettes, and refined shadow levels). Avoid basic default styles or raw, unharmonious colors.
- **Micro-Animations & Transitions:** Utilize subtle transitions and interactive hover effects to make the interface feel responsive and alive.
- **Zero Cumulative Layout Shift (CLS):** Dynamic elements (such as success/error banners or validation status indicators) must never trigger vertical/horizontal layout shifts. Ensure submit buttons and core forms remain visually static.
- **Ergonomics & Balanced Spacing:** Avoid excessive vertical whitespace padding between structural layouts (such as auth shells and standard headers/footers). Align layouts to comfortably fit within standard viewport folds.
- **No Structural Placeholders:** Always implement complete user flows (e.g., password visibility toggles, real-time validations, and descriptive illustrations) rather than using simplified visual shortcuts.
- **Accessibility Integration:** All premium interactive elements must maintain keyboard focusability, proper labels, clear contrast, and semantic HTML structure.

---

# Performance Expectations

- Prefer SSR/server rendering where beneficial.
- Avoid unnecessary client-side state.
- Avoid unnecessary re-renders.
- Lazy-load heavy features when appropriate.
- Consider bundle size before adding dependencies.
- Optimize queries before introducing caching layers.
- Measure before introducing complexity.

---

# Performance Budget Mindset

Treat:

- Bundle size
- Hydration cost
- Query count
- Re-render frequency
- Network round trips

as constrained resources.

New dependencies, client-side logic, and abstractions should justify their runtime cost.

---

# Data Fetching & Cache Consistency

Prefer:

- Server-side data loading for initial render
- TanStack Query for remote state synchronization
- Explicit cache invalidation after mutations
- Stable query keys

Avoid:

- Duplicate fetching layers
- Redundant client fetching after SSR
- Hidden cache invalidation behavior
- Mixing unrelated cache strategies

---

# Error Handling Standards

- Fail explicitly and predictably.
- Do not swallow exceptions silently.
- Return user-safe error messages.
- Log actionable server-side errors.
- Handle loading, empty, and failure states intentionally.

---

# Logging Standards

- Never log:
  - passwords
  - tokens
  - secrets
  - PII

- Prefer structured logging.
- Remove debug logs before completion unless intentionally retained.

---

# Observability Expectations

New critical flows should:

- Emit actionable logs
- Integrate with existing monitoring
- Surface meaningful error context
- Avoid noisy or duplicate reporting

Errors should be:

- Traceable by developers
- Safe for users
- Useful in production debugging

---

# Testing Expectations

## Unit Tests

Required for:

- Business logic
- Validation
- Pricing logic
- Utility/domain logic

## Component Tests

Use Testing Library for:

- Interactive UI
- Form behavior
- Accessibility-sensitive flows

## Integration Tests

Required for critical workflows:

- Authentication
- Authorization
- Checkout/payment logic
- Permissions
- Database-sensitive flows

## Testing Rules

- Tests must be deterministic.
- Tests must not rely on external network access.
- Mock external services explicitly.
- Avoid snapshot-heavy testing.

---

# Dependency Policy

Before adding dependencies:

- Prefer platform capabilities first.
- Prefer existing project tooling.
- Evaluate maintenance quality and ecosystem adoption.
- Avoid overlapping libraries.
- Prefer lightweight dependencies.

Any new dependency should be justified.

Do not add dependencies for trivial utilities.

---

# Database Workflow Policy

## Local Development

`make db-push` may be used only for disposable local prototyping.

## Shared Environments

Shared, staging, review, and production environments must use migrations.

Schema changes are not complete until:

## Staging / Production Seed Data

After initial deployment, inject permanent curated demo data with the idempotent staging seed:

```bash
# From the host machine
ssh root@STAGING_IP 'cd /opt/eurtisan && docker compose -f docker-compose.staging.yml run --rm app bun run db:staging-seed'
```

The staging seed (`src/db/seed-staging.ts`) is:
- **Idempotent** — safe to re-run; existing records are skipped
- **Additive only** — never clears data
- **Deterministic** — uses `faker.seed(42)` for reproducible output
- **Curated** — realistic European artisan marketplace data with known test accounts

Contrast with the local dev seed (`src/db/seed.ts`) which is bulk, random, and requires `--clear --force`.

1. A migration is generated
2. The migration is committed
3. The migration has been tested

---

# Migration Safety

Schema migrations must:

- Be backward-compatible when possible
- Avoid destructive operations without explicit approval
- Include data migration strategies when needed
- Consider rollback implications
- Avoid locking large tables unnecessarily

Destructive operations require explicit confirmation.

## Migration chain integrity

As of the production-readiness remediation, the project uses an **incremental
migration chain** rather than a single consolidated baseline. Re-baselining was
deferred because multiple remediation phases generated migrations that contain
required data fixes (e.g., payout reversion, encryption backfills). To keep the
chain healthy, every PR must pass:

- `drizzle-kit check`
- `make db-migrate` on a fresh database
- No deletion or renaming of migrations that have been applied to staging or
  production

If the chain ever becomes unrecoverable, the team should coordinate a planned
maintenance window to generate a new baseline from the final schema and migrate
all environments forward.

---

# API & Server Function Design

- Validate all inputs with Zod.
- Keep handlers focused and composable.
- Avoid hidden side effects.
- Return typed responses.
- Authorization must be explicit.
- Prefer predictable APIs over overly generic abstractions.

---

# API Stability

Avoid breaking:

- Route contracts
- Response shapes
- Public component APIs
- Database semantics
- Query parameter behavior

Breaking changes must be:

- Intentional
- Documented
- Justified

---

# Project Structure

The complete placement and boundary rules are maintained in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The principal repository areas are:

```txt
.
├── src/
│   ├── routes/           # TanStack route declarations and API handlers
│   ├── route-components/ # Route-owned page UI and pending/error states
│   ├── components/       # Reusable UI and design-system primitives
│   ├── hooks/            # Reusable client-side React hooks
│   ├── lib/              # Domain logic, server functions, and validation
│   ├── integrations/     # External service adapters
│   ├── jobs/             # Cleanup, worker, sync, and reconciliation entrypoints
│   ├── db/               # Drizzle schema, seeds, and DB maintenance scripts
│   ├── test/             # Shared test factories, scenarios, and helpers
│   ├── types/            # Ambient and shared type declarations
│   ├── paraglide/        # Generated localization runtime; do not edit
│   ├── routeTree.gen.ts  # Generated TanStack route tree; do not edit
│   ├── db.ts             # PostgreSQL pool
│   ├── router.tsx        # Router configuration
│   ├── start.ts          # Request middleware and TanStack Start setup
│   └── styles.css        # Global styles and Tailwind imports
├── messages/             # Paraglide translation sources
├── drizzle/              # Committed Drizzle migrations and metadata
├── e2e/                  # Playwright fixtures, setup, and workflows
├── docs/                 # Architecture, operations, compliance, and runbooks
├── infra/observability/  # Separately deployed observability configuration
├── infrastructure/       # VPS provisioning and deployment automation
├── public/               # Static assets
├── scripts/              # Development and operational helpers
├── docker-compose*.yml   # Local, staging, and production service definitions
├── Makefile              # Standardized Docker-first workflows
├── Dockerfile*           # Application images
├── drizzle.config.ts     # Drizzle Kit configuration
├── vite.config.ts       # Vite/TanStack Start configuration
├── biome.json            # Lint and format configuration
└── package.json
```

`src/routeTree.gen.ts` and `src/paraglide/` are generated and must not be edited
by hand. Migration SQL under `drizzle/` is generated, reviewed, committed, and
must not be deleted or renamed after it may have been applied to a shared
environment.

---

# Environment Variables

Copy `.env.local` and provide real values.

```bash
# Observability (Grafana Stack — self-hosted)
VITE_FARO_COLLECTOR_URL=/collect          # Faro beacon endpoint (same-origin)
VITE_FARO_APP_NAME=eurtisan               # App name in Grafana
VITE_APP_ENV=development                  # environment tag
VITE_APP_VERSION=dev                      # release version tag

# Better Auth
BETTER_AUTH_URL=http://localhost:3000
# Required in production. Generate with: make auth-secret
BETTER_AUTH_SECRET=

# Public URL of the application (required for SSR, emails, and absolute links)
PUBLIC_URL=http://localhost:3000

# Umami (cookie-less analytics)
VITE_UMAMI_SCRIPT_URL=
VITE_UMAMI_WEBSITE_ID=
VITE_UMAMI_HOST_URL=
VITE_UMAMI_SCRIPT_INTEGRITY=

# Analytics consent banner (required in production)
VITE_ANALYTICS_CONSENT_REQUIRED=true

# Grafana admin IP allow-list (Caddy). Space-separated CIDR ranges.
# Defaults to 0.0.0.0/32 (blocks all access) if unset.
GRAFANA_ADMIN_IPS=

# Public Grafana root URL used by the observability stack.
GRAFANA_ROOT_URL=https://eurtisan.eu/grafana

# Name of the app container as seen by Docker (used by Alloy log tailing).
APP_CONTAINER_NAME=eurtisan-app

# Database
DATABASE_URL=postgresql://eurtisan:eurtisan@db:5432/eurtisan

# Database pool sizing — tune per environment based on expected concurrency
# and PostgreSQL max_connections (default 100). With multiple app replicas,
# divide max_connections by replica count and leave headroom for migrations.
DATABASE_POOL_MAX=20
DATABASE_POOL_IDLE_TIMEOUT_MS=30000
DATABASE_POOL_CONNECTION_TIMEOUT_MS=5000

# Meilisearch (server-side master key — NEVER expose to the browser)
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your-master-key

# Meilisearch (browser-facing search-only key)
# Generate after Meilisearch boots:
#   curl -X POST "http://localhost:7700/keys" \
#     -H "Authorization: Bearer $MEILI_MASTER_KEY" \
#     -H "Content-Type: application/json" \
#     -d '{"actions":["search"],"indexes":["products"],"expiresAt":null}'
VITE_MEILISEARCH_HOST=http://localhost:7700
VITE_MEILISEARCH_SEARCH_KEY=your-search-only-key

# Mollie Payments (buyer checkout, refunds)
MOLLIE_API_KEY=
MOLLIE_WEBHOOK_SECRET=
# Set to 'true' explicitly for local mock-payment testing
MOCK_PAYMENTS_ENABLED=

# Mollie Connect (seller onboarding and payouts)
MOLLIE_CLIENT_ID=
MOLLIE_CLIENT_SECRET=

# Mollie test mode. Set to 'true' to use Mollie's test environment.
# Defaults to 'true' in development, 'false' in production.
MOLLIE_TEST_MODE=true

# Sendcloud (shipping labels, rates, tracking, service points)
SENDCLOUD_PUBLIC_KEY=your-sendcloud-public-key
SENDCLOUD_SECRET_KEY=your-sendcloud-secret-key
# Webhook secret for HMAC-SHA256 verification of Sendcloud status callbacks.
SENDCLOUD_WEBHOOK_SECRET=your-sendcloud-webhook-secret
# Optional: force the Sendcloud "Unstamped letter" method in non-production environments.
# Defaults to 'true' when VITE_APP_ENV is not 'production'.
SENDCLOUD_FORCE_UNSTAMPED_LETTER=true
# Optional: explicit Sendcloud method id for the Unstamped letter service.
SENDCLOUD_UNSTAMPED_LETTER_METHOD_ID=

# Number of days to retain Sendcloud webhook event rows before cleanup.
# Defaults to 30, minimum 1.
SENDCLOUD_WEBHOOK_RETENTION_DAYS=30

# Mock payouts (no external Mollie Routes API calls).
# Useful for local development when MOLLIE_API_KEY is not set.
MOCK_PAYOUTS_ENABLED=false

# Payout reconciliation job interval (milliseconds). Default: 6 hours.
PAYOUT_RECONCILIATION_INTERVAL_MS=21600000

# Sendcloud reconciliation job interval (milliseconds). Default: 6 hours.
SENDCLOUD_RECONCILIATION_INTERVAL_MS=21600000

# Tax / VAT
# When true, cross-border EU B2B VAT IDs are verified live with VIES.
# When false or unset, only offline format checks are performed.
ENABLE_VIES_VALIDATION=false

# When true, the platform charges VAT on platform fees per EU B2B/B2C rules.
# When false, the platform operates under the French "Franchise en base de TVA" regime.
# Defaults to true for safety.
PLATFORM_VAT_LIABLE=true

# Health-check disk path (mount point checked for free space). Use the path
# that stores real application data in production, not /tmp.
HEALTH_DISK_PATH=/

# Cleanup job intervals (all have sensible defaults; uncomment to override):
# SESSION_CLEANUP_INTERVAL_MS=60000
# CART_CLEANUP_INTERVAL_MS=60000
# VERIFICATION_CLEANUP_INTERVAL_MS=60000
# AUDIT_LOG_CLEANUP_INTERVAL_MS=86400000
# AUDIT_LOG_RETENTION_DAYS=365
# INVENTORY_CLEANUP_INTERVAL_MS=60000
```

Generate auth secret:

```bash
make auth-secret
```

---

# Makefile Commands

| Command | Description |
|---|---|
| `make up` | Start services |
| `make down` | Stop services |
| `make logs` | View logs |
| `make shell` | Open shell in app container |
| `make install` | Install dependencies |
| `make init` | Initialize project (build, install, compile i18n, migrate, seed) |
| `make dev` | Start development server |
| `make build` | Build production app |
| `make preview` | Preview production build |
| `make start` | Start production server |
| `make lint` | Run linting |
| `make format` | Run formatting |
| `make check` | Run full checks |
| `make test` | Run tests (optionally with specific files: `make test <paths>`) |
| `make test-related` | Run tests related to specific files (`make test-related <paths>`) |
| `make auth-secret` | Generate Better Auth secret |
| `make db-generate` | Generate migrations |
| `make db-migrate` | Run migrations |
| `make db-push` | Push schema locally |
| `make db-studio` | Open Drizzle Studio |

---

# Key Architectural Decisions

1. File-based routing via TanStack Router.
2. Business logic uses server functions.
3. Better Auth mounted at `/api/auth/$`.
4. Shared PostgreSQL connection pool.
5. Self-hosted Grafana observability stack (Loki, Tempo, Prometheus, Grafana).
6. Docker is the source of truth for development environments.
7. Localization readiness is mandatory from the start.

---

# Known Gotchas

1. Docker is required for all workflows.
2. `.env.local` must remain out of version control.
3. Grafana Faro uses `sessionStorage`, not cookies. No consent banner required for the beacon mechanism.
4. Biome is the single lint/format tool.
5. Production infrastructure should remain in EU regions.
6. Development runs fully inside containers.
7. TanStack Router `__root` is reserved for the application root **only**. Nested layouts must use `route.tsx` inside the target folder (e.g. `src/routes/admin/route.tsx` for `/admin/*` layout). Using `__root.tsx` in a subfolder will silently orphan child routes — they will attach to the app root and the layout will never render. Always verify `getParentRoute` in `routeTree.gen.ts` after creating or renaming layout routes.
8. Paraglide i18n requires explicit compilation. Adding keys to `messages/en.json` is not enough — run `bun run i18n:compile` (or `make dev` which may auto-compile). Uncompiled keys cause runtime `m.key is not a function` errors that only appear in the browser.
9. Never import server-only modules (`*.server.*` or modules marked with `@tanstack/react-start/server-only`) into client code. TanStack Start's import-protection plugin will block the production build. If a server-only query must be refreshed from the client, wrap it in a `createServerFn` and call the wrapper instead.
10. Keep loader parameters within Zod schema bounds. A loader that calls a server function with hardcoded values (e.g. `pageSize: 1000`) will fail at runtime if the input schema caps that field lower (e.g. `.max(100)`).
11. E2E auth is rate-limited by Better Auth. Rapid re-runs of `e2e/auth.setup.ts` will hit `429 Too Many Requests`. Reuse the generated `e2e/.auth/*.json` state across runs, or wait between attempts.
12. `make e2e` does not pass through CLI flags. Playwright options like `--project=chromium` must be passed directly: `docker compose -f docker-compose.yml -f docker-compose.e2e.yml exec app bunx playwright test e2e/admin-panel.spec.ts --project=chromium`. The E2E overlay points the app at the isolated test database, so always use both compose files when running individual specs outside of `make e2e`.
13. The `instrument.server.mjs` file must remain importable by Node at startup. Do not add TypeScript or ESM-only dependencies to it.
14. The observability stack (`infra/observability/`) is deployed separately from the app and persists across app deploys.
15. Privileged server functions (`creator`/`admin` actions) enforce 2FA independently of route guards via `requirePrivileged2FA`. Tests that call these functions must either set `twoFactorEnabled: true` on the test user or rely on the dev/test bypass.
16. Accounts with `deletedAt` set are treated as deactivated. `authMiddleware` and server-auth helpers reject them, so any test that reuses a deleted user record should expect `UNAUTHENTICATED`/`BANNED` behavior.

---

# Maintenance Requirements

This document must remain synchronized with the actual architecture.

For directory ownership, route/UI placement, generated-source, or server/client
boundary changes, update [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), the
README project tree, and this file in the same change.

Update `AGENTS.md` whenever changes impact:

- Core architecture
- Stack/tooling
- Directory structure
- Development workflows
- Testing strategy
- Deployment assumptions
- Security expectations
- Localization/i18n strategy
- Database workflow
- Environment variables
- Dependency policies

Examples requiring updates:

- Adding an i18n library
- Replacing authentication providers
- Introducing background jobs
- Changing deployment targets
- Adding monorepo packages
- Replacing testing infrastructure
- Changing TanStack Router layout conventions or route tree structure
- Modifying Paraglide compilation strategy or message file locations
- Altering server/client boundary rules (e.g. `.server.` file patterns)

If implementation and documentation diverge, the documentation is considered outdated and must be corrected as part of the task.

---

# Deployment Notes

- Server output lives in:
  ```txt
  dist/server/
  ```

- Production start command:
  ```bash
  bun --import ./dist/server/instrument.server.mjs ./dist/server/server-entry.mjs
  ```

- Runtime environment variables are required for:
  - Observability (Faro/Grafana)
  - Database
  - Authentication

- Background jobs required for production correctness must be deployed as long-running containers or scheduled processes. The following jobs are not optional at launch:
  - `bun run job:payout-reconciliation` — reconciles payout status and alerts on stale pending payouts.
  - `bun run job:sendcloud-reconciliation` — backfills missed Sendcloud webhook status updates and marks delivered orders. This job must be running before the Sendcloud integration is considered live in production.
  - `bun run job:inventory-cleanup` — releases expired inventory reservations and cancels abandoned pending-payment orders.
  - `bun run job:session-cleanup` — deletes expired Better Auth sessions.
  - `bun run job:cart-cleanup` — deletes expired anonymous carts.
  - `bun run job:audit-log-cleanup` — purges audit-log entries beyond the retention period.
  - `bun run job:verification-cleanup` — deletes expired email/verification tokens.

- Prefer deployment regions inside Europe.

## Infrastructure Deployment (Ansible)

The production and staging environments are deployed via Ansible:

```bash
cd infrastructure/ansible
ansible-playbook -i inventory/staging.yml playbook.yml --vault-password-file=.vault_pass
```

### Secrets

All sensitive values live in `infrastructure/ansible/secrets.yml`, which is **encrypted with Ansible Vault**.

- The vault password is stored in `infrastructure/ansible/.vault_pass` (`.gitignore`-d).
- The committed `.vault_pass` is a placeholder; create it locally with the real password before running Ansible.
- Edit secrets: `ansible-vault edit secrets.yml --vault-password-file=.vault_pass`
- View secrets: `ansible-vault view secrets.yml --vault-password-file=.vault_pass`
- Rotate the vault password: `ansible-vault rekey secrets.yml --vault-password-file=.vault_pass --new-vault-password-file=.vault_pass.new`
- Never commit `.vault_pass`, `.vault_pass.new`, or an unencrypted `secrets.yml`.

For full details, see `infrastructure/ansible/README.md`.

---

# Development Workflow

## Start Services

```bash
make up
```

Application URL:

```txt
http://localhost:3000
```

## Install Dependencies

```bash
make install
```

## Run Tests

To run the entire test suite:

```bash
make test
```

To run a specific test file (much faster for targeted validation):

```bash
make test src/lib/pricing.test.ts
```

To run only tests related to a specific file (impacted tests):

```bash
make test-related src/lib/pricing.ts
```

## Run Checks

```bash
make check
```

## Pre-Commit Hooks

A secret-scanning pre-commit hook lives in `.githooks/pre-commit`. It scans staged changes for potential secrets (API keys, passwords, tokens, AWS keys, etc.).

Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

If you need to bypass the hook for a safe commit:

```bash
git commit --no-verify
```

## Database Workflow

1. Modify schema
2. Generate migration:
   ```bash
   make db-generate
   ```

3. Apply migration:
   ```bash
   make db-migrate
   ```

4. Inspect database:
   ```bash
   make db-studio
   ```
