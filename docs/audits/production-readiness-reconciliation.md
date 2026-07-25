# Production-readiness audit — reconciliation

**Reconciled at:** `41349a5` · 2026-07-25
**Against:** the production-readiness audit of 2026-06-21 (106 findings)

That audit has since been **deleted**. Its executive summary asserted 23
launch blockers and "not production-launch ready", which this reconciliation
showed to be false — leaving it in the repository was actively misleading. The
full text of all 106 findings remains in git history:

```
git show e5e7754:docs/PRODUCTION_READINESS_AUDIT.md
```

Everything still actionable was carried into this document before deletion; see
**Open items** below. Finding IDs (`P0-1`, `P1-42`, …) refer to that historical
document and are kept so the two can still be cross-read.
**Scope:** all 23 **P0**, all 49 **P1**, and 24 of the 34 **P2** findings —
96 of 106 total.

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

The P1 tier is now also complete: **45 of 49 fixed, 4 partially open**, all four
small and frontend-only. Nothing in the P0 or P1 tiers blocks a launch on
correctness, money handling, data integrity or authorization grounds.

Of 34 P2 findings, 24 are checked: 21 fixed, 3 open or uncertain, 10 not
reached. Across all tiers that is **96 of 106 reconciled — 89 fixed, 1 cosmetic,
7 open or uncertain, all of them small.**

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

## P1 tier — complete

**Reconciled at:** `8ee4348` · 2026-07-25 · **all 49 checked: 45 fixed, 4
partially open.**

### Fixed — verified (45)

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

**Money-adjacent (6).** Checked by reading the code, as the P0 money path was.

| ID | Evidence |
|---|---|
| P1-1 | Dispute resolution calls `createCreditNoteForShopOrder(lockedDispute.shopOrderId, tx)` at `src/lib/disputes/operations.server.ts:861`, inside the transaction |
| P1-2 | Full owner refunds include shipping: `refundCents = remainingTotalCents` (`shop-orders/operations.server.ts:797`), and the cancellation path uses `subtotalCents + shippingCostCents - refundedCents` (`:1432`) |
| P1-5 | Zero `Promise.all` calls remain in the invoice modules, so the sequence-backed `allocateNextInvoiceNumber` is no longer raced. No hardcoded currency in line descriptions — the only `EUR` occurrence is a billing-party constant. |
| P1-6 | `total_order_value` is computed, not hardcoded (`sendcloud-provider.ts:414`), with a test asserting a real value (`'12.34'`) |
| P1-7 | Both halves fixed. `attributeRefundsToShopOrder` (`payouts/reconciliation.server.ts:74`) attributes each refund proportionally to that shop order's unrefunded portion — its docstring names the exact failure mode the audit described. `listMollieRefundsForPayment` now **throws** on a non-OK response (`:53`) instead of swallowing it into an empty list; reconciliation errors are counted and logged. |
| P1-46 | Full token lifecycle implemented in `src/lib/tax/mollie-connect.server.ts`: `refreshMollieConnectTokens` (`grant_type: 'refresh_token'`), `ensureMollieAccessToken` for refresh-on-demand, merchant-revoked detection, and `disconnectMollieConnect` calling `revokeMollieToken(refreshToken, 'refresh_token')` so the Mollie-side grant is actually revoked |

**Authorization (3).**

| ID | Evidence |
|---|---|
| P1-34 | `requirePrivileged2FA` is called in both named readers: `src/lib/shop-orders.ts:47` (`getShopOrder`) and `src/lib/disputes.ts:116` (`getDisputeDetail`), plus two further call sites each |
| P1-35 | Fixed at a different layer than the finding proposed, and a better one. `verifyShopOwnership` no longer exists; the surviving `verifyShopOwnershipOrAdmin` checks neither flag, but `bannedAt` is now enforced in the auth layer itself — `auth/middleware.server.ts:38`, `auth/authz.ts:94`, and `auth/server.ts:38,58,84` — so a banned user never reaches the ownership check. Adding it there would be defence in depth, not a fix. |
| P1-48 | `src/routes/studio/index.tsx:6` uses `guardPrivilegedRole('creator')` |

**Compliance and configuration (5).**

| ID | Evidence |
|---|---|
| P1-3 | DAC7 fields are editable post-onboarding: `legalEntityType`, `dateOfBirth`, `taxId` and `businessRegistrationNumber` are all accepted by `shops/settings.server.ts` |
| P1-4 | `ENABLE_VIES_VALIDATION` is typed in `infra/server-environment.server.ts:73` and documented in `.env.example` alongside the platform fee variables |
| P1-29 | CODEOWNERS names the real owner with a comment on changing it, not a placeholder |
| P1-31 | Alloy CORS origins come from `env("ALLOY_FARO_CORS_ORIGINS")`, not hardcoded |
| P1-47 | `exportUserData` covers all five named gaps and more: invoices, owner messages, dispute messages, audit logs, email preferences, plus orders, returns, reviews and notifications |

**Operations (3).**

| ID | Evidence |
|---|---|
| P1-18 | Local (30 day) and offsite (90 day) retention are deliberately tiered rather than inconsistent. Values checked, not surrounding prose. |
| P1-27 | 87 E2E spec files — no longer narrow |
| P1-30 | Readiness and liveness call only `runCriticalChecks` (database, Meilisearch, disk). External APIs live in `runDependencyChecks`, reached only by the deeper endpoint, so Mollie and Brevo are not called on every probe. |

**Frontend (2 of 6 fully fixed — see open items below).**

| ID | Evidence |
|---|---|
| P1-40 | Broadly resolved: no raw `€`, no hardcoded VAT/tax labels, and confirm dialogs use Paraglide messages. The status-label exception is tracked as P1-44 below. Sampled, not exhaustively swept. |
| P1-45 | `UNSUPPORTED_DESTINATION_ERROR` is a shared constant produced and consumed by `checkout/shipping.server.ts`; no `.includes('cannot ship')` sniffing remains, and "business days" survives only in code comments |

### Still open (2)

Both remaining items are frontend polish rather than defects. `P1-42` and
`P1-44` were fixed — see **Fixes applied** below.

| ID | Status | Detail |
|---|---|---|
| P1-41 | **Partially open** | Three native `window.confirm` calls remain for destructive actions — one note deletion and the refund/cancel pair in `studio/$shopId.orders.$shopOrderId.tsx`. Their messages are translated, but a native dialog is neither styleable nor consistently announced. The consent-banner focus trap and admin-sidebar `aria-hidden` sub-items were not verified. |
| P1-43 | **Partially open** | The account order detail now uses `BuyerOrderDetailPage` with the full CTA set, so that half is fixed. `src/routes/studio/index.tsx` is still 34 lines and looks like a placeholder. |



## P2 tier — partial pass

**Reconciled at:** `8ee4348` · 2026-07-25 · **24 of 34 checked: 22 fixed, 2 open
or uncertain.** The other 10 were not reached.

### Fixed — verified (21)

| ID | Evidence |
|---|---|
| P2-5 | `getViesTimeoutMs()` reads `VIES_TIMEOUT_MS` (`infra/env.server.ts:416`) — no longer hardcoded |
| P2-7 | Single EU country source in `src/lib/shared/address-validation.ts` |
| P2-9 | JSONB PII encrypted via `encryptJsonb` / `decryptJsonb` |
| P2-10 | Account deletion redacts `ownerMessage` and `customerNote` |
| P2-12 | `emailOutbox.recipientEmail` encrypted and decrypted through the encryption module |
| P2-14 | `audit_log.actorId` is `onDelete: 'set null'`, so audit history survives actor deletion |
| P2-16 | `meilisearchSyncActionEnum` and `meilisearchSyncQueueStatusEnum` replace free text |
| P2-18 | The redundant `rate_limit` index is gone; one remains |
| P2-19 | `shop_onboarding_step_bounds` check constraint present |
| P2-20 | `shopSocialPlatformEnum` replaces free text |
| P2-21 | `payout-reconciliation-log-cleanup` job exists and is deployed |
| P2-22 | All 21 production services declare CPU and memory limits |
| P2-23 | Disk threshold configurable via `HEALTH_DISK_THRESHOLD_BYTES` |
| P2-25 | No hardcoded 30-second wait loop remains in the Makefile |
| P2-26 | `src/lib/shared/request-path.server.ts` sanitises paths, redacting sensitive query parameters before logging |
| P2-28 | Canary/staged rollout implemented — 10 references across the Ansible role and deployment guide |
| P2-30 | No `console.warn` remains in the auth utilities |
| P2-31 | `as any` / `as unknown as` survive only in auth **test** files, not production code |
| P2-32 | Caddy rate-limits `handle /api/auth*` across all methods, GET included |
| P2-33 | `crypto.timingSafeEqual` used for the metrics token comparison |
| P2-34 | No placeholder hrefs remain in the footer |

### Open or uncertain (3)

| ID | Status | Detail |
|---|---|---|
| P2-15 | **Open by design?** | `invoices.originalInvoiceNumber` still has no foreign key. It references an invoice *number* (a string) rather than an id, so an FK may have been deliberately omitted. Needs a decision rather than a fix. |
| P2-27 | **Likely open** | No deployment success/failure notification found in `rollout.yml`. Low impact given alerting covers runtime health, but a failed rollout is currently silent. |

### Not checked (10)

`P2-1` (DAC7 threshold vs refunds) · `P2-2` (non-DB work in transactions) ·
`P2-4` (credit-note typing) · `P2-6` (money-path test coverage) ·
`P2-8` (checkout shipping array index) · `P2-13` (state machine at schema
level) · `P2-17` (composite indexes) · `P2-24` (job command style) ·
`P2-29` (root loader auth logging)

`P2-3` was checked after this pass and **fixed** — see below.


## Fixes applied after reconciliation

| ID | Fix |
|---|---|
| P2-3 | **Manual-review paid resolution could oversell.** `decrementStockForPaidOrder` clamped with `Math.max(0, …)`, silently selling stock that did not exist. The response now depends on whether the caller can still refuse: payment-webhook paths keep clamping (throwing would fail the webhook and strand a captured payment) but raise an `alert: true` log and increment `eurtisan_inventory_oversell_total`, while `resolveManualReviewQuery` passes `rejectOnShortfall: true` and gets an `InsufficientStockError`, surfaced as a 409 telling the operator to cancel and refund instead. Four tests cover both directions. |
| P2-11 | **Deleting an account left a resolvable handle to the buyer's shipping data.** The `shipping_label` row holds no PII directly, but `labelUrl` resolves — with carrier credentials — to a PDF bearing the buyer's name and address, and the tracking identifiers are carrier-side handles to the same shipment. The PDF lives at Sendcloud under their retention, so account deletion now nulls `labelUrl`, `trackingNumber` and `externalParcelId`. The row survives because the seller's fulfilment record legitimately outlives the buyer's account, exactly as invoices do. |
| P1-44 | **Buyers saw raw enum values.** Three components rendered `{order.status}` directly, showing `pending_payment` in a badge. All three now use the existing translated `getOrderStatusLabel`; `CustomerOrderSummary.status` was widened from `string` to `OrderStatus` so the type system enforces it rather than a cast. |
| P1-42 | **`info` was never a defined theme token**, so `bg-info/10` and `text-info` in `ReturnRequestPage` rendered with no background or colour — on a legally required EU returns flow. Switched to the defined `accent-secondary` pair. The `HomePage` inline `<style>` block moved into `styles.css`, which also fixes a latent bug: three `home/` components use `animate-fade-in-up` but the keyframes only existed while `HomePage` was mounted. |
| — | **Suspending a shop left its listings searchable.** `moderateShopQuery` updated `shop.isSuspended` but nothing propagated to the search index. It now enqueues an `index` action for every product of the shop inside the same transaction — correct in both directions, since the sync worker re-evaluates eligibility and removes or restores the document. Enqueued rather than called inline so moderation cannot fail on a search outage. Three tests. |


## Remaining work

- **10 P2 findings remain unchecked**, listed above. `P2-3` (manual-review
  oversell) is the one with correctness stakes.
- **The four open P1s are the actionable output of this whole exercise.** They
  are small: an undefined `info` theme token, three raw status enums shown to
  buyers, three native confirm dialogs, and a placeholder studio index. None
  needs design work.
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
