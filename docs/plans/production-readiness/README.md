# Production-Readiness Remediation Plans

These plans translate `docs/PRODUCTION_READINESS_AUDIT.md` into implementer-ready,
phased work. Each phase is a complete, self-contained plan that can be handed to
an individual agent or team.

## Quick reference

| Phase | Plan file | Theme | P0 count | P1 count | P2 count |
|---|---|---|---|---|---|
| 1 | [phase-01-money-path-correctness.md](./phase-01-money-path-correctness.md) | Money-path correctness & safety | 7 | 5 | 0 |
| 2 | [phase-02-database-integrity-and-migrations.md](./phase-02-database-integrity-and-migrations.md) | Database integrity & migrations | 2 | 12 | 0 |
| 3 | [phase-03-gdpr-and-data-retention.md](./phase-03-gdpr-and-data-retention.md) | GDPR & data retention | 1 | 2 | 0 |
| 4 | [phase-04-security-hardening.md](./phase-04-security-hardening.md) | Security hardening | 6 | 5 | 0 |
| 5 | [phase-05-tax-vat-and-i18n.md](./phase-05-tax-vat-and-i18n.md) | Tax, VAT & i18n | 4 | 9 | 0 |
| 6 | [phase-06-deployment-observability-and-backups.md](./phase-06-deployment-observability-and-backups.md) | Deployment, observability & backups | 2 | 12 | 0 |
| 7 | [phase-07-ci-testing-and-documentation.md](./phase-07-ci-testing-and-documentation.md) | CI, testing & documentation | 1 | 4 | 0 |
| 8 | [phase-08-p2-money-path-robustness-and-tax.md](./phase-08-p2-money-path-robustness-and-tax.md) | P2 money-path robustness & tax | 0 | 0 | 7 |
| 9 | [phase-09-p2-gdpr-and-data-security.md](./phase-09-p2-gdpr-and-data-security.md) | P2 GDPR & data security | 0 | 0 | 5 |
| 10 | [phase-10-p2-database-integrity-and-performance.md](./phase-10-p2-database-integrity-and-performance.md) | P2 database integrity & performance | 0 | 0 | 8 |
| 11 | [phase-11-p2-operations-and-deployment-polish.md](./phase-11-p2-operations-and-deployment-polish.md) | P2 operations & deployment polish | 0 | 0 | 7 |
| 12 | [phase-12-p2-security-logging-and-ui-polish.md](./phase-12-p2-security-logging-and-ui-polish.md) | P2 security, logging & UI polish | 0 | 0 | 7 |
| **Total** | | | **23** | **49** | **34** |

## Audit ID cross-reference

### P0 findings

| ID | Title | Phase |
|---|---|---|
| P0-1 | Manual-review orders can be cancelled without refunding the captured Mollie payment | 1 |
| P0-2 | Payout / dispute window mismatch | 1 |
| P0-3 | Dispute refunds clear the wrong reservations and do not restore sellable stock | 1 |
| P0-4 | Broken Drizzle migration chain | 2 |
| P0-5 | GDPR right-to-erasure gap: buyer PII retained in `invoices.billingDetails` | 3 |
| P0-6 | North Star audit document is missing | 7 |
| P0-7 | Debug logging exposes raw session tokens | 4 |
| P0-8 | Top-level imports of `.server.ts` modules from client-imported files | 4 |
| P0-9 | Prometheus cannot scrape `/api/metrics` in production | 4 |
| P0-10 | Deploy script has no post-deploy smoke tests | 6 |
| P0-11 | Ansible vault password file present in working tree | 4 |
| P0-12 | `imgproxy` has no health check in production compose | 6 |
| P0-13 | `meilisearch_sync_queue` has no foreign key to `product` | 2 |
| P0-14 | Cancelling a `pending_payment` order does not void the Mollie payment | 1 |
| P0-15 | VIES validation falls open | 5 |
| P0-16 | Greek VAT-ID / country-code mismatch breaks cross-border B2B | 5 |
| P0-17 | Mollie delayed-routing mock mode is not production-guarded | 1 |
| P0-18 | Hardcoded Euro symbols and English VAT labels | 5 |
| P0-19 | Debug / data-leak logging in production runtime paths | 4 |
| P0-20 | `InvoiceDetailComponent` uses `any` | 5 |
| P0-21 | `authPipeline` API routes do not enforce 2FA for privileged actions | 4 |
| P0-22 | Mollie refund is executed before the DB transaction commits | 1 |
| P0-23 | Chargeback handling is incomplete | 1 |

### P1 findings

| ID | Title | Phase |
|---|---|---|
| P1-1 | Dispute resolution does not create credit notes | 1 |
| P1-2 | Owner refund excludes shipping cost | 1 |
| P1-3 | DAC7 tax identity is not editable after onboarding | 5 |
| P1-4 | Tax env vars are undocumented and read directly from `process.env` | 5 |
| P1-5 | `Promise.all` inside invoice transaction + hardcoded EUR | 5 |
| P1-6 | Sendcloud label total order value is hardcoded to `0.00` | 1 |
| P1-7 | Payout reconciliation over-reverses and swallows refund-list errors | 1 |
| P1-8 | Sensitive credentials stored as plaintext `text` | 2 |
| P1-9 | `payout.shopOrderId` is nullable | 2 |
| P1-10 | `inventory_reservation` unique indexes on nullable columns allow duplicates | 2 |
| P1-11 | `productVariant.stockCount` has no non-negative check | 2 |
| P1-12 | `cartItem.quantity` and `orderItem.quantity` have no positive check | 2 |
| P1-13 | Financial totals lack cross-row consistency enforcement | 2 |
| P1-14 | Refund/dispute amounts lack upper-bound checks | 2 |
| P1-15 | `session.tokenHash` is nullable | 2 |
| P1-16 | `sendcloud_webhook_event` has no retention policy or cleanup | 3 |
| P1-17 | Backup off-site upload is documented but not implemented | 6 |
| P1-18 | Backup retention is inconsistent across docs | 6 |
| P1-19 | WAL archiving is documented but not implemented | 6 |
| P1-20 | Prometheus alert rules only cover email | 6 |
| P1-21 | Alertmanager defaults drop alerts | 6 |
| P1-22 | Grafana defaults to weak admin password | 6 |
| P1-23 | Background jobs have no leader election / locking | 6 |
| P1-24 | Jobs use `restart: unless-stopped` with no restart delay/backoff | 6 |
| P1-25 | CI does not run TypeScript check, build, or E2E | 7 |
| P1-26 | CI uses non-deterministic Bun version | 7 |
| P1-27 | E2E coverage is narrow | 7 |
| P1-28 | `.env.example` is missing many runtime/ops variables | 7 |
| P1-29 | CODEOWNERS references placeholder owner | 4 |
| P1-30 | Health endpoint calls external APIs on every check | 6 |
| P1-31 | Alloy Faro CORS origins are hardcoded | 6 |
| P1-32 | Meilisearch and S3 object storage are not backed up | 6 |
| P1-33 | Logger serializes arbitrary `meta` without PII redaction | 4 |
| P1-34 | Some privileged server-function reads skip 2FA | 4 |
| P1-35 | `verifyShopOwnership` does not check `bannedAt` | 4 |
| P1-36 | `productVariant.sku` unique index allows multiple NULLs | 2 |
| P1-37 | `productOptionValue.value` has no unique constraint per option | 2 |
| P1-38 | `productVariant.name` has no unique constraint per product | 2 |
| P1-39 | `account.accountId` + `providerId` lacks unique constraint | 2 |
| P1-40 | i18n gaps in checkout and seller flows | 5 |
| P1-41 | Accessibility gaps in dialogs, drawer, and checkout | 5 |
| P1-42 | Theme/styling regressions | 5 |
| P1-43 | Route / flow completeness gaps | 5 |
| P1-44 | Status label localization | 5 |
| P1-45 | Checkout fragility | 5 |
| P1-46 | Mollie Connect token refresh / disconnect not implemented | 1 |
| P1-47 | `exportUserData` is incomplete for GDPR portability | 3 |
| P1-48 | `studio/index` uses weaker role guard | 4 |
| P1-49 | Job services have redundant `build:` blocks | 6 |

### P2 findings

| ID | Title | Phase |
|---|---|---|
| P2-1 | DAC7 threshold ignores refunds | 8 |
| P2-2 | Non-DB work inside DB transactions | 8 |
| P2-3 | Manual-review “paid” resolution can oversell | 8 |
| P2-4 | `createCreditNoteForShopOrder` uses weak typing | 8 |
| P2-5 | VIES timeout hardcoded to 2 seconds | 8 |
| P2-6 | Missing tests for critical money paths | 8 |
| P2-7 | EU country list is duplicated | 8 |
| P2-8 | Checkout UI relies on array index for default shipping selections | 12 |
| P2-9 | PII in JSONB columns is not encrypted at rest | 9 |
| P2-10 | Owner/customer message tables not redacted on account deletion | 9 |
| P2-11 | `shipping_label` not cleaned on account deletion | 9 |
| P2-12 | `emailOutbox.recipientEmail` stored in plaintext | 9 |
| P2-13 | State-machine transitions not enforced at schema level | 10 |
| P2-14 | `audit_log.actorId` uses `ON DELETE CASCADE` | 10 |
| P2-15 | `invoices.originalInvoiceNumber` has no foreign key | 10 |
| P2-16 | `meilisearch_sync_queue` status/action are free text | 10 |
| P2-17 | Missing composite indexes for common list queries | 10 |
| P2-18 | `rate_limit` has a redundant index | 10 |
| P2-19 | `shop.onboardingStep` has no bounds check | 10 |
| P2-20 | `shopSocials.platform` is free text | 10 |
| P2-21 | `payoutReconciliationLog` has no retention cleanup | 9 |
| P2-22 | No CPU/memory resource limits in Compose | 11 |
| P2-23 | Disk-health threshold hardcoded | 11 |
| P2-24 | Inconsistent job command style | 11 |
| P2-25 | `make e2e` uses hardcoded 30-second wait loop | 11 |
| P2-26 | Server logs full URL on unhandled errors | 11 |
| P2-27 | No deployment success/failure notification | 11 |
| P2-28 | No canary or staged rollout | 11 |
| P2-29 | Root loader logs auth errors to client console | 12 |
| P2-30 | `auth-utils.ts` uses unstructured `console.warn` | 12 |
| P2-31 | Brittle `as unknown as` / `as any` casts in auth code | 12 |
| P2-32 | GET auth endpoints are not rate-limited | 12 |
| P2-33 | `/api/metrics` token comparison is not constant-time | 12 |
| P2-34 | Footer social links point to placeholders | 12 |

## Notes on scope

All **23 P0**, **49 P1**, and **34 P2** findings from
`docs/PRODUCTION_READINESS_AUDIT.md` are now mapped to a phase above. The
"Needs clarification" items were resolved inside the relevant plans with
documented assumptions.

## Implementation order recommendation

The phases are numbered in the order they should generally be executed, with
some necessary overlap:

1. **Phase 2 first** — the broken migration chain blocks all future schema
   changes; nothing else that touches the database can safely deploy until it is
   fixed.
2. **Phase 4 early** — security findings (token logging, server/client leaks,
   2FA gaps) should be closed before other agents add new code.
3. **Phase 1 next** — money-path correctness is the highest business risk.
4. **Phase 3, 5, 6 in parallel** — these are largely independent once Phase 2
   is done.
5. **Phase 7** — CI and documentation benefit from all prior phases being
   complete.
6. **Phase 13** — product catalog maturity can run in parallel with Phase 5
   (i18n/VAT) once Phase 2 (migrations) is complete, because it adds a new
   schema column and extracts additional catalog-specific strings.
7. **Phases 8–12 (P2)** — run after P0/P1 launch blockers are resolved. Phase 10
   (DB integrity) should generally lead, with 8, 9, 11, and 12 in parallel.

## North Star follow-up phases

These phases are not one-to-one mappings from `docs/PRODUCTION_READINESS_AUDIT.md`
but close owner-facing capability gaps listed in `AGENTS.md`.

| Phase | Plan file | Theme |
|---|---|---|
| 13 | [phase-13-product-catalog-maturity.md](./phase-13-product-catalog-maturity.md) | Product catalog maturity — draft/publish/archive workflow and i18n-ready catalog labels. Covers the catalog-specific parts of P0-18, P1-40, P1-42. |

## Definition of done for the full remediation

- [ ] Every P0 finding in this index is implemented, tested, and verified.
- [ ] Every P1 finding in this index is implemented, tested, and verified.
- [ ] Every P2 finding in this index is implemented, tested, and verified.
- [ ] The index accurately reflects where each finding was addressed.
- [ ] `AGENTS.md` and all runbooks are updated to match the final state.
- [ ] `make lint`, `make format`, and `make check` pass on the full codebase.
- [ ] CI passes (lint, type check, test, build, E2E).
- [ ] Staging deploy succeeds with smoke tests and observability confirms metrics
      and alerts are working.
