# Release quality gates

The active workflow is [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). It validates pull requests and pushes to `main`; it does not deploy or access shared environments. All project tooling runs through Docker-backed Make targets. GitHub Actions are pinned by commit and use read-only repository permissions.

## Local reproduction

Run these commands from the repository root. They map directly to CI stages.

```bash
# Quality and database
make up
make install
make format
make lint
make check
make audit-production
make i18n-compile
make db-check
make db-migrate-fresh
make test
make build
make bundle-check

# Production packaging and infrastructure
make production-image-smoke
make compose-check
make promtool-check
make ci-workflow-check
make shell-syntax
make ansible-check

# Browser workflows (local production-realistic test topology, not provider evidence)
make e2e
```

`make format`, `make lint`, and every CI verification target are read-only. Use `make format-fix` only as an explicit developer action. CI checks that tracked files remain unchanged after generation, tests, and builds. Release builds set `EURTISAN_PUBLIC_ENV_ONLY=true` internally and pass the complete approved synthetic `VITE_*` contract explicitly; this prevents a developer's ignored `.env.local` from changing release-gate output while normal builds continue to reject unknown public variables.

Local, staging, and production Compose dependencies used by these gates are version-and-digest pinned. Update a digest only after reviewing the upstream release and rerunning the complete gate set.

`make db-migrate-fresh` starts an ephemeral PostgreSQL 16 container on the local Compose network, applies the complete committed migration chain, verifies critical tables and the Drizzle journal, and removes the database even on failure.

## Pull-request feedback budget

The CI latency objective is five minutes from workflow creation to all required validation completing. Gates must be parallelized or made faster rather than removed. Use fully green pull-request runs for comparison, and inspect both wall time and aggregate job duration so a faster critical path does not conceal excessive runner cost.

The pre-optimization baseline was [run 29456472228](https://github.com/JoeriKaiser/eurtisan/actions/runs/29456472228): 9m43s wall time, a 7m52s quality job, a dependent 1m45s production-image job, and 10.57 aggregate job-minutes. Three subsequent green pull-request runs produced:

| Run | Wall time | Quality job | Test step | Production image | Aggregate job-minutes |
| --- | ---: | ---: | ---: | ---: | ---: |
| [29703804564](https://github.com/JoeriKaiser/eurtisan/actions/runs/29703804564) | 6m57s | 6m53s | 3m40s | 1m28s | 9.45 |
| [29704513658](https://github.com/JoeriKaiser/eurtisan/actions/runs/29704513658) | 6m31s | 6m27s | 3m34s | 1m12s | 8.85 |
| [29704794520](https://github.com/JoeriKaiser/eurtisan/actions/runs/29704794520) | 6m19s | 6m16s | 3m25s | 1m27s | 8.77 |

The 6m36s mean is 32% faster than the baseline and aggregate runner duration fell by 15%, but the five-minute objective is not yet met. All three runs restored the GitHub Actions BuildKit manifest and hit the dependency layers in both the quality and production-image builds; the remaining latency is not a cold image-build miss.

The latest run's concurrent Vitest projects took 209.11s for 102 serial database files, 174.80s for 57 browser files, and 45.99s for 64 pure unit files. The database project reported 128.21s in test bodies, 51.96s importing modules, 14.36s transforming, and only 4.32s in Vitest setup. Its five slowest files were `disputes.test.ts` (18.26s), `checkout.test.ts` (13.25s), `products.test.ts` (7.14s), `notification-triggers.test.ts` (5.90s), and `shop-orders.test.ts` (5.48s), together accounting for 39% of database test-body time. A local isolated-database probe measured one cleanup of populated deterministic seed data at 386.55ms and 19 empty cleanups at a 6.41ms mean; 84 empty calls project to about 0.54s. Cleanup round trips are therefore not the dominant bottleneck. Further optimization should profile the slow files and shared module imports, then compare isolated database shards or CI job partitioning without allowing concurrent tests to share one database.

## Bundle budget contract

`config/bundle-budgets.json` records raw and gzip measurements from a named production build. It covers aggregate JavaScript, the largest chunk, the initial Vite entry/static-import graph, the largest async route or integration chunk, and CSS. The checker discovers the Vite entry by its dependency map and follows only static imports, so consent-gated Faro, search, charts, and route components remain async measurements. `make bundle-check` fails regressions. The production-image gate remains the authoritative baseline; the development-only Mollie route is excluded from production route generation.

CSS has both a global transfer ceiling and a tighter increase allowed from the reviewed baseline. The effective limit is the lower value. This leaves normal UI work measurable headroom while preventing repeated baseline updates from silently removing the global cap. The 2026-07-23 audit measured 27,061 bytes of authored `src/styles.css` and 122,756 minified production bytes across 1,211 rule selectors; 1,085 were class-led generated/utility rules. Repeated selectors were limited to expected theme/media/keyframe output and a few responsive gradient utilities, not a removable duplicated stylesheet. The current Tailwind v4 output comes from one root stylesheet and document-shell import; route splitting would duplicate base/theme layers or require a separate extraction pipeline, so it remains a measured future option rather than an unverified optimization.

When a product change intentionally exceeds an effective ceiling:

1. Inspect the generated chunk composition and remove accidental client imports first.
2. Run `make build` and `make bundle-check` against the proposed implementation.
3. Review the raw and gzip delta in the pull request.
4. Update the measured baseline and rationale. Change an incremental or global ceiling only with explicit performance review; a routine baseline refresh must not raise the global ceiling.

Do not raise Vite's warning limit independently. It must remain aligned with `largestJavaScriptBytes`. A passing aggregate budget does not justify moving code into the initial graph: initial and async ceilings are reviewed independently.

## Warning policy

The checked build/test command fails on:

- TanStack non-route file warnings;
- generic Vite large-chunk warnings outside the measured budget;
- React `act(...)` warnings;
- unsupported JSDOM browser API warnings;
- unrecognized browser elements;
- PostgreSQL concurrent-query deprecations.

Ansible validation separately fails any Ansible warning or deprecation. Expected application failure-path logs are structured and redacted; no test report or authenticated browser artifact is uploaded by CI.

Rolldown's plugin timing diagnostic is retained because import protection is a security boundary. It is not suppressed and must be reported until the framework no longer emits it or an owner explicitly approves a documented policy change.

## Repository governance owner action

Repository rules cannot be proven from source alone. An owner must configure and verify GitHub branch protection using [`docs/BRANCH_PROTECTION.md`](../BRANCH_PROTECTION.md), requiring every current CI job. Record the ruleset screenshot/export outside CI without including user or credential data.
