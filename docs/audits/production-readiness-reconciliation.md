# Production-readiness audit — reconciliation

**Reconciled at:** `41349a5` · 2026-07-25
**Against:** [`docs/PRODUCTION_READINESS_AUDIT.md`](../PRODUCTION_READINESS_AUDIT.md) (dated 2026-06-21)
**Scope:** all 23 **P0** findings, plus 25 of the 49 **P1** findings. The
remaining 24 P1s and all 34 P2s are **not** reconciled.

## Why this exists

The audit reports 23 launch blockers. It was written a month and several merged
PRs ago and carries no resolution status, so "23 P0 blockers" had become an
unknown rather than a checklist — expensive to act on and easy to over- or
under-react to.

**Headline: none of the 23 P0 findings is still open.** 22 are verifiably fixed
and 1 (P0-4) is cosmetic. The audit's executive summary — "not production-launch
ready … critical blockers in money-handling, data integrity, GDPR erasure,
migration tooling, monitoring auth, and security logging" — no longer describes
the codebase at this commit.

That verdict covers the P0 tier. A partial P1 pass has since checked 25 of 49
findings and found **all 25 fixed** — see the P1 section below. 24 P1s and all
34 P2s remain unchecked, so this is still not a statement that the platform is
launch-ready.

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

### Fixed — confirmed by reading the logic (7)

These could not be settled by pattern-matching and needed the code read. All
seven turned out to be resolved, several implemented exactly as the audit
suggested.

| ID | Finding | Evidence |
|---|---|---|
| P0-3 | Dispute refunds clear wrong reservations, don't restore stock | `restoreShopOrderStockInTx(tx, platformOrderId, shopOrderId)` exists at `src/lib/jobs/inventory.server.ts:292` — the exact signature the audit proposed. Scoped to one shop order, increments `product.stockCount`, deletes only that order's reservations. Called from dispute resolution (`src/lib/disputes/operations.server.ts:1020`) and 6 other paths; covered by `inventory.server.test.ts:424`. |
| P0-15 | VIES validation falls open | `verifyVatIdVies` (`src/lib/tax/vat.server.ts:167`) is documented and implemented **fail-closed**: non-OK HTTP, network error, timeout, and invalid JSON all `return false`, each with an `alert: true` ops log. |
| P0-16 | Greek VAT-ID / country-code mismatch | Handled in both directions: `src/lib/tax/vat-patterns.ts:49` accepts `EL` and `GR` prefixes when the address country is GR, and `vat.server.ts:170` normalises `GR` → `EL` before calling VIES. |
| P0-18 | Hardcoded Euro symbols and English VAT labels | Zero raw `€` characters and zero hardcoded VAT/tax labels remain across `src/components` and `src/route-components`. |
| P0-19 | Debug / data-leak logging in production paths | Every file named in the finding is now clean except `src/integrations/faro.ts`, whose three remaining calls are each gated behind `import.meta.env.DEV` — the suggested fix. The invoice-JSON dump is gone. |
| P0-22 | Mollie refund executed before the DB transaction commits | Restructured as the audit proposed, in both paths. The transaction records durable intent (`refundPendingCents`, `lastRefundAttemptedAt`), reverses the payout and writes the credit note, then commits; the Mollie call is an explicit "Step 2" afterwards, and its failure raises an `alert: true` log plus a 502. See `src/lib/shop-orders/operations.server.ts:855` and `src/lib/disputes/operations.server.ts:940`. |
| P0-23 | Chargeback handling incomplete | `src/lib/tax/chargebacks.server.ts` implements the full workflow: `reversePayoutForRefund`, `restoreShopOrderStockInTx`, credit-note issuance, and notifications — all inside one transaction, documented as retry-safe. |

## P1 tier — partial pass

**Reconciled at:** `f1270f3` · 2026-07-25 · **25 of 49 checked, all 25 fixed.**
The remaining 24 are listed below as unchecked, not as open.

### Fixed — verified (25)

**Database integrity (12).** Every schema finding is resolved.

| ID | Evidence |
|---|---|
| P1-8 | Credentials are encrypted at the application layer (AES-256-GCM), not stored plaintext: `encryption.server.ts` decrypts `account.password`, `shop.mollieAccessToken`, `two_factor.secret`. The column type stays `text` because ciphertext is text — the finding read the schema, not the access path. |
| P1-9 | `payout.shopOrderId` is `.notNull()` with a cascade FK |
| P1-10 | Split into two indexes so neither spans a nullable column: `inventory_reservation_product_order_unique` and `..._product_cart_unique` |
| P1-11 | Variant stock non-negative check present |
| P1-12 | Positive-quantity checks present on cart and order items |
| P1-13 | 4 financial consistency check constraints |
| P1-14 | Explicit upper bounds: `refundedCents <= totalCents` and `refundedCents <= subtotalCents + shippingCostCents` |
| P1-15 | `session.tokenHash` is `.notNull()` with a unique index |
| P1-36 | Partial unique index: `.on(table.sku).where(isNotNull(table.sku))` |
| P1-37 | `product_option_value_option_value_unique` on `(optionId, value)` |
| P1-38 | `product_variant_product_name_unique` on `(productId, name)` |
| P1-39 | `account_provider_account_unique` present |

**Observability (4).**

| ID | Evidence |
|---|---|
| P1-20 | 25 alert rules across 12 files — money, backups, job staleness, webhooks, disputes — not just email |
| P1-21 | The `receiver: 'null'` default is the **local dev** file, which says so in its header. The Ansible template (`alertmanager.yml.j2`) routes `severity: critical` to a `critical` receiver. |
| P1-22 | `GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}` — env-supplied, no weak default |
| P1-33 | Logger has redaction handling (10 references) |

**Backups (3).** All three are implemented; two ship **disabled by default**, which is an ops decision rather than missing code.

| ID | Evidence |
|---|---|
| P1-17 | Offsite upload implemented via rclone; `backup_offsite_rclone_remote` defaults to `""` (unconfigured) with a 90-day offsite retention setting |
| P1-19 | WAL archiving implemented with `docker-compose.wal-archive.yml`; `postgres_wal_archive_enabled` defaults to `false` |
| P1-32 | `backup.sh.j2` creates a Meilisearch dump alongside each database backup |

**CI and operations (6).**

| ID | Evidence |
|---|---|
| P1-16 | `sendcloud-retention-cleanup` job exists and is deployed |
| P1-23 | `withJobLock` takes a PostgreSQL advisory lock per job, with a `LOCK_IDS` registry — single-instance execution across containers |
| P1-24 | All 16 job services carry `restart_policy: {condition: on-failure, delay: 10s, max_attempts: 5, window: 120s}` |
| P1-25 | CI runs `make check` (tsc), `make test`, `make build`, plus format, lint, `audit-production`, `db-check`, and bundle budgets |
| P1-26 | Bun pinned to `1.3.13` by SHA256 digest in both Dockerfiles; CI executes through Docker, so the toolchain is deterministic |
| P1-49 | 0 of 16 job services carry a redundant `build:` block |

### Not yet checked (24)

Not evidence of a problem — simply not reached in this pass.

`P1-1` `P1-2` `P1-3` `P1-4` `P1-5` `P1-6` `P1-7` (invoicing, refunds, DAC7, tax config,
shipping, payout reconciliation) · `P1-18` (backup retention doc consistency) ·
`P1-27` (E2E breadth — partially addressed by the search specs added in #15) ·
`P1-28` `P1-29` (env docs, CODEOWNERS) · `P1-30` `P1-31` (health-check external
calls, Alloy CORS) · `P1-34` `P1-35` `P1-48` (authorization) · `P1-40`–`P1-45`
(frontend i18n, a11y, theme, flows, checkout) · `P1-46` (Mollie Connect token
refresh) · `P1-47` (GDPR export completeness)

The money-adjacent ones (`P1-1`, `P1-2`, `P1-5`, `P1-6`, `P1-7`, `P1-46`) are the
highest-value remainder and deserve the same read-the-code treatment the P0
money-path findings got.

## Remaining work

- **P1 (49 findings) and P2 (34 findings) are unreconciled.** Given the P0 rate,
  expect most to be resolved too — but "expect" is exactly the assumption this
  document exists to replace.
- **P0-4 is worth tidying, carefully.** Renaming the duplicated migration files
  means editing `tag` values in `drizzle/meta/_journal.json` to match, and those
  tags are what already-migrated environments match against. It is a deliberate
  migration-tooling change, not a rename — treat it as such or leave it.
- The audit still carries no inline per-finding status; this document is the
  cross-reference. Folding status into the rows would remove the indirection if
  that proves annoying.

## Method

Verdicts came from reading the current implementation at the recorded commit,
not from the audit's original file paths — most of which have since moved
(`src/lib/disputes.server.ts` → `src/lib/disputes/operations.server.ts`, and so
on). Anything that could not be settled by reading was recorded as unconfirmed
rather than assumed; on this pass, nothing remained in that state.
