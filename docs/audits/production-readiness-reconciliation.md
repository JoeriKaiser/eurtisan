# Production-readiness audit — P0 reconciliation

**Reconciled at:** `6fac0a6` · 2026-07-25
**Against:** [`docs/PRODUCTION_READINESS_AUDIT.md`](../PRODUCTION_READINESS_AUDIT.md) (dated 2026-06-21)
**Scope of this pass:** the 23 **P0 "cannot launch"** findings only. P1 (49) and
P2 (34) have **not** been reconciled.

## Why this exists

The audit reports 23 launch blockers. It was written a month and several merged
PRs ago and carries no resolution status, so "23 P0 blockers" had become an
unknown rather than a checklist — expensive to act on and easy to over- or
under-react to.

**Headline: 15 of 23 P0s are verifiably fixed, 1 is cosmetic, and 7 need a
closer look.** The launch-blocker list is materially shorter than the audit
implies, but it is not empty.

## Verdicts

Each verdict states the evidence, so it can be re-checked rather than trusted.

### Fixed — verified against current code (15)

| ID | Finding | Evidence |
|---|---|---|
| P0-1 | Manual-review cancel without refund | `manual_review: ['paid', 'cancelled', 'refunded']` in `src/lib/shop-orders/lifecycle.ts:13` |
| P0-2 | Payout / dispute window mismatch | Unified: single `DISPUTE_WINDOW_DAYS = 30` in `src/lib/shared/constants.ts:9`; no competing 14-day constant remains |
| P0-5 | Buyer PII retained in `invoices.billingDetails` | Account deletion redacts and re-encrypts: `.set({ billingDetails: encryptJsonb(redacted) })` at `src/lib/users/account-data.server.ts:706,720` |
| P0-6 | North Star audit document missing | Audit present; canonical-references entry added in PR #16 (it was genuinely absent until then, despite the audit claiming otherwise) |
| P0-7 | Debug logging exposes session tokens | `src/lib/auth.ts` is now a 1-line re-export with no logging; implementation moved to `src/lib/auth/` |
| P0-8 | Top-level `.server.ts` imports from client-imported files | 0 top-level `.server` imports in `src/lib/categories.ts` and `src/lib/admin-categories.ts`; all are dynamic `await import()` inside handlers |
| P0-9 | Prometheus cannot scrape `/api/metrics` | `infra/observability/prometheus/prometheus.yml` passes `params: token`, Ansible-rendered so the token is never committed |
| P0-10 | No post-deploy smoke tests | `infrastructure/ansible/roles/eurtisan/tasks/rollout.yml:3` runs `bun run smoke:client-config` against the built image |
| P0-11 | Ansible vault password file in working tree | No vault password file present anywhere in the tree |
| P0-12 | `imgproxy` has no production health check | `healthcheck` block present on the `imgproxy` service in `docker-compose.prod.yml` |
| P0-13 | `meilisearch_sync_queue` missing FK to `product` | `productId` declares `.references(() => product.id, { onDelete: 'cascade' })` in `src/db/schema.ts:1344` |
| P0-14 | Cancelling `pending_payment` does not void the Mollie payment | `molliePaymentProvider.cancelPayment(...)` at `src/lib/shop-orders/operations.server.ts:1015`, with a comment explaining the late-capture risk |
| P0-17 | Mollie mock mode not production-guarded | Guard exists and is covered: tests assert it throws in production when `MOLLIE_API_KEY` is missing and `MOCK_PAYMENTS_ENABLED` is not true |
| P0-20 | `InvoiceDetailComponent` uses `any` | No `: any` remains in the invoice components |
| P0-21 | `authPipeline` API routes do not enforce 2FA | `requirePrivileged2FA` present in API route handlers (e.g. `src/routes/api/shops/$shopId/orders.$shopOrderId.ts`) |

### Cosmetic — not a blocker (1)

| ID | Finding | Evidence |
|---|---|---|
| P0-4 | Broken Drizzle migration chain | Duplicate numeric prefixes remain (`0048_crazy_maddog` / `0048_dapper_joystick`, `0072_revert_premature_payout_releases` / `0072_worthless_angel`) and there is no `0047`. **But the chain applies cleanly**: the journal holds 79 distinct `idx`+`tag` entries for 79 SQL files, `drizzle-kit migrate` was run twice against a fresh database during this session with no error, and CI runs `scripts/validate-fresh-migrations.sh`. Drizzle keys on `idx`/`tag`, not the filename prefix, so the duplication is untidy rather than broken. Worth renaming for legibility; not launch-blocking. |

### Still to confirm — could not verify mechanically (7)

These need a human read of the logic. They are **not** confirmed open — only
unconfirmed.

| ID | Finding | What to check |
|---|---|---|
| P0-3 | Dispute refunds clear the wrong reservations, don't restore stock | Trace reservation clearing and stock restoration in `src/lib/disputes/operations.server.ts` |
| P0-15 | VIES validation falls open | Find the actual VIES call path; the `catch` blocks in `src/lib/tax/vat.server.ts:60` belong to locale country-code lookup, not VIES |
| P0-16 | Greek VAT-ID / country-code mismatch (EL vs GR) | Check the EL/GR normalisation in VAT-ID validation |
| P0-18 | Hardcoded Euro symbols and English VAT labels | Sweep tax/VAT UI strings for Paraglide coverage; search was the only area with hardcoded English when spot-checked, but tax labels were not examined |
| P0-19 | Debug / data-leak logging in production paths | Audit remaining `console.*` and `logger.debug` calls for PII |
| P0-22 | Mollie refund executed before the DB transaction commits | Check ordering around `refundPayment` at `src/lib/shop-orders/operations.server.ts:857,1034` and `src/lib/disputes/operations.server.ts:943` |
| P0-23 | Chargeback handling incomplete | `src/routes/api/webhooks/mollie-chargeback.ts` exists; compare against the finding's requirements |

## Remaining work

- **P1 (49 findings) and P2 (34 findings) are unreconciled.** The same method
  applies and would likely show a similar resolution rate.
- The audit itself still carries no inline status. This document is the
  cross-reference; if it proves useful, folding status into the audit rows would
  remove the indirection.
