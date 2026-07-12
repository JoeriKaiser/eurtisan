# Architecture overview

This document is the code-placement map for Eurtisan. It explains the boundaries between routing, UI, domain logic, infrastructure, and tests; it is not a replacement for the operational, compliance, or product-flow documents in the [documentation index](../README.md#documentation-index).

## Runtime shape

Eurtisan is a single TanStack Start application with server rendering, file-based TanStack Router routes, TanStack Query hydration, and a PostgreSQL-backed domain layer.

A typical request flows through these boundaries:

1. `src/start.ts` applies request middleware such as locale handling and the production content-security policy.
2. `src/router.tsx` creates the router and connects the generated route tree, localization URL rewriting, and TanStack Query.
3. `src/routes/` declares pages and API endpoints. Route modules own loaders, search-parameter validation, metadata, guards, and server-route handlers.
4. Route loaders and server functions call domain modules in `src/lib/`.
5. Domain modules use `src/db/` and `src/db.ts` for PostgreSQL access, or an adapter in `src/integrations/` for an external service.
6. Page UI is rendered by `src/route-components/` or reusable components from `src/components/`.

Background work runs as separate Bun entrypoints in `src/jobs/`. Production deployment and the observability stack are maintained outside the application source tree.

## Directory ownership

| Path | Owns | Does not own |
| --- | --- | --- |
| `src/routes/` | TanStack route declarations, loaders, route guards, search validation, head metadata, and API/server handlers under `src/routes/api/` | Large page UI or reusable domain logic |
| `src/route-components/` | Route-owned page components, pending/error states, and page-specific subcomponents organized to mirror the route path | Components used by unrelated routes or server-only database code |
| `src/components/` | Reusable UI and feature components shared by multiple routes | New route declarations or one-off route orchestration |
| `src/components/ui/` | Small design-system primitives such as buttons, inputs, cards, and feedback controls | Marketplace-specific workflows |
| `src/hooks/` | Reusable client-side React hooks for interaction and remote-state presentation | Server-only database, secret, or authorization logic |
| `src/lib/` | Domain logic, server-function contracts, validation schemas, authorization, query helpers, and focused shared utilities | External-provider adapters and route presentation |
| `src/integrations/` | Adapters and clients for external services such as Mollie, Sendcloud, email, storage, analytics, and search | Marketplace business rules that should remain provider-independent |
| `src/jobs/` | Standalone cleanup, synchronization, reconciliation, and worker entrypoints | Request/response route handlers |
| `src/db/` and `src/db.ts` | Drizzle schema, database access, seeds, maintenance scripts, and the PostgreSQL pool | Browser-facing code |
| `src/test/` | Shared database cleanup, factories, scenarios, and test helpers | Product code |
| `e2e/` | Playwright browser fixtures, setup projects, and end-to-end workflows | Unit or component tests |
| `drizzle/` | Committed Drizzle migration SQL and migration metadata | Ad hoc schema edits or deletion/renaming of applied migrations |
| `messages/` | Source translation messages for Paraglide | Generated locale modules |
| `src/paraglide/` | Generated Paraglide runtime and locale modules | Hand-written application logic; do not edit directly |
| `infra/observability/` | The separately deployed Grafana, Loki, Tempo, Prometheus, Alertmanager, and Alloy configuration | Application deployment configuration |
| `infrastructure/ansible/` | Ansible provisioning, deployment, secrets templates, and VPS configuration | Runtime marketplace code |
| `docs/` | Architectural, operational, compliance, runbook, and product-flow documentation | Source code or task-status tracking |

`src/lib/` is currently mostly flat. Migrate it incrementally by cohesive domain family; do not mass-move existing modules solely for visual consistency. A migrated family uses these placement rules:

- Keep an established root browser import such as `src/lib/shop-orders.ts` as the public `createServerFn` contract. It owns input validation and RPC authorization, and calls server-only helpers through `createServerOnlyFn` or dynamic imports.
- Keep an established root server import such as `src/lib/shop-orders.server.ts` as a compatibility façade when routes, jobs, tests, or other domains already depend on it.
- Put server-only persistence and orchestration in `src/lib/<domain>/*.server.ts`. Split by domain responsibility only when transaction boundaries, lock ordering, and dependency direction remain explicit.
- Put browser-safe schemas, types, and pure domain rules in `src/lib/<domain>/*.ts`. These modules must not import database code, secrets, provider clients, or server-only modules.
- Colocate focused tests with the extracted module. Existing broad compatibility and integration tests may remain at the root while they continue to exercise the public façade.

The `src/lib/shop-orders/` family is the reference migration: `types.ts` owns read-model types, `lifecycle.ts` owns pure state rules, `fulfillment.server.ts` owns shipping-label provider orchestration, and `operations.server.ts` preserves the transaction-coupled lifecycle and resolution workflows. The root `shop-orders.ts` and `shop-orders.server.ts` contracts remain stable. External provider adapters stay in `src/integrations/`.

Migrated families as of this writing: `admin`, `audit`, `auth`, `cart`, `checkout`, `customers`, `disputes`, `email`, `images`, `invoices`, `jobs`, `marketing`, `notifications`, `orders`, `payouts`, `products`, `reviews`, `search`, `security`, `shared`, `shipping`, `shop-orders`, `shops`, `tax`, `users`. Remaining flat modules should be migrated only when a feature touches them, preserving root compatibility contracts.

## Route and UI convention

For new pages, use this split:

```text
src/routes/<route>.tsx                    # route contract and orchestration
src/route-components/<route>.tsx          # page UI
src/route-components/<route>.pending.tsx  # pending UI, when needed
src/route-components/<route>.error.tsx    # error UI, when needed
```

Nested route folders should mirror the URL structure. Route modules may contain a small component when the page is genuinely tiny, but substantial page UI belongs in `src/route-components/`. New reusable pieces belong in `src/components/`; primitives belong in `src/components/ui/`.

The repository contains older page-level implementations in `src/components/`, `src/components/routes/`, and, in a few cases, `src/routes/`. These are transitional exceptions. Do not perform broad moves solely to make the tree uniform; migrate a touched feature when there is a clear correctness or maintainability benefit. Do not add new route pages to `src/components/routes/` unless the component is intentionally shared or is part of an explicit migration.

## Server and client boundaries

- Treat browser input as untrusted and validate it at route or server-function boundaries with Zod.
- Perform authentication, authorization, account-state checks, and privileged-role 2FA checks on the server.
- Never import database clients, secrets, Node-only APIs, `*.server.ts` modules, or modules marked with `@tanstack/react-start/server-only` into browser code.
- Keep external-provider details behind `src/integrations/` and expose provider-independent contracts to domain modules where practical. Adapters that use provider credentials or server-only SDKs must remain server-only.
- Use server functions for authenticated mutations and keep their implementations focused and typed.
- Use `createServerOnlyFn` for server-only helpers that are referenced by browser-importable server-function contracts; do not expose their implementation as ordinary shared code.
- Keep route components concerned with rendering and interaction; put business rules and persistence in `src/lib/` and `src/db/`.

See the TanStack Start server/client boundary guidance in `AGENTS.md` before changing a module that is imported by both routes and UI.

## Generated files and source of truth

Do not hand-edit generated application files:

- `src/routeTree.gen.ts` is regenerated by the TanStack Router/Vite plugin when route files change.
- `src/paraglide/` is generated from `messages/` and `project.inlang/`. After changing translation messages, run `docker compose exec app bun run i18n:compile` (or the equivalent command through `make shell`).
- `dist/`, `.tanstack/`, `.tsbuildinfo`, Playwright reports, and E2E results are local build/test output and must not be committed.

Drizzle migrations are different: the SQL and metadata under `drizzle/` are generated artifacts that are committed, reviewed, and applied through the migration workflow. Generate a migration with `make db-generate`, inspect it, and apply it with `make db-migrate`; never delete or rename a migration that may already have been applied to a shared environment.

## Documentation and structural changes

When a change introduces or changes a directory, route/UI placement rule, generated source, or server/client boundary, update these together:

1. This architecture overview.
2. The project tree and documentation index in `README.md`.
3. The corresponding conventions and project structure in `AGENTS.md`.

Link to the focused document instead of duplicating operational or compliance guidance. The most relevant references are:

- [Developer tooling](DEVELOPER_TOOLING.md)
- [Deployment](DEPLOYMENT.md)
- [Data retention](DATA_RETENTION.md)
- [Audit-log policy](AUDIT_LOG_POLICY.md)
- [Runbooks](runbooks/README.md)
- [Test utilities](../src/test/README.md)
- [Infrastructure](../infrastructure/README.md)
- [Design system](../DESIGN.md)
