# Eurtisan agent guide

Eurtisan is a production-grade marketplace for European creatives, artisans, and makers. It is GDPR-conscious, EUR-first, localization-ready, and deployed in European regions where practical.

This file contains rules that should influence agent decisions. Detailed inventories and procedures live in the canonical references below; read the relevant document before changing that subsystem rather than relying on duplicated summaries.

<!-- intent-skills:start -->
## Skill loading

Before substantial work:

1. Run `npx @tanstack/intent@latest list` from the workspace root.
2. If a local skill clearly matches the task, load it with `npx @tanstack/intent@latest load <package>#<skill>`.
3. Follow the returned `SKILL.md`. Prefer the most specific skill and load multiple skills only for genuinely cross-domain work.

<!-- intent-skills:end -->

## Canonical references

| Concern | Source of truth |
| --- | --- |
| Stack, setup, project overview, common commands | [`README.md`](README.md) |
| Code placement, runtime boundaries, generated files | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Design system and visual rules | [`DESIGN.md`](DESIGN.md) |
| Environment variable names and local defaults | [`.env.example`](.env.example) |
| Build/runtime configuration and secret ownership | [`docs/runbooks/environment-configuration.md`](docs/runbooks/environment-configuration.md) |
| Deployment and infrastructure | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`infrastructure/README.md`](infrastructure/README.md) |
| Operational procedures | [`docs/runbooks/README.md`](docs/runbooks/README.md) |
| Data retention and deletion exceptions | [`docs/DATA_RETENTION.md`](docs/DATA_RETENTION.md) |
| Company profile and French tax rules | `BUSINESS.md` (local, intentionally untracked) |
| Agent/browser/integration tooling | [`docs/DEVELOPER_TOOLING.md`](docs/DEVELOPER_TOOLING.md) |
| Available workflows | [`Makefile`](Makefile) |

If documentation and implementation disagree, inspect the implementation and correct the relevant canonical document as part of the change.

## Decision order

When requirements conflict, prioritize:

1. Security
2. Correctness and data integrity
3. Accessibility
4. Reliability
5. Performance
6. Maintainability
7. Developer experience
8. Convenience

Ask for clarification before proceeding when requirements are ambiguous or when a change affects authentication/authorization semantics, may cause data loss, significantly changes dependencies or infrastructure, requires broad refactoring, or conflicts with this guide.

## Working agreement

- Inspect `git status` first and preserve user changes. Do not rewrite or remove unrelated work.
- Before modifying a subsystem, inspect adjacent modules, shared abstractions, schemas/types, related routes/components, and existing tests. Find and follow a similar implementation where possible.
- Keep diffs minimal, cohesive, and task-focused. Avoid drive-by refactors, broad renames, speculative abstractions, and unrelated formatting.
- Preserve public contracts and backward compatibility unless a behavior change is intentional and documented.
- Prefer readable, explicit code and existing utilities over cleverness or new abstractions. If introducing a pattern, explain why existing patterns are insufficient.
- Verify library APIs against the installed version; do not invent or assume framework behavior.
- Do not hide blockers or incomplete behavior. If safe completion is impossible, leave the repository in a correct state and explain the blocker.
- Mention meaningful out-of-scope findings separately; fix them only when they block security, correctness, maintainability, performance, or safe completion.

## Non-negotiable engineering rules

Do not:

- add temporary production hacks, fake production behavior, placeholder TODO implementations, dead code, or commented-out alternatives;
- introduce `any` or suppress TypeScript/lint errors without a narrow, documented justification;
- disable validation, authorization, lint, or type rules globally;
- swallow errors or claim functionality works when critical logic is incomplete;
- duplicate business logic or add overlapping dependencies;
- introduce global mutable state without strong justification;
- hardcode secrets, tokens, credentials, or sensitive production data in source, tests, fixtures, examples, or logs;
- hand-edit generated files (`src/routeTree.gen.ts`, `src/paraglide/`, build output);
- use React `useEffect`; use the lifecycle patterns documented in `docs/ARCHITECTURE.md`;
- ship inaccessible core functionality or production-sensitive logic without appropriate tests.

Production paths must use real implementations. Test doubles are allowed only in explicit test/dev boundaries and must never activate accidentally in production.

## Docker-first workflow and verification

Docker Compose is the source of truth. Run project workflows through `make` from the host; those targets execute Node, Bun, PostgreSQL, and project tooling in containers. Do not run project tooling directly on the host unless a canonical document explicitly requires it.

For code changes, completion requires:

- `make lint` with no errors or warnings;
- `make format` with no formatting failures;
- `make check` with no TypeScript errors;
- focused tests via `make test <paths>` or impacted tests via `make test-related <paths>`;
- the full `make test` suite for broad or architectural changes.

Run additional relevant gates (accessibility, bundle, production image, Compose, infrastructure, migrations, E2E) when the affected subsystem requires them. For documentation-only changes, verify links and consistency; do not run unrelated code gates solely for ceremony.

Never report a gate as passing unless it was run successfully. State any skipped check and the reason.

## Architecture and placement

Follow [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Core ownership rules:

- `src/routes/`: thin TanStack route declarations, loaders, metadata, guards, search validation, and API/server handlers.
- `src/route-components/`: route-owned page UI, pending/error states, and page-specific components mirroring route paths.
- `src/components/`: reusable UI; `src/components/ui/`: small design-system primitives.
- `src/hooks/`: reusable browser hooks only.
- `src/lib/`: domain rules, validation, authorization, server-function contracts, and cohesive shared logic.
- `src/integrations/`: external-provider clients and adapters.
- `src/jobs/`: cleanup, worker, synchronization, and reconciliation entrypoints; production-critical jobs must remain represented in deployment configuration.
- `src/db/` and `src/db.ts`: schema, migrations support, and database access.
- `src/test/`: shared factories, scenarios, cleanup, and test helpers.

Keep business logic out of UI and route orchestration. Keep provider details behind adapters. Avoid generic dumping grounds such as `helpers.ts`, `utils.ts`, or `misc.ts`; name modules by responsibility.

Existing page code in `src/components/`, `src/components/routes/`, and some route files is transitional. Do not mass-move it for consistency; migrate touched features only when useful. Do not add new route pages to `src/components/routes/` unless intentionally shared or part of an explicit migration.

For migrated `src/lib/<domain>/` families:

- keep established root imports as compatibility contracts;
- browser-importable `createServerFn` modules own Zod input validation and RPC authorization;
- keep persistence/provider orchestration in `*.server.ts` modules;
- colocate browser-safe schemas, types, pure rules, and focused tests;
- never import server-only modules from browser code.

Naming: components use PascalCase, hooks use a `use` prefix, server functions use action-oriented names, database tables/columns use snake_case, and tests are preferably colocated.

## Server/client and data boundaries

- Treat all browser and provider input as untrusted. Validate external input at the server boundary with Zod.
- Never import `*.server.*`, database clients, secrets, Node-only APIs, or modules marked `@tanstack/react-start/server-only` into browser code.
- Never expose secrets through serialized props, API responses, or `VITE_*` variables.
- Use server functions for authenticated mutations. Keep browser-importable contracts separate from server-only implementation.
- Prefer SSR/route loaders for initial data and TanStack Query for remote synchronization. Use stable query keys and explicit invalidation after mutations.
- Avoid duplicate fetch layers, redundant post-hydration requests, and client state for server-owned data.
- Use event handlers for user-action consequences, `useSyncExternalStore` for browser stores, and React 19 callback refs with returned cleanup for DOM/external registrations.
- Keep serialized boundaries explicit and payloads minimal.

## Security and privacy

Authorization is server-enforced and deny-by-default. Every protected resource operation must verify:

- authenticated identity and active account state;
- ownership or explicit permissions;
- applicable shop/organization relationship;
- privileged-role (`creator`, `admin`) 2FA on both routes and server functions.

Reject deleted or banned accounts in sessions and server functions. Never trust client-provided ownership or role identifiers. Use parameterized Drizzle queries, least privilege, and safe rendering/sanitization for user content. Return user-safe errors while preserving actionable, non-sensitive server context.

Never log passwords, tokens, secrets, or PII. Follow [`docs/DATA_RETENTION.md`](docs/DATA_RETENTION.md) for deletion/anonymization and legal-retention exceptions.

Browser-visible `VITE_*` values are immutable build inputs validated by `src/lib/infra/public-environment.ts`; unknown names are rejected and changes require an image rebuild. Server-only values are runtime inputs validated by `src/lib/infra/server-environment.server.ts`. Document environment changes in `.env.example` and the environment runbook.

## European marketplace constraints

- EUR is the default currency. Keep pricing and VAT rules isolated and testable; do not duplicate financial calculations.
- Eurtisan is established in France. Base fee, VAT, B2B/B2C, reverse-charge, and legal-disclosure behavior on `BUSINESS.md` and focused domain rules.
- Minimize collected personal data and keep production infrastructure in European regions where practical.
- User-facing strings must use the established Paraglide localization system. After changing `messages/`, run `make i18n-compile`; never edit generated locale modules.

## UI and accessibility

Follow existing primitives and [`DESIGN.md`](DESIGN.md); do not introduce a one-off visual language. Brand surfaces may be expressive, while product workflows should remain restrained and task-focused.

For every affected flow:

- use semantic HTML before ARIA;
- ensure keyboard access, visible focus, sufficient contrast, labels, and associated validation messages;
- use accessible primitives for dialogs, menus, and other composite controls, including focus management;
- handle loading, empty, success, and error states intentionally and without cumulative layout shift;
- preserve responsive behavior and avoid unnecessary animation; respect reduced-motion preferences;
- keep core form and action layouts visually stable as feedback changes.

Do not add decorative complexity as a substitute for complete interaction behavior.

## Errors, observability, and performance

- Fail explicitly and predictably. Do not silently recover from data-integrity or security failures.
- Give users safe, useful messages and emit structured, actionable server logs for critical failures without sensitive data.
- Integrate new critical flows with existing observability where useful; avoid noisy or duplicate telemetry.
- Treat bundle size, hydration, query count, re-renders, and network round trips as budgets.
- Prefer SSR and minimal client state, lazy-load genuinely heavy optional features, and optimize measured query problems before adding caching or complexity.
- Prefer platform capabilities and existing dependencies. Before adding a dependency, verify maintenance, installed-version compatibility, bundle/runtime cost, and lack of overlap; document the justification.

## Testing

Add tests at the lowest level that proves the behavior:

- unit tests for domain rules, validation, pricing, and utilities;
- Testing Library component tests for interaction and accessibility-sensitive UI;
- integration tests for authentication, authorization, payments/checkout, permissions, and database-sensitive flows;
- E2E tests for critical user journeys when unit/integration coverage cannot prove the complete contract.

Tests must be deterministic and must not call external networks; mock providers explicitly and avoid snapshot-heavy coverage.

The Vitest gate classifies runtime database dependencies. DB-backed unit files remain serial; pure unit and browser files run in bounded parallel workers. Browser tests and their browser-runtime dependency graphs must remain database-free; keep database-sensitive coverage in `*.test.ts` files.

Playwright E2E is a local/release gate, not a GitHub Actions gate. Use the documented Compose E2E overlay for individual specs. Better Auth rate-limits repeated auth setup, so reuse generated auth state when possible.

## Database and migrations

Use Drizzle for typed database access. Shared, staging, review, and production environments must use committed migrations; `make db-push` is only for disposable local prototyping.

For schema changes:

1. Generate with `make db-generate`.
2. Review the SQL and metadata; include required data migration/backfill logic.
3. Prefer backward-compatible, low-lock changes and consider rollback/partial-application behavior.
4. Obtain explicit approval before destructive or potentially data-losing changes.
5. Run `make db-check`, `make db-migrate-fresh`, and relevant database tests.

Never delete or rename a migration that may have reached a shared environment. Do not re-baseline the incremental chain casually; existing migrations contain required data fixes.

Staging seed data is idempotent, additive, deterministic, and curated. Local development seeding is destructive/random and requires explicit force flags; use only the appropriate documented target.

## Non-obvious project gotchas

- TanStack Router reserves `__root.tsx` for the application root. Nested layouts use `route.tsx`; verify generated parent relationships after creating or renaming layouts.
- Loader arguments must satisfy the same Zod bounds as external callers; hardcoded oversized values fail at runtime.
- To refresh a server-only query from browser code, expose a browser-safe `createServerFn` contract rather than importing its implementation.
- `instrument.server.mjs` must stay directly importable by Node at startup; do not add TypeScript syntax or incompatible imports.
- Grafana Faro uses `sessionStorage`, not cookies; its beacon mechanism does not itself require analytics-cookie consent.
- The observability stack in `infra/observability/` deploys separately and persists across application deployments.
- Privileged tests may need 2FA-enabled users because server functions enforce 2FA independently of route guards.
- Deleted users are deactivated; tests reusing deleted records should expect unauthenticated/banned behavior.
- `make e2e` does not forward arbitrary Playwright flags. Follow `docs/DEVELOPER_TOOLING.md` and use both Compose files when invoking individual E2E specs directly.

## Documentation maintenance

Update behavior documentation when behavior changes. In particular:

- directory ownership, route/UI placement, generated sources, or server/client boundaries: update `docs/ARCHITECTURE.md`, the README project tree, and this guide;
- environment variables: update `.env.example` and the environment runbook;
- deployment assumptions, required jobs, or infrastructure: update deployment/infrastructure documentation and Compose configuration;
- localization strategy, testing workflow, database policy, dependencies, or security expectations: update the corresponding canonical reference.

Prefer links to canonical detail over copying command catalogs, environment samples, deployment steps, or architecture inventories into this file.
