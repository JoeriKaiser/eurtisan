# Eurtisan Production-Readiness Audit

**Scope:** Full-stack audit of the Eurtisan marketplace codebase.  
**Date:** 2026-06-21  
**Method:** Read-only static code review. No code was modified and no runtime data was accessed.  
**Audited areas:** Frontend UX, backend correctness, authorization/security, database/schema, GDPR/compliance, payments/tax/VAT/invoicing, shipping, order lifecycle, disputes, payouts, operations, deployment, observability, backups, and testing.

> **Status is tracked separately — read this alongside
> [`audits/production-readiness-reconciliation.md`](audits/production-readiness-reconciliation.md).**
> As of `41349a5` (2026-07-25), **none of the 23 P0 findings below is still
> open**: 22 are verifiably fixed and 1 (P0-4, migration-file numbering) is
> cosmetic. The executive summary and finding text below are preserved as
> written on 2026-06-21 and do **not** reflect subsequent work — in particular,
> the "Top 10 blockers" list is historical.
>
> All 49 P1 findings checked: 45 fixed, 4 partially open (small, frontend-only).
> Of 34 P2s, 24 checked: 21 fixed, 3 open or uncertain. Across all tiers: **96 of
> 106 reconciled, 89 fixed, 1 cosmetic, 7 open or uncertain — all small.**

---

## Executive Summary

The codebase is **functionally impressive** and most major user flows are wired end-to-end: buyer discovery, checkout, Mollie payments, seller onboarding, product/variant management, shop settings, order fulfillment, disputes, admin moderation, and account deletion. However, it is **not production-launch ready** today. There are **critical blockers in money-handling, data integrity, GDPR erasure, migration tooling, monitoring auth, and security logging** that must be resolved before real users and real funds are involved.

### Finding counts

| Severity | Count | Launch meaning |
|----------|-------|----------------|
| **P0 — Cannot launch** | 23 | Fix these before any production deploy or live transaction. |
| **P1 — Should fix before launch** | 49 | Fix before public launch; workarounds may exist but risk revenue, compliance, or operability. |
| **P2 — Polish / post-launch** | 34 | Fix after launch; improve UX, performance, or maintainability. |
| **Needs clarification** | 18 | Require a product/ops decision before the right fix can be implemented. |

### Top 10 blockers (P0)

1. **Manual-review orders can be cancelled without refunding the captured Mollie payment.**
2. **Payouts release after 14 days, but buyers can dispute for 30 days — sellers can be paid for later-refunded orders.**
3. **Dispute refunds clear the wrong reservations and do not restore sellable stock.**
4. **The Drizzle migration chain is broken** (duplicate `0048` migrations, no `0047`, missing snapshots for `0055`–`0057`).
5. **Buyer invoices retain PII after account deletion** — GDPR Article 17 violation.
6. **The North Star source-of-truth audit document was missing from the repository; `AGENTS.md` now points to this audit and the remediation plan index.**
7. **Debug logging exposes raw session tokens in `src/lib/auth.ts:78`.**
8. **Top-level imports of `.server.ts` modules from files imported by client routes** (`src/lib/categories.ts`, `src/lib/admin-categories.ts`) violate the server/client boundary.
9. **Prometheus cannot scrape `/api/metrics` in production** because the scrape config does not pass `METRICS_TOKEN`.
10. **The deploy script has no post-deploy smoke tests** — a migration can succeed while the app fails to start.

### Cross-cutting themes

- **Money-path correctness:** Several P0s involve refunds, payouts, chargebacks, and inventory not being kept consistent. These are the highest-risk areas.
- **GDPR / data retention:** Account deletion is mostly well implemented but has a critical gap for buyer invoices, plus undocumented retention for Sendcloud webhooks and payout reconciliation logs.
- **Production operability:** WAL archiving, off-site backups, alerting, and deployment smoke tests are documented but not implemented.
- **i18n / localization:** A large surface of user-facing text, especially VAT/tax labels and Euro symbols, is hardcoded English.
- **Security hygiene:** Debug logs (some containing PII/tokens), missing 2FA on some API routes, and brittle auth casts remain.
- **Tooling integrity:** The Drizzle migration chain must be repaired before any future schema change can be deployed safely.

---

## How to use this document

Each finding is structured as:

- **ID** — `P0-1`, `P1-1`, etc.
- **Domain** — area of the product.
- **Affected files** — exact paths and line numbers where known.
- **Gap** — what is missing, broken, or incomplete.
- **Why it blocks production / degrades UX** — business or technical risk.
- **Suggested fix / next step** — concrete remediation guidance.

Items marked **“Needs clarification”** are not blockers by themselves but require a decision before implementation.

---

## P0 — Cannot Launch

### P0-1. Manual-review orders can be cancelled without refunding the captured Mollie payment
- **Domain:** Orders / Payments
- **Affected files:** `src/lib/shop-orders.server.ts:119-129`, `:1339-1409`; `src/route-components/studio/$shopId.orders.$shopOrderId.tsx:171-174`; `src/routes/api/webhooks/mollie.ts:311-333`
- **Gap:** When Mollie detects an inventory mismatch, the order moves to `manual_review`. The studio UI lets the owner resolve to `paid` or `cancelled`. Resolving to `cancelled` restores stock but never refunds the captured Mollie payment. `canRefund` explicitly excludes `manual_review`.
- **Why it blocks production:** The platform can keep a buyer’s money while cancelling their order.
- **Suggested fix:** Add `manual_review -> refunded` to `VALID_TRANSITIONS`, refund via Mollie before cancelling, and update the UI to expose a refund path while in `manual_review`.

### P0-2. Payout / dispute window mismatch
- **Domain:** Payouts / Disputes
- **Affected files:** `src/lib/shop-orders.server.ts:33-40` (`DISPUTE_WINDOW_DAYS = 14`); `src/lib/disputes.server.ts:27` (`DISPUTE_WINDOW_DAYS = 30`); `src/lib/payout-reconciliation.server.ts:225-242`
- **Gap:** Payouts become releasable 14 days after delivery, but buyers can open disputes for 30 days.
- **Why it blocks production:** Sellers can be paid for orders that are later disputed and refunded. This is the exact timing gap called out in the North Star objectives.
- **Suggested fix:** Use a single source of truth for the dispute window (30 days) and do not release payouts until the window has expired.

### P0-3. Dispute refunds clear the wrong reservations and do not restore sellable stock
- **Domain:** Disputes / Inventory
- **Affected files:** `src/lib/disputes.server.ts:812-814`; `src/lib/inventory.server.ts:278-282`
- **Gap:** `resolveDisputeQuery` calls `releaseStockInTx(tx, lockedShopOrder.platformOrderId)`, which deletes all reservations for the entire platform order (not just the disputed shop order) and does not increment `product.stockCount` for paid orders.
- **Why it blocks production:** Inventory becomes silently corrupted: stock is not returned to inventory for refunds, and unrelated shop orders in the same platform order can lose their reservations.
- **Suggested fix:** Implement `restoreShopOrderStockInTx(tx, platformOrderId, shopOrderId)` that restores only the disputed shop order’s stock and increments `product.stockCount` for paid orders.

### P0-4. Broken Drizzle migration chain
- **Domain:** Database / Migrations
- **Affected files:** `drizzle/0048_crazy_maddog.sql`, `drizzle/0048_dapper_joystick.sql`, `drizzle/meta/_journal.json`, missing `drizzle/meta/0055_snapshot.json`, `0056_snapshot.json`, `0057_snapshot.json`
- **Gap:**
  - Two migrations share the same numeric prefix (`0048_crazy_maddog.sql` and `0048_dapper_joystick.sql`); `_journal.json` records them as consecutive entries (`idx` 47 and 48) but both tagged `0048_*`.
  - There is no `0047_*.sql` migration; the chain jumps from `0046` to `0048`.
  - Only one `0048_snapshot.json` exists, so the snapshot for the first `0048` migration is missing.
  - Migrations `0055_account_security_two_factor.sql`, `0056_chargeback_order_status.sql`, and `0057_email_suppression.sql` have no corresponding snapshot files.
- **Why it blocks production:** `drizzle-kit generate` computes diffs from the most recent snapshot. Missing snapshots and duplicated tags will corrupt future migrations, making schema evolution impossible after launch.
- **Suggested fix:** Reconcile the migration history. In a clean local database, run all migrations, then use `drizzle-kit generate` from the current `schema.ts` to produce a clean consolidated migration and snapshot. Verify `drizzle-kit migrate` and `drizzle-kit generate` both work on a fresh database.

### P0-5. GDPR right-to-erasure gap: buyer PII retained in `invoices.billingDetails`
- **Domain:** GDPR / Compliance
- **Affected files:** `src/lib/account-data.server.ts:273-281`; `invoices` table; `platform_order` table
- **Gap:** `deleteUserAccount` redacts `invoices.billingDetails` only for seller-side invoices (shops owned by the deleted user). It does not redact customer invoices where the deleted user was the buyer. The `billingDetails.to` field contains the buyer’s name and email.
- **Why it blocks production:** Violates GDPR Article 17 and the project’s own `DATA_RETENTION.md`, which states `invoices.billingDetails` should be replaced with a redacted address object.
- **Suggested fix:** In `deleteUserAccount`, also update `invoices` linked (via `shop_order` → `platform_order`) to platform orders owned by the deleted user, redacting `billingDetails`. Extend `src/lib/account-data.server.test.ts` to assert this.

### P0-6. North Star audit document is missing
- **Domain:** Documentation / Project Management
- **Affected files:** `AGENTS.md:13`; `docs/PRODUCTION_READINESS_AUDIT.md`; `docs/plans/production-readiness/README.md`
- **Gap:** `AGENTS.md` referenced a missing audit document as the source of truth for remaining P0 launch blockers; the file did not exist in the repository.
- **Why it blocks production:** The team cannot verify which North Star items are actually done or pending. The audit findings in `AGENTS.md` and `docs/user_flow.md` were inconsistent with each other.
- **Suggested fix:** Update `AGENTS.md` to point to `docs/PRODUCTION_READINESS_AUDIT.md` as the single source of truth and to `docs/plans/production-readiness/README.md` for the remediation plan index, and add a reconciliation section mapping each North Star theme to its audit IDs and phase plan(s).

### P0-7. Debug logging exposes raw session tokens
- **Domain:** Security / Auth
- **Affected files:** `src/lib/auth.ts:78`
- **Gap:** `console.log('AUTH DB ADAPTER findOne:', model, 'where:', JSON.stringify(where))` runs before `transformSessionWhere()` converts `token` → `tokenHash`.
- **Why it blocks production:** Session tokens can be printed to production logs, leading to account takeover if logs are accessed.
- **Suggested fix:** Remove the `console.log` entirely. If adapter tracing is needed, log only the model name or rewrite the `where` clause to hide the raw token first.

### P0-8. Top-level imports of `.server.ts` modules from client-imported files
- **Domain:** Security / Server-Client Boundary
- **Affected files:** `src/lib/categories.ts:8`; `src/lib/admin-categories.ts:6`; `src/routes/__root.tsx:4`
- **Gap:** `categories.ts` and `admin-categories.ts` import `invalidateServerCache` from `./server-cache.server` at the top level and are imported by client routes. The function is only used inside server-function handlers, but the top-level import is evaluated when the module loads on the client.
- **Why it blocks production:** Violates the project’s server/client boundary rule and may ship server-only code to the browser or fail the production build.
- **Suggested fix:** Move the import behind a dynamic import inside each server-function handler, or create a non-`.server` façade that dynamically imports it.

### P0-9. Prometheus cannot scrape `/api/metrics` in production
- **Domain:** Observability
- **Affected files:** `infra/observability/prometheus/prometheus.yml:18-27`; `instrument.server.mjs:53-58`
- **Gap:** The production app requires `METRICS_TOKEN` for `/api/metrics`, but the Prometheus scrape job has no `params` or `authorization` configuration for the token.
- **Why it blocks production:** No metrics are scraped in production; Grafana/alerting is blind.
- **Suggested fix:** Generate `METRICS_TOKEN` in Ansible `secrets.yml`, render it into `prometheus.yml` (e.g. `params: { token: ['{{ metrics_token }}'] }`), or use `authorization.credentials_file`. Add a validation pre-task.

### P0-10. Deploy script has no post-deploy smoke tests
- **Domain:** Deployment
- **Affected files:** `infrastructure/ansible/files/deploy.sh:41-53`
- **Gap:** The deploy script rolls back on migration failure but performs no smoke test after `docker compose up -d`.
- **Why it blocks production:** A migration can succeed while the app fails to start or health checks fail; the deploy script reports success.
- **Suggested fix:** Add a smoke-test loop after `up -d` that calls `/api/health/ready`, `/api/health/live`, and a static asset/headless route until they return 200, with a timeout and rollback on failure.

### P0-11. Ansible vault password file present in working tree
- **Domain:** Operations / Secrets
- **Affected files:** `infrastructure/ansible/.vault_pass`
- **Gap:** A 45-byte base64-like secret exists in the working tree (gitignored but on disk). If this is the real vault password, anyone with host access can decrypt `secrets.yml`.
- **Why it blocks production:** Compromises all production credentials.
- **Suggested fix:** Verify whether this is the real password. If yes, rotate it immediately and store it in a password manager/hardware token, then regenerate `secrets.yml`. If it is a placeholder, replace it with a clear marker and document that it must be created locally.

### P0-12. `imgproxy` has no health check in production compose
- **Domain:** Operations / Reliability
- **Affected files:** `docker-compose.prod.yml:95-114`
- **Gap:** `imgproxy` service has no `healthcheck`, and Caddy does not `depends_on` it.
- **Why it blocks production:** If imgproxy crashes, image requests return 502/503 with no automatic recovery.
- **Suggested fix:** Add a `healthcheck` to imgproxy (e.g. `GET /health` on port 8080) and add `depends_on: imgproxy: condition: service_healthy` to Caddy.

### P0-13. `meilisearch_sync_queue` has no foreign key to `product`
- **Domain:** Database / Data Integrity
- **Affected files:** `src/db/schema.ts:1016-1036`; `drizzle/0036_amazing_scorpion.sql`
- **Gap:** `meilisearchSyncQueue.productId` is `text().notNull()` with no `references(() => product.id)` constraint.
- **Why it blocks production:** Products can be deleted while orphaned sync-queue rows remain; the worker attempts to index/delete non-existent products and the queue accumulates dead rows.
- **Suggested fix:** Add `references(() => product.id, { onDelete: 'cascade' })` and regenerate migrations.

### P0-14. Cancelling a `pending_payment` order does not void the Mollie payment
- **Domain:** Orders / Payments
- **Affected files:** `src/lib/shop-orders.server.ts:1166-1246`; `src/routes/api/webhooks/mollie.ts:154-160`
- **Gap:** An owner can cancel while `pending_payment`. If the buyer completes payment seconds later, the webhook sees `cancelled` and returns `already_processed`, leaving captured funds with no order to fulfill.
- **Why it blocks production:** Buyers can pay for cancelled orders; the platform holds money without an order.
- **Suggested fix:** Expire/cancel the Mollie payment when cancelling, or immediately refund if it has already been paid.

### P0-15. VIES validation falls open
- **Domain:** Tax / VAT
- **Affected files:** `src/lib/vat.server.ts:183-208`
- **Gap:** `verifyVatIdVies` returns `true` on any network/timeout/HTTP error. When `ENABLE_VIES_VALIDATION=true`, invalid or fake VAT IDs can be accepted during API downtime.
- **Why it blocks production:** Incorrect B2B reverse-charge decisions can lead to tax liability.
- **Suggested fix:** Fail closed (reject) or queue for async retry; at minimum emit a high-priority alert.

### P0-16. Greek VAT-ID / country-code mismatch breaks cross-border B2B
- **Domain:** Tax / VAT
- **Affected files:** `src/lib/address-validation.ts:19`; `src/lib/checkout.ts:58-68`; `src/lib/vat.server.ts:144-145`; `src/lib/vat.ts:10,14`
- **Gap:** Greek VAT IDs use the `EL` prefix, but the supported country list only contains `GR`. The checkout schema rejects an `EL`-prefixed VAT ID when the buyer selects Greece (`GR`).
- **Why it blocks production:** Cross-border B2B reverse charge for Greece is broken.
- **Suggested fix:** Normalize Greek country code / VAT prefix handling (accept `EL` prefix with `GR` country).

### P0-17. Mollie delayed-routing mock mode is not production-guarded
- **Domain:** Payments / Payouts
- **Affected files:** `src/integrations/mollie/mollie-routes-client.ts:312-325`
- **Gap:** `isMockMode()` returns `true` whenever `MOCK_PAYOUTS_ENABLED=true`, regardless of `NODE_ENV`.
- **Why it blocks production:** A misconfigured production env creates fake routes and never moves real money.
- **Suggested fix:** Only allow mock mode in non-production, or require an explicit non-standard env var in production.

### P0-18. Hardcoded Euro symbols and English VAT labels
- **Domain:** Frontend / i18n / Tax
- **Affected files:** `src/components/product/ProductNewFormFields.tsx:167`; `src/components/product/ProductEditFormFields.tsx:167`; `src/components/sell/Step7Listing.tsx:226`; `src/components/CheckoutPage.tsx:640-662,856,866,881`; `src/components/ProductDetail.tsx:166`; `src/components/ProductCard.tsx:67`; `src/components/CartPage.tsx:124`; `src/components/search/SearchEmptyState.tsx:24`; `src/components/shop/ShopSettingsVatSettings.tsx:23-60`; `src/components/shop/ShopSettingsShippingOrigin.tsx:26-91`; plus many more listed in the P1 i18n section
- **Gap:** Euro symbols (`€`) and English VAT/tax/shipping labels are hardcoded throughout the UI.
- **Why it blocks production:** Violates the project’s Euro-first/i18n-ready mandate and the North Star item to replace hardcoded Euro symbol / English VAT labels. Launching across the EU with hardcoded English tax copy is a compliance and UX risk.
- **Suggested fix:** Use `formatPriceEUR` for display, remove literal `€`, and extract every VAT/tax/shipping label into `messages/en.json` + `messages/nl.json`; run `bun run i18n:compile`.

### P0-19. Debug / data-leak logging in production runtime paths
- **Domain:** Security / Observability
- **Affected files:** `src/components/Header.tsx:31`; `src/route-components/invoices.$invoiceId.tsx:16`; `src/route-components/__root.tsx:61-62,65-66,75-76`; `src/routes/__root.tsx:22`; `src/routes/index.tsx:18`; `src/route-components/root/RootError.tsx:8`; `src/integrations/faro.ts:41,49,76`; `src/lib/auth-utils.ts:22`
- **Gap:** Multiple `console.log`/`console.error` calls run in production paths, including one that dumps full invoice JSON (likely containing PII).
- **Why it blocks production:** PII and internal error details leak to logs and browser dev tools; violates logging standards.
- **Suggested fix:** Remove or gate all dev-only logs behind `import.meta.env.DEV`. Replace runtime diagnostics with structured logging / Faro.

### P0-20. `InvoiceDetailComponent` uses `any`
- **Domain:** Frontend / Type Safety / Compliance
- **Affected files:** `src/route-components/invoices.$invoiceId.tsx:17`
- **Gap:** `const details = invoice.billingDetails as any` bypasses type safety on a compliance-critical page.
- **Why it blocks production:** Type safety is explicitly required by project rules; billing detail mutations risk silent runtime errors.
- **Suggested fix:** Add a typed `InvoiceBillingDetails` schema and validate the loader output.

### P0-21. `authPipeline` API routes do not enforce 2FA for privileged actions
- **Domain:** Security / Authorization
- **Affected files:** `src/routes/api/admin/payouts.$payoutId.ts:8-25`; `src/routes/api/shops/$shopId/settings.ts:11-79`; `src/routes/api/shops/$shopId/dashboard.ts:9-20`; `src/routes/api/shops/$shopId/orders.ts:16-32`; `src/routes/api/shops/$shopId/orders.$shopOrderId.ts:14-183`; `src/routes/api/shops/$shopId/products.ts:17-117`; `src/routes/api/shops/$shopId/products.$productId.ts:10-176`
- **Gap:** `authPipeline` only runs `requireAuth` + role/ownership gates; it has no 2FA gate. These routes call `.server.ts` internals directly, bypassing `requirePrivileged2FA`.
- **Why it blocks production:** A compromised creator/admin password can execute privileged mutations and reads without 2FA.
- **Suggested fix:** Add a `requirePrivileged2FA`-style gate to `authPipeline` (or a dedicated pipeline variant) and apply it to all creator/admin API routes.

### P0-22. Mollie refund is executed before the DB transaction commits
- **Domain:** Payments / Data Integrity
- **Affected files:** `src/lib/shop-orders.server.ts:1043-1059` (refund before tx at `:1061`); `src/lib/disputes.server.ts:727-769` (refund before tx at `:774`)
- **Gap:** Money is sent irreversibly before local records are updated. If the DB transaction fails, the platform has refunded the buyer but the order/payout/dispute state is unchanged.
- **Why it blocks production:** Financial records and actual money movement become inconsistent.
- **Suggested fix:** Restructure so the DB transaction records the intent/lock first, then perform the Mollie call, then finalize state. Use compensating logic/alerting if the Mollie call fails after DB commit.

### P0-23. Chargeback handling is incomplete
- **Domain:** Payments / Disputes
- **Affected files:** `src/routes/api/webhooks/mollie.ts:162-200`
- **Gap:** A Mollie chargeback only updates order status to `chargeback`. It does not reverse payouts, restore stock, create credit notes, or notify sellers.
- **Why it blocks production:** Chargebacks are forced refunds; without reversal the seller keeps money and the order stays fulfilled.
- **Suggested fix:** Implement a chargeback workflow that reverses any sent/in-transit payout, restores stock, issues a credit note, and alerts ops/seller.

---

## P1 — Should Fix Before Launch

### P1-1. Dispute resolution does not create credit notes
- **Domain:** Invoicing / Disputes
- **Affected files:** `src/lib/disputes.server.ts:727-862`
- **Gap:** Refund path updates order/dispute status and issues a Mollie refund but never calls `createCreditNoteForShopOrder`.
- **Why it is a risk:** Customer invoice remains outstanding with no matching credit note.
- **Suggested fix:** Call `createCreditNoteForShopOrder` inside the dispute transaction when a refund is issued.

### P1-2. Owner refund excludes shipping cost
- **Domain:** Orders / Refunds
- **Affected files:** `src/lib/shop-orders.server.ts:1004`
- **Gap:** `refundCents = orderRecord.subtotalCents - orderRecord.refundedCents`; full owner refund does not return shipping costs.
- **Why it is a risk:** Buyers do not receive the full amount they paid.
- **Suggested fix:** Refund `subtotalCents + shippingCostCents` for full refunds, capped at shop-order total.

### P1-3. DAC7 tax identity is not editable after onboarding
- **Domain:** Tax / Compliance
- **Affected files:** `src/lib/shop-settings.ts:35-87`; `src/lib/shop-settings.server.ts:131-242`; `src/lib/sell-onboarding.ts:143-153`
- **Gap:** `taxId`, `legalEntityType`, `dateOfBirth`, and `businessRegistrationNumber` are collected in onboarding but cannot be updated in shop settings.
- **Why it is a risk:** Sellers cannot correct tax identity errors; compliance data becomes stale.
- **Suggested fix:** Add DAC7 fields to `updateShopSchema`/`updateShopInternal` and the shop settings UI.

### P1-4. Tax env vars are undocumented and read directly from `process.env`
- **Domain:** Tax / Configuration
- **Affected files:** `src/lib/checkout.server.ts:344` (`ENABLE_VIES_VALIDATION`); `src/lib/invoices.server.ts:199` (`PLATFORM_VAT_LIABLE`); `.env.example`
- **Gap:** Variables are not in `.env.example` and are not validated/typed through a central env module.
- **Why it is a risk:** Easy to miss in production; behavior depends on undocumented env vars.
- **Suggested fix:** Add them to `.env.example`, document behavior, and route through `env.server.ts` with defaults.

### P1-5. `Promise.all` inside invoice transaction + hardcoded EUR
- **Domain:** Invoicing / Database
- **Affected files:** `src/lib/invoices.server.ts:360-506`; `:479`
- **Gap:** The project rule explicitly bans concurrency inside invoice transactions because `allocateNextInvoiceNumber` uses a sequence table. Platform-fee line description hardcodes “EUR”.
- **Why it is a risk:** Race conditions on invoice number allocation; hardcoded currency string.
- **Suggested fix:** Serialize per-shop-order inserts and replace the hardcoded currency string.

### P1-6. Sendcloud label total order value is hardcoded to `0.00`
- **Domain:** Shipping
- **Affected files:** `src/integrations/shipping/sendcloud-provider.ts:407-409`
- **Gap:** `total_order_value` is hardcoded to `0.00`.
- **Why it is a risk:** Customs/insurance/coverage calculations receive incorrect values.
- **Suggested fix:** Pass the real shop-order total.

### P1-7. Payout reconciliation over-reverses and swallows refund-list errors
- **Domain:** Payouts
- **Affected files:** `src/lib/payout-reconciliation.server.ts:99-102`, `:104-106`, `:139-148`
- **Gap:** Any refund on the parent payment reverses the entire payout, even if partial or unrelated. List-refund errors are silently ignored (`catch(() => ({ refunds: [] }))`).
- **Why it is a risk:** Sellers can have legitimate payouts incorrectly reversed; API errors hide real problems.
- **Suggested fix:** Match refund amount against payout amount and alert/fail on API errors instead of swallowing.

### P1-8. Sensitive credentials stored as plaintext `text`
- **Domain:** Security / Database
- **Affected files:** `src/db/schema.ts` (`account.accessToken`, `account.refreshToken`, `account.idToken`, `account.password`, `two_factor.secret`, `two_factor.backupCodes`, `shop.mollieAccessToken`, `shop.mollieRefreshToken`)
- **Gap:** OAuth tokens, TOTP secrets, backup codes, and Mollie Connect tokens are stored without application-level encryption.
- **Why it is a risk:** Database dump or compromised backup exposes high-value secrets directly.
- **Suggested fix:** Encrypt these columns at the application layer before insert and decrypt on read. Document encryption key management in environment variables.

### P1-9. `payout.shopOrderId` is nullable
- **Domain:** Database / Payouts
- **Affected files:** `src/db/schema.ts:600-630`; `src/lib/payouts.server.ts:165`
- **Gap:** `shopOrderId` is nullable despite unique index and business logic that expects one payout per shop order.
- **Why it is a risk:** Multiple nulls bypass the unique index; manual payouts may not relate to orders.
- **Suggested fix:** Make `shopOrderId NOT NULL` and update seed/test factories. If manual/adjustment payouts are valid, add a `payout.type` discriminator.

### P1-10. `inventory_reservation` unique indexes on nullable columns allow duplicates
- **Domain:** Database / Inventory
- **Affected files:** `src/db/schema.ts:535-559`
- **Gap:** Unique indexes on `(productId, platformOrderId)` and `(productId, cartId)`, but both columns are nullable. PostgreSQL `NULL != NULL` allows duplicates.
- **Why it is a risk:** Duplicate cart or orphan reservations can over-reserve stock or leak reservations.
- **Suggested fix:** Add partial unique indexes that exclude nulls, or model cart vs order reservations separately, or add a `CHECK` ensuring exactly one of `platformOrderId`/`cartId` is set.

### P1-11. `productVariant.stockCount` has no non-negative check
- **Domain:** Database / Inventory
- **Affected files:** `src/db/schema.ts:317-336`
- **Gap:** `product.stockCount` has `CHECK >= 0`, but `productVariant.stockCount` does not.
- **Why it is a risk:** Negative variant stock corrupts inventory calculations.
- **Suggested fix:** Add `check('product_variant_stock_count_non_negative', sql\`${table.stockCount} >= 0\`)`.

### P1-12. `cartItem.quantity` and `orderItem.quantity` have no positive check
- **Domain:** Database / Orders
- **Affected files:** `src/db/schema.ts:403-421`, `:504-533`
- **Gap:** Both are `integer().notNull()` with no `CHECK > 0`.
- **Why it is a risk:** Zero or negative quantities break totals, VAT, and invoice calculations.
- **Suggested fix:** Add `CHECK (quantity > 0)` to both tables.

### P1-13. Financial totals lack cross-row consistency enforcement
- **Domain:** Database / Financial Integrity
- **Affected files:** `platform_order.totalCents`, `shop_order.subtotalCents`, `order_item.totalCents`, `shop_order.vatAmountCents`, `shop_order.shippingVatAmountCents`
- **Gap:** No triggers or checks ensure:
  - `platform_order.totalCents` equals the sum of its `shop_order` totals,
  - `shop_order.subtotalCents` equals the sum of its `order_item.totalCents`,
  - `order_item.totalCents` equals `unitPriceCents * quantity`,
  - VAT amounts are consistent with basis points.
- **Why it is a risk:** Bugs or race conditions create invoices, payouts, and reports based on inconsistent data.
- **Suggested fix:** Add database-level triggers or idempotent re-computation functions at checkout/payment time. Add tests asserting totals under concurrent reservation/checkout.

### P1-14. Refund/dispute amounts lack upper-bound checks
- **Domain:** Database / Refunds
- **Affected files:** `platform_order.refundedCents`, `shop_order.refundedCents`, `dispute.refundCents`
- **Gap:** No `CHECK` ensures `refundedCents <= totalCents` / `subtotalCents`; `dispute.refundCents` is not bounded by shop order total.
- **Why it is a risk:** A bug or malicious input could refund more than was paid.
- **Suggested fix:** Add `CHECK` constraints. For disputes, consider linking `refundCents` to a refund transaction record.

### P1-15. `session.tokenHash` is nullable
- **Domain:** Security / Database
- **Affected files:** `src/db/schema.ts:59-79`; migration `0054_black_arclight.sql`
- **Gap:** After migration 0054, sessions should be hashed, but `tokenHash` is still nullable.
- **Why it is a risk:** A session inserted without a hash could bypass the security improvement.
- **Suggested fix:** Make `tokenHash NOT NULL` after ensuring the migration backfills all existing rows. Consider removing the old `token` column.

### P1-16. `sendcloud_webhook_event` has no retention policy or cleanup
- **Domain:** GDPR / Operations
- **Affected files:** `src/db/schema.ts:793-811`; `docs/DATA_RETENTION.md`
- **Gap:** `DATA_RETENTION.md` covers Brevo webhook events (30 days) but not Sendcloud webhook events. No cleanup job exists. Payloads can contain PII.
- **Why it is a risk:** Indefinite retention of shipping-related PII violates GDPR storage limitation.
- **Suggested fix:** Add a retention row to `DATA_RETENTION.md` and a cleanup job for `sendcloud_webhook_event` (e.g., 30–90 days).

### P1-17. Backup off-site upload is documented but not implemented
- **Domain:** Operations / Backups
- **Affected files:** `infrastructure/ansible/roles/eurtisan/templates/backup.sh.j2:7`; `infrastructure/README.md:136-145`; `docs/DEPLOYMENT.md:303`
- **Gap:** `OFFSITE_REMOTE` is declared but never used in the backup script.
- **Why it is a risk:** Single-VPS disk failure or compromise loses all backups.
- **Suggested fix:** Add an `rclone copyto` step after verification when `OFFSITE_REMOTE` is set, with error alerting. Include `rclone` installation in Ansible.

### P1-18. Backup retention is inconsistent across docs
- **Domain:** Operations / Backups
- **Affected files:** `infrastructure/ansible/roles/eurtisan/templates/backup.sh.j2:127`; `docs/runbooks/backup-restore.md:8`; `docs/DEPLOYMENT.md:245`; `docs/DATA_RETENTION.md:16`; `infrastructure/README.md:131`
- **Gap:** Values range from 7 to 30 days depending on the document.
- **Why it is a risk:** Operators cannot trust retention policies; risk of premature loss or unexpected disk fill.
- **Suggested fix:** Align on one value (recommend 30 days local + off-site), make it a single Ansible variable (`backup_retention_days`), and update all docs.

### P1-19. WAL archiving is documented but not implemented
- **Domain:** Operations / Backups
- **Affected files:** `infrastructure/ansible/group_vars/all.yml:39-40`; `docs/DEPLOYMENT.md:301-313`
- **Gap:** `postgres_wal_archive_enabled: false` and no Ansible task configures `archive_mode`, `wal_level`, or `archive_command`.
- **Why it is a risk:** RPO target of “< 1 hour” is impossible without WAL archiving.
- **Suggested fix:** Add an Ansible task that generates a PostgreSQL config override when WAL archiving is enabled and test PITR restore quarterly.

### P1-20. Prometheus alert rules only cover email
- **Domain:** Observability
- **Affected files:** `infra/observability/prometheus/rules/email-alerts.yml`
- **Gap:** No alerts for app health, disk, DB connectivity, Meilisearch, job failures, payment webhooks, or checkout errors.
- **Why it is a risk:** Operators will not be paged for the most common production incidents.
- **Suggested fix:** Add rule files for health endpoint 503, disk unhealthy, DB connection errors, Meilisearch sync failures, job errors, checkout failures, and webhook provider errors.

### P1-21. Alertmanager defaults drop alerts
- **Domain:** Observability
- **Affected files:** `infra/observability/alertmanager/alertmanager.yml:12-14,31,36`
- **Gap:** Defaults to `localhost:25`, `smtp_from: alerts@example.com`, and empty `smtp_to`/`webhook_url`.
- **Why it is a risk:** Critical alerts are silently dropped.
- **Suggested fix:** Add Ansible validation that at least one receiver is configured, document required variables, and provide a default webhook/Slack/PagerDuty template.

### P1-22. Grafana defaults to weak admin password
- **Domain:** Security / Observability
- **Affected files:** `infra/observability/docker-compose.observability.yml:26`
- **Gap:** `GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-changeme}` falls back to a hardcoded weak default.
- **Why it is a risk:** Grafana is exposed publicly; a missing secret leaves it open with `admin/changeme`.
- **Suggested fix:** Remove the default and make the playbook fail if `grafana_admin_password` is undefined.

### P1-23. Background jobs have no leader election / locking
- **Domain:** Operations / Reliability
- **Affected files:** `docker-compose.prod.yml`, `docker-compose.staging.yml` job services
- **Gap:** All jobs run as separate containers with no advisory-lock or `FOR UPDATE SKIP LOCKED` mechanism.
- **Why it is a risk:** Scaling or accidental duplicate containers causes duplicate payouts, double emails, or race conditions.
- **Suggested fix:** Add lightweight advisory-lock mechanisms in each job, or document/enforce that only one replica of each job may run.

### P1-24. Jobs use `restart: unless-stopped` with no restart delay/backoff
- **Domain:** Operations / Reliability
- **Affected files:** `docker-compose.prod.yml`, `docker-compose.staging.yml` job services
- **Gap:** Transient DB connection errors cause immediate crash/restart loops.
- **Why it is a risk:** Hammers the database and generates log noise.
- **Suggested fix:** Add `deploy.restart_policy.delay` / `max_attempts` or wrap job entrypoints with a small back-off loop.

### P1-25. CI does not run TypeScript check, build, or E2E
- **Domain:** Testing / CI
- **Affected files:** `.github/workflows/ci.yml:29-33`
- **Gap:** CI runs `bun run lint` and `bun run test` but not `make check` (TypeScript), `bun run build`, or E2E.
- **Why it is a risk:** Type errors and broken production builds can reach `main`.
- **Suggested fix:** Add a `check` step, a `build` step, and a matrix E2E job or nightly E2E run.

### P1-26. CI uses non-deterministic Bun version
- **Domain:** Testing / CI
- **Affected files:** `.github/workflows/ci.yml:24`
- **Gap:** `bun-version: latest`.
- **Why it is a risk:** Future Bun releases can break CI/builds without code changes.
- **Suggested fix:** Pin a specific Bun version and update intentionally.

### P1-27. E2E coverage is narrow
- **Domain:** Testing
- **Affected files:** `e2e/` directory (5 spec files, 17 total `test` blocks)
- **Gap:** No E2E coverage of checkout, payment webhook, buyer order flow, seller fulfillment, dispute, or account deletion.
- **Why it is a risk:** The most revenue-critical and compliance-sensitive paths are untested in a real browser.
- **Suggested fix:** Add E2E specs for guest checkout, Mollie webhook success/failure, seller ship/deliver flow, buyer invoice download, and account deletion.

### P1-28. `.env.example` is missing many runtime/ops variables
- **Domain:** Configuration
- **Affected files:** `.env.example`
- **Gap:** Missing: `ALERTMANAGER_SMTP_HOST/PORT/FROM/TO`, `ALERTMANAGER_WEBHOOK_URL`, `GRAFANA_ADMIN_PASSWORD`, `BACKUP_OFFSITE_RCLONE_REMOTE`, `BACKUP_RETENTION_DAYS`, `MEILISEARCH_SYNC_INTERVAL_MS/BATCH_SIZE`, cleanup intervals for inventory/session/cart/audit-log/verification/email, `RATE_LIMIT_RETENTION_DAYS`.
- **Why it is a risk:** Operators will miss required/tunable variables; defaults are hidden in code.
- **Suggested fix:** Add a complete, commented `.env.production.example` and keep `.env.example` in sync.

### P1-29. CODEOWNERS references placeholder owner
- **Domain:** Security / Repository Governance
- **Affected files:** `.github/CODEOWNERS`; `docs/BRANCH_PROTECTION.md`
- **Gap:** CODEOWNERS references `@kaiser` (placeholder); branch protection is described only in docs, not enforced as code.
- **Why it is a risk:** A single compromised/mistaken push can modify infrastructure, auth, or payment code without review.
- **Suggested fix:** Replace `@kaiser` with the real org/team, add a repository ruleset export, and verify required status checks and CODEOWNERS review are enabled.

### P1-30. Health endpoint calls external APIs on every check
- **Domain:** Operations / Reliability
- **Affected files:** `src/routes/api/health.ts:37-79,116-124`
- **Gap:** `/api/health/ready` calls external Mollie and Brevo APIs when keys are set.
- **Why it is a risk:** Provider slowness/rate-limiting makes the app appear unhealthy and causes unnecessary restarts.
- **Suggested fix:** Move Mollie/Brevo checks to a separate `/api/health/deps` endpoint or expose as metrics only; keep `/api/health/ready` limited to DB, Meilisearch, and disk.

### P1-31. Alloy Faro CORS origins are hardcoded
- **Domain:** Observability
- **Affected files:** `infra/observability/alloy/config.alloy:34`
- **Gap:** `cors_allowed_origins` hardcoded to `https://eurtisan.eu` and `https://staging.eurtisan.eu`.
- **Why it is a risk:** RUM beacons from `www.eurtisan.eu`, custom domains, or future locales are rejected.
- **Suggested fix:** Make origins configurable via environment variable and render them in Ansible.

### P1-32. Meilisearch and S3 object storage are not backed up
- **Domain:** Operations / Backups
- **Affected files:** `docs/DEPLOYMENT.md:303-313`; `docs/DATA_RETENTION.md:16`
- **Gap:** Docs mention S3/Meilisearch backups as a gap but provide no implementation.
- **Why it is a risk:** Index corruption or object-store failure requires full re-index/re-upload.
- **Suggested fix:** Add nightly Meilisearch dumps and S3 bucket sync to the backup script or a separate backup job.

### P1-33. Logger serializes arbitrary `meta` without PII redaction
- **Domain:** Security / Observability
- **Affected files:** `src/lib/logger.server.ts:16-35`
- **Gap:** Arbitrary `meta` is serialized directly to JSON without redaction.
- **Why it is a risk:** Debug/error logs in auth, checkout, or webhooks could write emails, addresses, tokens, or payment IDs to Loki.
- **Suggested fix:** Add a redaction pass that masks known PII keys (email, password, token, authorization, card, address fields) before serialization.

### P1-34. Some privileged server-function reads skip 2FA
- **Domain:** Security / Authorization
- **Affected files:** `src/lib/shop-orders.ts:19-55` (`getShopOrder`); `src/lib/disputes.ts:111-131` (`getDisputeDetail`)
- **Gap:** Admin-level reads are reachable without calling `requirePrivileged2FA`.
- **Why it is a risk:** Privileged data disclosure if credentials are compromised.
- **Suggested fix:** Add `requirePrivileged2FA` after confirming the caller is admin/creator in these handlers.

### P1-35. `verifyShopOwnership` does not check `bannedAt`
- **Domain:** Security / Authorization
- **Affected files:** `src/lib/server-auth.ts:77-102`
- **Gap:** Checks `deletedAt` but not `bannedAt`.
- **Why it is a risk:** Future refactor or middleware bug could let a banned admin/creator pass ownership checks.
- **Suggested fix:** Add a `bannedAt` check in `verifyShopOwnership`, matching other auth helpers.

### P1-36. `productVariant.sku` unique index allows multiple NULLs
- **Domain:** Database / Inventory
- **Affected files:** `src/db/schema.ts:317-336`
- **Gap:** `sku` is nullable with a unique index; multiple variants can have no SKU.
- **Why it is a risk:** If SKUs are intended to be business-unique identifiers, nulls defeat the constraint.
- **Suggested fix:** Decide whether SKU is required. If optional but unique when present, add a partial unique index `WHERE sku IS NOT NULL`.

### P1-37. `productOptionValue.value` has no unique constraint per option
- **Domain:** Database / Products
- **Affected files:** `src/db/schema.ts:353-366`
- **Gap:** No `UNIQUE(optionId, value)`.
- **Why it is a risk:** Duplicate option values break variant selection logic.
- **Suggested fix:** Add `uniqueIndex('product_option_value_option_value_unique').on(table.optionId, table.value)`.

### P1-38. `productVariant.name` has no unique constraint per product
- **Domain:** Database / Products
- **Affected files:** `src/db/schema.ts:317-336`
- **Gap:** No `UNIQUE(productId, name)`.
- **Why it is a risk:** UI and inventory logic may assume variant names are unique within a product.
- **Suggested fix:** Add a unique index on `(productId, name)` if business rules require it.

### P1-39. `account.accountId` + `providerId` lacks unique constraint
- **Domain:** Database / Auth
- **Affected files:** `src/db/schema.ts:95-115`
- **Gap:** Better Auth typically relies on `(providerId, accountId)` being unique per user.
- **Why it is a risk:** Duplicate provider accounts for the same user can break sign-in/linking.
- **Suggested fix:** Add `uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId, table.userId)`.

### P1-40. i18n gaps in checkout and seller flows
- **Domain:** Frontend / i18n
- **Affected files:** `src/components/CheckoutPage.tsx:249,257,699-700,785,805,812,815,819,945`; `src/components/checkout/PickupPointSelectorModal.tsx:65,80,83,122,147,159,166,172,179`; `src/components/search/SearchOverlay.tsx:226,232,239`; `src/components/search/SearchEmptyState.tsx:8-29,79`; `src/route-components/studio/$shopId.orders.tsx:110,116,138,140,147,162-174,181-185,224`; `src/route-components/studio/$shopId.orders.$shopOrderId.tsx:186,191,195,237,240,247,251,256,265,277,327,329,353`; `src/components/BuyerOrderDetailPage.tsx:283,297,362,464`; `src/components/sell/Step1Identity.tsx:18-24,107-114,165,198,236`; plus other onboarding steps
- **Gap:** Large amounts of user-facing English text are hardcoded.
- **Why it is a risk:** Blocks EU-market UX and future locale expansion; violates project i18n policy.
- **Suggested fix:** Extract all user-facing strings into Paraglide message files and compile.

### P1-41. Accessibility gaps in dialogs, drawer, and checkout
- **Domain:** Frontend / Accessibility
- **Affected files:** `src/components/AnalyticsConsentBanner.tsx`; `src/components/MobileNavDrawer.tsx`; `src/components/admin/AdminLayout.tsx`; `src/components/ProductDetail.tsx`; `src/route-components/studio/$shopId.orders.$shopOrderId.tsx`; `src/components/shop/ShopCustomerDetailPage.tsx`; `src/components/Header.tsx`; `src/components/CheckoutPage.tsx`
- **Gap:** Consent banner lacks focus trap; mobile drawer focus may leave bounds; admin sidebar has focusable elements when `aria-hidden`; quantity buttons lack explicit focus rings; refund/cancel use `window.confirm`; checkout country is a free-text input instead of a `<select>`.
- **Why it is a risk:** Violates project accessibility requirements; hurts keyboard/screen-reader users.
- **Suggested fix:** Use the accessible `Dialog` primitive consistently, add focus traps, manage `aria-hidden` focusability, replace `window.confirm` with accessible modals, and use a country `<select>`.

### P1-42. Theme/styling regressions
- **Domain:** Frontend / UI
- **Affected files:** `src/components/auth/PasswordStrengthIndicator.tsx:74-75`; `src/components/ProductGrid.tsx:31-35,46,69,76,84`; `src/routes/index.tsx:29`; `src/components/ThemeToggle.tsx:5-7`; `src/route-components/account/settings.tsx:165`; `src/route-components/mollie-mock-oauth.tsx:30-125`; `src/components/HomePage.tsx:59-80`; `src/components/ProductDetail.tsx` (legacy tokens); `src/components/routes/ForbiddenPage.tsx:15`
- **Gap:** Uses undefined theme tokens (`bg-info`, `text-info`, `bg-primary`), invalid Tailwind classes (`size-5/3`, `size-6/3`), legacy CSS variables, raw colors, inline `<style>` tags, and a theme toggle that returns `'light'` on the server.
- **Why it is a risk:** UI breaks visually, hydration/class mismatches, and inconsistent premium feel.
- **Suggested fix:** Audit all components against `src/styles.css` theme tokens, remove invalid classes, move animations to CSS, and fix `ThemeToggle` server snapshot.

### P1-43. Route / flow completeness gaps
- **Domain:** Frontend / UX
- **Affected files:** `src/routes/shops/$shopSlug.tsx`; `src/routes/studio/index.tsx`; `src/route-components/account/orders.$orderId.tsx`; `src/components/OrderDetailPage.tsx`
- **Gap:** Shop route has no layout shell; studio index is a placeholder; account order detail uses the older `OrderDetailPage` missing invoice/review/dispute CTAs; `OrderDetailPage` shows raw `order.status`.
- **Why it is a risk:** Incomplete or inconsistent UX for core flows.
- **Suggested fix:** Add shop layout, redirect studio index to dashboard, use `BuyerOrderDetailPage` for account orders, and localize status labels.

### P1-44. Status label localization
- **Domain:** Frontend / i18n
- **Affected files:** `src/lib/orders-ui.ts:81-94`; `src/route-components/studio/$shopId.orders.tsx:9-20`; `src/route-components/studio/$shopId.orders.$shopOrderId.tsx:195`; `src/components/BuyerOrderDetailPage.tsx:234,311`; `src/components/OrderDetailPage.tsx:40,64`
- **Gap:** Order status labels are hardcoded English or displayed raw.
- **Why it is a risk:** Non-English users see internal status strings.
- **Suggested fix:** Localize status labels and use a mapping instead of `status.replace('_', ' ')`.

### P1-45. Checkout fragility
- **Domain:** Frontend / Checkout
- **Affected files:** `src/components/CheckoutPage.tsx:245`; `:103-107`
- **Gap:** Detects unsupported shipping by `label.includes('cannot ship')`; `formatEstimatedDays` hardcodes “business day(s)”.
- **Why it is a risk:** English-dependent and brittle; breaks localization.
- **Suggested fix:** Use structured error codes from the server and localize all display strings.

### P1-46. Mollie Connect token refresh / disconnect not implemented
- **Domain:** Payments / Payouts
- **Affected files:** `src/routes/api/auth/mollie/callback.ts:138-140`
- **Gap:** Tokens are stored but never refreshed; disconnect likely does not revoke the Mollie-side grant.
- **Why it is a risk:** Expired tokens break payouts; disconnected sellers may still have active grants.
- **Suggested fix:** Implement token refresh and a disconnect flow that revokes the grant.

### P1-47. `exportUserData` is incomplete for GDPR portability
- **Domain:** GDPR / Compliance
- **Affected files:** `src/lib/account-data.server.ts:29-77`
- **Gap:** Export does not include invoices, owner messages, dispute messages, audit logs, or email preferences.
- **Why it is a risk:** GDPR Article 20 gives users the right to receive all personal data concerning them.
- **Suggested fix:** Expand the export to include all personal data, or clearly document exclusions and why.

### P1-48. `studio/index` uses weaker role guard
- **Domain:** Security / Authorization
- **Affected files:** `src/routes/studio/index.tsx:6`
- **Gap:** Uses `guardRole('creator')` instead of `guardPrivilegedRole('creator')`.
- **Why it is a risk:** Inconsistent with parent layout; could become a bypass if layout ordering changes.
- **Suggested fix:** Replace with `guardPrivilegedRole('creator')`.

### P1-49. Job services have redundant `build:` blocks
- **Domain:** Operations / Deployment
- **Affected files:** `docker-compose.prod.yml` job services
- **Gap:** Each job service includes a `build:` block referencing `Dockerfile.prod` even though `image: eurtisan-app:${IMAGE_TAG}` is specified.
- **Why it is a risk:** Builds may be re-triggered on every host, slowing deploys and creating image inconsistency.
- **Suggested fix:** Remove `build:` from job services; rely on the pre-built app image.

---

## P2 — Polish / Post-Launch

### P2-1. DAC7 threshold ignores refunds
- **Domain:** Tax / Compliance
- **Affected files:** `src/lib/dac7.server.ts:20-36`
- **Gap:** Gross sales sum `subtotal + shipping` for completed/delivered orders without subtracting `refundedCents`.
- **Why it is a risk:** Over-reports seller gross revenue for DAC7.
- **Suggested fix:** Subtract `refundedCents` from gross sales.

### P2-2. Non-DB work inside DB transactions
- **Domain:** Backend / Performance
- **Affected files:** `src/lib/shop-orders.server.ts:730-756` (DAC7 notification); `src/lib/checkout.server.ts:837-848` (service-point validation)
- **Gap:** External API calls and notifications extend lock hold time.
- **Why it is a risk:** Longer locks reduce throughput and increase deadlock risk.
- **Suggested fix:** Move external calls outside the transaction where possible.

### P2-3. Manual-review “paid” resolution can oversell
- **Domain:** Orders / Inventory
- **Affected files:** `src/lib/shop-orders.server.ts:1382-1383`
- **Gap:** Calls `decrementStockForPaidOrder`, which clamps to zero. Stock is not re-checked before resolving to paid.
- **Why it is a risk:** Resolving a manual-review order to paid can oversell an item.
- **Suggested fix:** Re-check stock availability and reject if still insufficient.

### P2-4. `createCreditNoteForShopOrder` uses weak typing
- **Domain:** Backend / Type Safety
- **Affected files:** `src/lib/invoices.server.ts:516-518`
- **Gap:** `tx?: any`.
- **Suggested fix:** Replace `any` with the Drizzle transaction type.

### P2-5. VIES timeout hardcoded to 2 seconds
- **Domain:** Tax / VAT
- **Affected files:** `src/lib/vat.server.ts:192`
- **Gap:** 2-second timeout may be too aggressive.
- **Suggested fix:** Make configurable with alerting.

### P2-6. Missing tests for critical money paths
- **Domain:** Testing
- **Affected files:** `src/lib/shop-orders.server.ts`; `src/lib/disputes.server.ts`; `src/lib/payout-reconciliation.server.ts`
- **Gap:** No targeted tests for refund, dispute refund/reversal, chargeback, payout reconciliation, or Mollie webhook inventory/amount mismatches.
- **Suggested fix:** Add integration tests for these paths.

### P2-7. EU country list is duplicated
- **Domain:** Backend / Maintainability
- **Affected files:** `src/lib/checkout.server.ts:289-318`
- **Gap:** `isCrossBorderB2b` duplicates the EU list in `address-validation.ts`.
- **Suggested fix:** Centralize the EU country list.

### P2-8. Checkout UI relies on array index for default shipping selections
- **Domain:** Frontend / Checkout
- **Affected files:** `src/components/CheckoutPage.tsx`
- **Gap:** Default selection uses array index rather than stable IDs.
- **Suggested fix:** Use stable shop-order or option IDs.

### P2-9. PII in JSONB columns is not encrypted at rest
- **Domain:** Security / Database
- **Affected files:** `platform_order.shippingAddress`, `platform_order.billingAddress`, `invoices.billingDetails`, `shop.businessAddress`, `shop.shippingOrigin`
- **Gap:** Address and billing JSONB blobs contain names/emails/VAT IDs and are stored unencrypted.
- **Why it is a risk:** Increases blast radius of a database breach.
- **Suggested fix:** Evaluate application-level encryption or PostgreSQL column-level encryption (`pgcrypto`).

### P2-10. Owner/customer message tables not redacted on account deletion
- **Domain:** GDPR / Data Retention
- **Affected files:** `owner_message_thread`, `owner_message`, `customer_note`, `customer_tag`
- **Gap:** Bodies/subjects can contain PII and are not cleaned when a customer deletes their account.
- **Suggested fix:** Delete or redact `owner_message.body`, `owner_message_thread.subject`, and `customer_note.content` for threads linked to the deleted user.

### P2-11. `shipping_label` not cleaned on account deletion
- **Domain:** GDPR / Data Retention
- **Affected files:** `shipping_label` table
- **Gap:** Shipping labels remain after account deletion.
- **Suggested fix:** Decide retention policy and document; redact if required.

### P2-12. `emailOutbox.recipientEmail` stored in plaintext
- **Domain:** GDPR / Database
- **Affected files:** `src/db/schema.ts:871-902`
- **Gap:** `recipientEmail` is stored as raw text alongside `recipientHash`.
- **Suggested fix:** Remove `recipientEmail` from the outbox after sending or encrypt it.

### P2-13. State-machine transitions not enforced at schema level
- **Domain:** Database / Business Logic
- **Affected files:** `order_status` enum, `shop_status` enum, `payout_status` enum, `dispute.status`
- **Gap:** Illegal transitions (e.g., `pending_payment` → `delivered`) are not enforced.
- **Suggested fix:** Add transition validation in server functions; optionally add triggers for critical transitions.

### P2-14. `audit_log.actorId` uses `ON DELETE CASCADE`
- **Domain:** Compliance / Audit
- **Affected files:** `src/db/schema.ts:813-833`
- **Gap:** Hard-deleting a user would delete audit logs.
- **Suggested fix:** Change FK to `ON DELETE SET NULL` and ensure `actorId` is nullable, or prevent hard deletion entirely.

### P2-15. `invoices.originalInvoiceNumber` has no foreign key
- **Domain:** Database / Invoicing
- **Affected files:** `src/db/schema.ts:993-1014`
- **Gap:** `originalInvoiceNumber` is plain text with no FK to `invoices.invoiceNumber`.
- **Suggested fix:** Add a self-referencing FK or validate before inserting a credit note.

### P2-16. `meilisearch_sync_queue` status/action are free text
- **Domain:** Database / Data Integrity
- **Affected files:** `src/db/schema.ts:1016-1036`
- **Gap:** `action` and `status` are `text` with only a `CHECK` on status.
- **Suggested fix:** Use `pgEnum` for both columns.

### P2-17. Missing composite indexes for common list queries
- **Domain:** Database / Performance
- **Affected files:** `platform_order`, `shop_order`, `order_item`
- **Gap:** Common listings filter by `(userId/shopId, status, createdAt)` or `(status, createdAt)` without supporting composite indexes.
- **Suggested fix:** Add indexes such as `(shopId, status, createdAt)`, `(userId, status, createdAt)`, `(status, createdAt)`.

### P2-18. `rate_limit` has a redundant index
- **Domain:** Database / Performance
- **Affected files:** `src/db/schema.ts:835-850`
- **Gap:** `key` has both a `UNIQUE` constraint and a separate `index('rate_limit_key_idx')`.
- **Suggested fix:** Remove the redundant index.

### P2-19. `shop.onboardingStep` has no bounds check
- **Domain:** Database / Onboarding
- **Affected files:** `src/db/schema.ts:133-213`
- **Gap:** `onboardingStep` is an integer defaulting to 1 with no `CHECK`.
- **Suggested fix:** Add `CHECK (onboardingStep BETWEEN 1 AND 8)`.

### P2-20. `shopSocials.platform` is free text
- **Domain:** Database / Data Integrity
- **Affected files:** `src/db/schema.ts:215-229`
- **Gap:** `platform` has no enum or validation at the DB level.
- **Suggested fix:** Add an enum for known platforms or a `CHECK` constraint.

### P2-21. `payoutReconciliationLog` has no retention cleanup
- **Domain:** Operations / GDPR
- **Affected files:** `src/db/schema.ts:1038-1056`
- **Gap:** No retention policy or cleanup job.
- **Suggested fix:** Add a retention policy and cleanup job.

### P2-22. No CPU/memory resource limits in Compose
- **Domain:** Operations / Reliability
- **Affected files:** `docker-compose.prod.yml`, `docker-compose.staging.yml`
- **Gap:** No `deploy.resources.limits` on any service.
- **Suggested fix:** Add conservative memory limits (e.g., app 2GB, db 4GB, Meilisearch 2GB).

### P2-23. Disk-health threshold hardcoded
- **Domain:** Operations
- **Affected files:** `src/routes/api/health.ts:22`
- **Gap:** `DISK_THRESHOLD_BYTES` hardcoded to 500 MB.
- **Suggested fix:** Make configurable via `HEALTH_DISK_THRESHOLD_BYTES`.

### P2-24. Inconsistent job command style
- **Domain:** Operations
- **Affected files:** `docker-compose.prod.yml:135`; `docker-compose.staging.yml:116`
- **Gap:** `inventory-cleanup` and `meilisearch-sync` use `bun run src/jobs/...ts` while other jobs use `bun run job:...`.
- **Suggested fix:** Align all jobs to use `bun run job:<name>`.

### P2-25. `make e2e` uses hardcoded 30-second wait loop
- **Domain:** Testing
- **Affected files:** `Makefile:67-73`
- **Gap:** Flaky readiness check.
- **Suggested fix:** Poll `/api/health/ready` with a longer configurable timeout.

### P2-26. Server logs full URL on unhandled errors
- **Domain:** Security / Logging
- **Affected files:** `server-entry.mjs:302-308`
- **Gap:** Full URL (including query params/tokens) is logged on unhandled errors.
- **Suggested fix:** Strip query strings or redact sensitive params before logging URLs.

### P2-27. No deployment success/failure notification
- **Domain:** Operations
- **Affected files:** `infrastructure/ansible/files/deploy.sh`
- **Gap:** No Slack/Discord/PagerDuty notification.
- **Suggested fix:** Add an optional webhook notification step.

### P2-28. No canary or staged rollout
- **Domain:** Operations
- **Affected files:** `infrastructure/ansible/files/deploy.sh`
- **Gap:** All traffic is switched at once.
- **Suggested fix:** Consider blue/green or canary step.

### P2-29. Root loader logs auth errors to client console
- **Domain:** Security / Logging
- **Affected files:** `src/routes/__root.tsx:22`
- **Gap:** `console.error('ROOT LOADER getCurrentUser ERROR:', err)` on auth failure.
- **Suggested fix:** Log server-side with structured logger; return `null` to client without details.

### P2-30. `auth-utils.ts` uses unstructured `console.warn`
- **Domain:** Observability
- **Affected files:** `src/lib/auth-utils.ts:22`
- **Gap:** `console.warn('BETTER_AUTH_SECRET not set ...')`.
- **Suggested fix:** Use `logger.server.ts` or remove the warn.

### P2-31. Brittle `as unknown as` / `as any` casts in auth code
- **Domain:** Security / Type Safety
- **Affected files:** `src/lib/auth-middleware.ts:48-55`; `src/lib/authz.ts:83-95`; `src/lib/invoices.ts:28`
- **Gap:** Better Auth user shape is forced through unsafe casts.
- **Suggested fix:** Extend the Better Auth user type declaration or validate fields with Zod at the auth boundary.

### P2-32. GET auth endpoints are not rate-limited
- **Domain:** Security
- **Affected files:** `src/routes/api/auth/$.ts:14`
- **Gap:** GET handler delegates directly to `auth.handler(request)` without `assertAuthRateLimit`.
- **Suggested fix:** Apply a per-IP rate limit to GET auth endpoints, especially `/api/auth/session`.

### P2-33. `/api/metrics` token comparison is not constant-time
- **Domain:** Security
- **Affected files:** `src/routes/api/metrics.ts:22`
- **Gap:** `auth === \`Bearer ${token}\``.
- **Suggested fix:** Use `crypto.timingSafeEqual`.

### P2-34. Footer social links point to placeholders
- **Domain:** Frontend / UX
- **Affected files:** `src/components/Footer.tsx`
- **Gap:** Social links point to TanStack/X placeholders.
- **Suggested fix:** Update to real Eurtisan social profiles or remove.

---

## Needs Clarification

These items require a product, business, or operations decision before the right implementation can be chosen.

1. **Manual review policy:** Should resolving `manual_review -> cancelled` automatically refund the buyer, or require an explicit refund step?
2. **Dispute refund scope:** For a multi-shop platform order, should a dispute refund on one shop order refund/credit only that shop order’s invoice?
3. **Shipping refund policy:** Should owner-initiated full refunds always include shipping, or should shipping be refundable separately?
4. **Mock mode in production:** Should `MOCK_PAYOUTS_ENABLED` be disallowed in production entirely, or allowed behind an explicit override?
5. **VIES fallback:** When VIES is unreachable, reject checkout (fail closed) or accept with async retry + ops alert?
6. **Is `MollieMockOauth` reachable in production?** If yes, it needs real branding and i18n; if dev-only, gate or remove it.
7. **Account order detail page:** Should `/account/orders/$orderId` render the richer `BuyerOrderDetailPage` instead of the older `OrderDetailPage`?
8. **Legal page dates:** Should “last updated” dates be sourced from a build-time constant or CMS?
9. **Search empty-state content:** Should trending queries and featured collections be CMS/marketing-managed?
10. **Production env defaults:** Is `NODE_ENV` guaranteed to be `production` in staging? `requirePrivileged2FA` bypasses 2FA when `NODE_ENV !== 'production'`.
11. **`.env.production.example` contents:** The file exists but was inaccessible during this audit. Verify it is complete and in sync with `.env.example`.
12. **Backup scope:** Are Meilisearch indexes and S3 uploads considered ephemeral/restorable from DB, or must they be backed up before launch?
13. **Availability SLA:** What is the launch RTO/RPO target? Docs claim <4h RTO and <1h RPO with WAL archiving, but WAL archiving is not implemented.
14. **Customer data in shop-owner tools:** Does GDPR erasure for a customer require redacting/deleting shop-level notes/tags/messages, or is that the shop owner’s responsibility?
15. **Shipping-label retention:** Should shipping labels be redacted on account deletion, or retained with orders for 10 years?
16. **SKU requirement:** Is SKU required for every product variant, or optional?
17. **Vault password:** Is `infrastructure/ansible/.vault_pass` the real Ansible Vault password or a placeholder?
18. **Migration repair approach:** Should the team regenerate a clean migration baseline or manually repair the existing files?

---

## Verified / Working Areas

These areas were reviewed and found to be implemented to production-grade standards (or close enough that they are not blockers).

- **Route tree & nested layouts:** `/studio`, `/admin`, `/creator`, `/account`, `/shops`, `/sell/onboarding` are wired correctly.
- **Auth flows:** sign-in, sign-up, OAuth, email verification, password reset, 2FA setup/verification, account deletion, data export.
- **Buyer experience:** home, Meilisearch search with filters/suggestions, category browsing, shop pages, product detail with gallery/reviews, cart, checkout with shipping rates and service points.
- **Creator/studio operations:** dashboard, product create/edit with variants, shop settings/lifecycle, customer list/export/notes/tags, order list/detail with ship/deliver/refund/cancel/manual-review.
- **Admin shell:** command palette, breadcrumbs, shortcuts, audit log, disputes, orders, payouts.
- **Payment provider abstraction:** Real and mock Mollie providers, webhook signature verification, idempotency, amount-mismatch guard.
- **Mollie Connect OAuth flow:** Callback exchanges code, stores tokens/organization ID, activates shop.
- **Order state machine & audit logging:** Transitions are explicit, audited, and 2FA-enforced for privileged actions.
- **Delayed payouts & reconciliation:** Payouts held until dispute window, with background reconciliation.
- **Sendcloud integration:** Rates, labels, tracking, service points, webhook HMAC verification.
- **Invoicing engine:** Customer invoices, platform-fee invoices, credit notes, reverse-charge support.
- **Account deletion core flow:** Anonymizes user row, archives shops, deactivates products, redacts seller invoices and payout payloads, removes sessions/accounts/2FA/notifications/carts/preferences, redacts reviews/disputes/messages.
- **Session token hashing:** Tokens hashed to SHA-256 before persistence.
- **CSRF protection:** Origin/Referer checks wired into `authMiddleware` and `authPipeline`.
- **Rate limiting:** IP-based and per-email limits on auth endpoints; per-user middleware on sensitive actions.
- **Account lockout:** 5 failed attempts → 30-minute lockout.
- **Container hardening:** Pinned digests, multi-stage build, non-root user in `Dockerfile.prod`.
- **Ansible provisioning:** Server hardening, Docker install, repo clone, env write, cron backup, observability stack deployment.
- **Backup automation:** Nightly DB dump, test-restore verification, pruning, structured JSON logging.
- **Runbooks:** Database outage, payment degradation, Meilisearch failure, disk full, backup/restore, chargeback procedures.
- **Unit-test breadth:** 90+ test files covering auth, checkout, inventory, orders, payouts, email, VAT, search, metrics.

---

## Recommended Launch Sequence

1. **Stop all money leaks:** Fix P0-1, P0-2, P0-3, P0-14, P0-22, P0-23.
2. **Repair database tooling:** Fix P0-4 and validate migration generation/apply on a fresh database.
3. **Close GDPR gap:** Fix P0-5 and update `DATA_RETENTION.md`.
4. **Lock down security:** Fix P0-7, P0-8, P0-9, P0-11, P0-19, P0-21.
5. **Make deploy observable:** Fix P0-10, P0-12, P1-17 through P1-24, P1-30 through P1-33.
6. **Fix tax/VAT correctness:** Fix P0-15, P0-16, P0-18, P1-3 through P1-5.
7. **Localize the UI:** Address P0-18 and P1-40 through P1-45.
8. **Strengthen CI/tests:** Address P1-25 through P1-28.
9. **Resolve documentation gap:** Fix P0-6 and reconcile North Star status.
10. **Tackle P2 polish** after the public launch.

---

*This audit is read-only. No code, schema, data, or configuration was modified during its production.*
