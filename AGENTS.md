# Project Context — Eurtisan

> Durable reference for AI agents and contributors working on this full-stack marketplace application.
>
> Purpose: A European-centered online marketplace where creatives, artisans, and makers sell custom merchandise.
>
> Quality Constraint: Production-grade by default. No shortcuts. If an implementation is incomplete or deviates from best practices, it must be improved before it is considered done.

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
| Styling | Tailwind CSS v4 | Utility-first styling |
| Toolchain | Bun | Runtime/package manager |
| Lint / Format | Biome | Formatting + linting |
| Testing | Vitest + Testing Library | Unit and component testing |

---

# European / Marketplace Constraints

## GDPR Readiness

- Collect only necessary data.
- Plan for deletion/export workflows.
- Avoid retaining unnecessary personally identifiable information.
- Treat privacy as a core architectural concern.

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

- Shared reusable components belong in `src/components`.
- Route-specific components should live beside their route when practical.
- Database access belongs in server-side modules/functions only.
- Validation schemas should live near the domain they validate.
- Avoid generic dumping grounds like:
  - `helpers.ts`
  - `utils.ts`
  - `misc.ts`

Prefer cohesive modules with clear responsibilities.

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
- Server functions for authenticated mutations.
- Co-located route logic where practical.
- Typed database access through Drizzle only.
- Explicit loading/error states.
- Small focused server functions.
- Dependency injection through parameters instead of hidden globals.

---

# Server / Client Boundary Rules

Never:

- Import server-only modules into client code.
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

Contrast with the local dev seed (`src/db/seed.ts`) which is bulk, random, and requires `--clear`.

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

```txt
.
├── src/
│   ├── routes/
│   ├── components/
│   ├── integrations/
│   ├── lib/
│   ├── db/
│   ├── db.ts
│   ├── router.tsx
│   └── styles.css
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── drizzle.config.ts
├── instrument.server.mjs
├── vite.config.ts
├── biome.json
└── package.json
```

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
BETTER_AUTH_SECRET=

# Umami (cookie-less analytics)
VITE_UMAMI_SCRIPT_URL=
VITE_UMAMI_WEBSITE_ID=
VITE_UMAMI_HOST_URL=

# Database
DATABASE_URL=postgresql://eurtisan:eurtisan@db:5432/eurtisan

# Database pool sizing — tune per environment based on expected concurrency
# and PostgreSQL max_connections (default 100). With multiple app replicas,
# divide max_connections by replica count and leave headroom for migrations.
DATABASE_POOL_MAX=20
DATABASE_POOL_IDLE_TIMEOUT_MS=30000
DATABASE_POOL_CONNECTION_TIMEOUT_MS=5000
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
9. Never import `.server.` modules into client code. TanStack Start's import-protection plugin will block the production build. If a server-only query must be refreshed from the client, wrap it in a `createServerFn` and call the wrapper instead.
10. Keep loader parameters within Zod schema bounds. A loader that calls a server function with hardcoded values (e.g. `pageSize: 1000`) will fail at runtime if the input schema caps that field lower (e.g. `.max(100)`).
11. E2E auth is rate-limited by Better Auth. Rapid re-runs of `e2e/auth.setup.ts` will hit `429 Too Many Requests`. Reuse the generated `e2e/.auth/*.json` state across runs, or wait between attempts.
12. `make e2e` does not pass through CLI flags. Playwright options like `--project=chromium` must be passed directly: `docker compose exec app bunx playwright test e2e/admin-panel.spec.ts --project=chromium`.
13. The `instrument.server.mjs` file must remain importable by Node at startup. Do not add TypeScript or ESM-only dependencies to it.
14. The observability stack (`infra/observability/`) is deployed separately from the app and persists across app deploys.

---

# Maintenance Requirements

This document must remain synchronized with the actual architecture.

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
  node --import ./dist/server/instrument.server.mjs ./dist/server/server.js
  ```

- Runtime environment variables are required for:
  - Observability (Faro/Grafana)
  - Database
  - Authentication

- Prefer deployment regions inside Europe.

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
