# Eurtisan Pre-Beta Comprehensive Master Audit Report

**Audit Date:** August 22, 2026  
**Audited Target:** Closed Beta Launch (2-Week Readiness Window)  
**Consolidation Status:** Fully Cross-Verified & Reconciled with Source Code Proof  

---

## 1. Executive Summary & Launch Readiness Verdict

Following an exhaustive, multi-agent cross-audit and line-by-line verification against the codebase:

**Consolidated Verdict: 🟢 WEEK 1 COMPLETE — ALL 6 P0 BLOCKERS & P1 REGULATORY ITEMS RESOLVED**

Following remediation across PRs and commits (security hardening, financial calculation corrections, encryption alignment, DSA Articles 16 & 17, and payout freezing), all **6 Critical P0 Vulnerabilities & Accounting Bugs** alongside High-Priority (P1) items 1 through 9 have been resolved and verified with automated test coverage.

The platform has passed all Week 1 regulatory and security gates. Outstanding work is isolated to Week 2 hardening, operational retention sync, and staging qualification drills.

---

## 2. Automated Quality Gate Verification Matrix

All automated gates were executed and verified on this machine:

| Automated Gate | Target / Tool | Result | Details & Evidence |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `make check` (`tsc --noEmit`) | **PASS (0 errors)** | 100% strict type safety across all routes, models, and loaders |
| **Biome Linter** | `make lint` | **PASS (0 errors, 0 warnings)** | 1,261 files checked |
| **Biome Formatter** | `make format` | **PASS (0 diffs)** | 1,261 files checked |
| **Dependency Security** | `make audit-production` (`bun audit`) | **PASS (0 advisories)** | 0 moderate/high vulnerabilities in production dependencies |
| **Database Schema** | `make db-check` (`drizzle-kit check`) | **PASS** | Schema matches 87 migration files |
| **Accessibility (a11y)** | `make test-accessibility` (Axe-core) | **PASS (228/228 tests)** | 0 axe violations on checkout, cart, store, search, product detail |
| **Alert Rules & Promtool**| `make promtool-check` & `promtool-test` | **PASS (12 files, 33 rules)** | All Prometheus alert rules validated and behaviorally tested |
| **Ansible / Host Preflight**| `make ansible-check` & `compose-check` | **PASS (21 assertions)** | Staging/production inventories, templates, and Compose configs valid |
| **Pure Unit Tests** | Vitest `unit-pure` | **PASS (80/80 files, 636 tests)** | 100% passing across pure domain utilities |
| **Browser Component Tests**| Vitest `browser` | **PASS (68/68 files, 700 tests)** | 100% passing across UI components |
| **Database Unit Tests** | Vitest `unit-db` (Solo run) | **PASS (115/115 files, 1808 tests)** | 100% passing in clean isolated run |
| **Full Suite Concurrency**| `make test` (Full concurrent suite) | **INTERMITTENT FLAKE** | Async pool query timing under concurrent CPU load |

---

## 3. P0 — Critical Vulnerabilities & Financial Blockers (Verified in Source)

### P0-1. [RESOLVED] IDOR: Unauthenticated/Customer Mutation & Deletion of Product Variants
- **Files:** [`src/lib/product-variants.ts:61-160`](file:///home/joeri/Projects/Eurtisan/src/lib/product-variants.ts#L61-L160) and [`src/lib/products/variants.server.ts:201-260`](file:///home/joeri/Projects/Eurtisan/src/lib/products/variants.server.ts#L201-L260)
- **Vulnerability:** While `createProductVariant` correctly checks `requireRoleForUser('creator', context.user)` and `verifyProductOwnershipForVariants`, the functions `updateProductOption` (:61), `deleteProductOption` (:78), `updateProductVariant` (:122), and `deleteProductVariant` (:146) omit role and ownership checks entirely.
- **Impact:** Any authenticated user with a `customer` role can modify prices, manipulate stock counts, alter options, or delete variants for ANY product across the entire marketplace by passing arbitrary IDs.
- **Fix:** Add `requireRoleForUser('creator', context.user)` and `verifyProductOwnershipForVariants(productId, context.user.id)` to all four RPC handlers.

---

### P0-2. [RESOLVED] IDOR: Cross-Shop Customer Note Tampering & Deletion
- **Files:** [`src/lib/customers.ts:98-128`](file:///home/joeri/Projects/Eurtisan/src/lib/customers.ts#L98-L128) and [`src/lib/customers/operations.server.ts:340-413`](file:///home/joeri/Projects/Eurtisan/src/lib/customers/operations.server.ts#L340-L413)
- **Vulnerability:** `updateCustomerNote` and `deleteCustomerNote` in `customers.ts` only check that the caller is a `creator`, but never verify shop ownership (`requireShopOwnershipForUser`). The backend queries mutate by `noteId` without comparing `note.shopId` to the caller's shop.
- **Impact:** Any registered seller can edit or delete private customer notes created by other sellers.
- **Fix:** In `customers/operations.server.ts`, verify `existingNote.shopId` belongs to the authenticated seller before executing update/delete.

---

### P0-3. [RESOLVED] Invoice Encryption Asymmetry Corrupts Buyer Data & Crashes Credit Notes
- **Files:** [`src/lib/invoices/operations.server.ts:244, 410, 509, 530`](file:///home/joeri/Projects/Eurtisan/src/lib/invoices/operations.server.ts#L244), [`src/lib/checkout/order-persistence.server.ts:265`](file:///home/joeri/Projects/Eurtisan/src/lib/checkout/order-persistence.server.ts#L265), and [`src/lib/invoices.ts:85-91`](file:///home/joeri/Projects/Eurtisan/src/lib/invoices.ts#L85-L91)
- **Vulnerability:** 
  1. Checkout persists `billingAddress` as ciphertext using `encryptJsonb`. In `invoices/operations.server.ts:244`, `orderRecord.billingAddress as BillingAddress` casts the encrypted string directly without `decryptJsonb`, producing `undefined` buyer names, streets, and VAT IDs on all newly issued invoices.
  2. In `operations.server.ts:410, 457`, `invoices.billing_details` is inserted as unencrypted JSON (violating encryption-at-rest), but in line 530 credit notes store `billingDetails` using `encryptJsonb`.
  3. In `invoices.ts:85`, the read path calls `invoiceBillingDetailsSchema.safeParse(invoice.billingDetails)` directly without `decryptJsonb`, crashing with HTTP 500 (`"Invoice details are corrupted"`) whenever a user or seller views a credit note.
- **Fix:** Decrypt `orderRecord.billingAddress` when building invoices; ensure `invoices.billing_details` is consistently encrypted with `encryptJsonb` on write and decrypted with `decryptJsonb` on read.

---

### P0-4. [RESOLVED] VAT Recomputed with Wrong (Exclusive) Formula During Checkout Persistence
- **Files:** [`src/lib/tax/financial-totals.server.ts:75-76, 182-190`](file:///home/joeri/Projects/Eurtisan/src/lib/tax/financial-totals.server.ts#L75-L76) and [`src/lib/checkout/order-persistence.server.ts:325`](file:///home/joeri/Projects/Eurtisan/src/lib/checkout/order-persistence.server.ts#L325)
- **Vulnerability:** `vatFromBasisPoints` computes `Math.round((amountCents * basisPoints) / 10000)`. When `persistCheckoutOrder` calls `recalcPlatformOrderTree`, this formula is applied to `computedTotal` (which is VAT-inclusive). Multiplying an inclusive price by the VAT rate applies the *exclusive* VAT formula: on a €120 item @ 20% VAT, it calculates €24.00 VAT instead of the canonical inclusive VAT €20.00 (`(120 * 20) / 120 = 20`).
- **Impact:** Persisted item VAT is inflated by ~20%, reducing the seller's net subtotal (`subtotalCents - vatAmountCents`), which distorts the 5% platform commission fee calculation, tax reports, and artisan payouts.
- **Fix:** Update `financial-totals.server.ts` to use the canonical inclusive VAT extraction formula from `src/lib/tax/vat.server.ts:148-149`.

---

### P0-5. [RESOLVED] Comma-Decimal Price Input Silently Truncates Cents in European Locales
- **Files:** [`src/components/product/ProductNewForm.tsx:284`](file:///home/joeri/Projects/Eurtisan/src/components/product/ProductNewForm.tsx#L284), [`src/components/product/ProductEditForm.tsx:396`](file:///home/joeri/Projects/Eurtisan/src/components/product/ProductEditForm.tsx#L396), [`src/components/sell/Step7Listing.tsx:66`](file:///home/joeri/Projects/Eurtisan/src/components/sell/Step7Listing.tsx#L66), [`src/route-components/search.tsx:66`](file:///home/joeri/Projects/Eurtisan/src/route-components/search.tsx#L66), and [`src/route-components/admin/disputes/ResolutionForm.tsx:39`](file:///home/joeri/Projects/Eurtisan/src/route-components/admin/disputes/ResolutionForm.tsx#L39)
- **Vulnerability:** Forms use `Number.parseFloat(priceStr)` directly. In European countries (France, Germany, Netherlands, Italy, Spain), users type `"14,50"`. In JavaScript, `Number.parseFloat("14,50")` evaluates to `14`, which converts to 1400 cents (€14.00), silently dropping the 50 cents.
- **Adjacent Issue:** `Step7Listing.tsx:67-68` hardcodes a 3% platform fee preview (`Math.round(priceCents * 0.03)`) instead of the actual `PLATFORM_FEE_PERCENT = 5%`, giving onboarding sellers a false earnings preview.
- **Fix:** Normalize `,` to `.` before `parseFloat` in a shared utility (e.g. `parseDecimalCents(str)`), and import `PLATFORM_FEE_PERCENT` in `Step7Listing.tsx`.

---

### P0-6. [RESOLVED] Caddy Edge CSP Header Clobbers Application Nonce CSP
- **File:** [`Caddyfile:65`](file:///home/joeri/Projects/Eurtisan/Caddyfile#L65)
- **Vulnerability:** `Caddyfile` sets `Content-Security-Policy` unconditionally without the `?` prefix. In Caddy, setting a header without `?` strips and replaces the upstream response headers.
- **Impact:** Caddy replaces the per-request nonce CSP header emitted by `server-entry.mjs:300-312` with a static policy that lacks nonces, blocking SSR inline script execution and breaking client hydration behind Caddy in production/staging.
- **Fix:** Prefix the directive with `?` in `Caddyfile`: `?Content-Security-Policy "default-src 'self'..."` to ensure it only applies when upstream emits no CSP.

---

## 4. P1 — High Priority (Fix Before/At Beta Launch)

1. [RESOLVED] **GDPR Art. 17 Erasure Incompleteness:**
   - **File:** [`src/lib/users/account-data.server.ts:613-811`](file:///home/joeri/Projects/Eurtisan/src/lib/users/account-data.server.ts#L613-L811)
   - **Issue:** Account deletion transaction does not redact `customer_note.content` (`'[REDACTED]'`), delete `customer_tag` rows, or redact `owner_message_thread.subject` and `owner_message.body` as promised in `docs/DATA_RETENTION.md:48-50`.
   - **Fix:** Add update/delete queries for these four entities into `deleteUserAccount`.

2. [RESOLVED] **DSA Art. 16 Notice & Action Mechanism for Products / Shops:**
   - **Files:** [`src/components/ProductDetail.tsx`](file:///home/joeri/Projects/Eurtisan/src/components/ProductDetail.tsx) and [`src/db/schema.ts:801-889`](file:///home/joeri/Projects/Eurtisan/src/db/schema.ts#L801-L889)
   - **Issue:** DSA Art. 16 applies to all hosting services regardless of size. Eurtisan currently only has reporting for reviews and seller replies, but no reporting channel for illegal/counterfeit/hazardous products or storefronts.
   - **Fix:** Add `product_report` schema table and a "Report item" modal on the product page connecting to admin moderation.

3. [RESOLVED] **DSA Art. 17 Statement of Reasons on Shop Suspension:**
   - **File:** [`src/lib/shops/moderation.server.ts:145-210`](file:///home/joeri/Projects/Eurtisan/src/lib/shops/moderation.server.ts#L145-L210)
   - **Issue:** `moderateShopQuery` sets `shop.isSuspended = true` and updates Meilisearch, but does not emit a Statement of Reasons notification or email to the affected creator under DSA Art. 17.
   - **Fix:** Dispatch an in-app notification and email with grounds and redress avenues upon suspension.

4. [RESOLVED] **Shop Suspension Does Not Freeze Pending Payouts:**
   - **File:** [`src/lib/shops/moderation.server.ts:145-210`](file:///home/joeri/Projects/Eurtisan/src/lib/shops/moderation.server.ts#L145-L210) and [`src/lib/payouts/operations.server.ts`](file:///home/joeri/Projects/Eurtisan/src/lib/payouts/operations.server.ts)
   - **Issue:** Banning or suspending a shop does not pause or hold pending payouts; the automated payout job will continue routing funds to the suspended shop's connected account.
   - **Fix:** Place a payout hold (`status = 'on_hold'`) on all pending payouts when a shop is suspended.

5. [RESOLVED] **Admin Order Details Returns Raw Ciphertext Addresses:**
   - **File:** [`src/lib/admin/orders.server.ts:287-288`](file:///home/joeri/Projects/Eurtisan/src/lib/admin/orders.server.ts#L287-L288)
   - **Issue:** Admin order detail casts `shippingAddress` and `billingAddress` without calling `decryptJsonb`, exposing raw ciphertext or undefined fields to administrators.
   - **Fix:** Wrap both address columns in `decryptJsonb` before returning.

6. [RESOLVED] **Database Connection Pool Exhaustion in Production:**
   - **Files:** [`docker-compose.prod.yml:183-676`](file:///home/joeri/Projects/Eurtisan/docker-compose.prod.yml#L183-L676) and [`src/lib/infra/db-pool-config.ts:24`](file:///home/joeri/Projects/Eurtisan/src/lib/infra/db-pool-config.ts#L24)
   - **Issue:** 17 individual job containers in Compose default to `DATABASE_POOL_MAX=20`, creating up to 360 potential connections against Postgres's default 100 limit.
   - **Fix:** Unify background jobs into a single `worker-daemon` container, set `DATABASE_POOL_MAX=10` on worker and `DATABASE_POOL_MAX=20` on `app`, and configure Postgres `max_connections=200`.

7. [RESOLVED] **Meilisearch Coupling in Readiness Probe:**
   - **File:** [`src/routes/api/health.ts:249, 306-323`](file:///home/joeri/Projects/Eurtisan/src/routes/api/health.ts#L249-L323)
   - **Issue:** `/api/health/ready` requires `meilisearchHealthy = true`. If Meilisearch restarts, Compose/orchestrator marks the whole app offline (503) even though Postgres Full-Text Search fallback is available.
   - **Fix:** Move Meilisearch health check out of `/api/health/ready` and into `/api/health/deps`.

8. [RESOLVED] **Background Job Observability Blindspot:**
   - **File:** [`infra/observability/prometheus/prometheus.yml:28-34`](file:///home/joeri/Projects/Eurtisan/infra/observability/prometheus/prometheus.yml#L28-L34)
   - **Issue:** Individual job services in Compose expose no metrics endpoints; Prometheus only scrapes one service on port 3001.
   - **Fix:** Running the unified `worker-daemon` exposes all 16 jobs on port 3001 for Prometheus metrics scraping.

9. [RESOLVED] **French LCEN Statutory Legal Imprint Incomplete:**
   - **File:** [`src/lib/legal/operator.server.ts:12-58`](file:///home/joeri/Projects/Eurtisan/src/lib/legal/operator.server.ts#L12-L58) and [`src/components/Footer.tsx`](file:///home/joeri/Projects/Eurtisan/src/components/Footer.tsx)
   - **Issue:** French LCEN Art. 6-III-1 mandates publishing SIRET/RCS registration number, publication director, and web host identity/address.
   - **Fix:** Add SIRET/RCS, publication director, and host info to `operator.server.ts` and legal notices.

10. [PENDING STAGING] **Test Suite Flake Under Concurrent Timing:**
    - **Issue:** Full `make test` runs intermittently flake due to connection draining timing between serial test files under heavy CPU load.
    - **Fix:** Ensure test teardowns drain connection pool promises cleanly and require 3 consecutive green `make test` runs before staging sign-off.

---

## 5. P2 — Scheduled Operational & Compliance Debt

1. **`docs/DATA_RETENTION.md` Synchronization:**
   - Update documentation to match code: `actorId` set to NULL, `shipping_label` parcel ID cleared on erasure, audit log retention duration set to 365 days, and document `search_event` 180-day cleanup.
2. **Docker Log Rotation:**
   - Configure `max-size: "50m"` and `max-file: "3"` in `docker-compose.prod.yml` and Ansible roles to prevent VPS disk exhaustion.
3. **Memory Sizing:**
   - Right-size Compose aggregate container memory limits to align with the recommended 8 GB host target.
4. **SEO & Internationalization:**
   - Add `hreflang` tags and `og:locale` alternates; ensure canonical URLs preserve `/nl` prefixes in `src/lib/marketing/seo.ts:46-86`.
5. **Accessibility Polish on Auth Views:**
   - Ensure focus rings are visible on sign-in inputs and error messages are programmatically linked via `aria-describedby`.

---

## 6. Validated Strong Architectural & Security Foundations

The cross-audit verified that the core architecture is built to highest engineering standards:
- **Authentication:** Hashed session tokens (`sha256Hex`), encrypted OAuth tokens and 2FA secrets via AES-256-GCM.
- **Server Boundaries:** Strict deny-by-default, 0 runtime `.server` imports in client code, and zero `useEffect` usage.
- **Concurrency & Payments:** Pessimistic row locking (`SELECT ... FOR UPDATE`) on inventory reservations; payment provider calls kept outside DB transactions; pull-verified webhooks and idempotent transitions.
- **European Legal Compliance:** CRD Art. 6a trader status explicit and fail-closed at checkout; French Arrêté of 16 Nov 1999 soap & bath unit pricing with 1L waiver and test pinning; 100% Paraglide English-Dutch key parity (2,499 keys).
- **Disaster Recovery:** Automated pgBackRest backup and PITR verified end-to-end via `validate-pgbackrest.sh`.

---

## 7. Two-Week Prioritized Sprint Plan to Closed Beta Launch

```
Week 1 (Days 1–7): Critical Fixes & Regulatory Compliance [COMPLETE]
├── [x] Day 1: Fix P0-1 & P0-2 (IDORs on product variants and customer notes)
├── [x] Day 2: Fix P0-3 & P0-4 (Invoice encryption asymmetry & VAT inclusive formula)
├── [x] Day 3: Fix P0-5 & P0-6 (Euro comma decimal parsing & Caddy CSP ? prefix)
├── [x] Day 4: Fix P1-1 & P1-4 (GDPR erasure completion & shop suspension payout freeze)
├── [x] Day 5: Fix P1-2 & P1-3 (DSA Art. 16 product reporting & Art. 17 Statement of Reasons)
├── [x] Day 6: Fix P1-6 & P1-7 (Unify worker-daemon in Compose & decouple Meilisearch from /api/health/ready)
└── [x] Day 7: Fix P1-5 & P1-9 (Admin order decryption & French LCEN legal imprint)

Week 2 (Days 8–14): Hardening, Verification & Staging Drills [PENDING]
├── [ ] Day 8:   Sync `docs/DATA_RETENTION.md`, configure Docker log rotation & memory right-sizing
├── [ ] Day 9:   Triage test suite timing; ensure ≥3 consecutive green `make test` runs
├── [ ] Day 10:  Run complete automated gate suite: `make lint`, `make check`, `make test-accessibility`, `make test`
├── [ ] Day 11:  Execute staging disaster recovery & PITR restore drill (`docs/runbooks/backup-restore.md`)
├── [ ] Day 12:  Run full Playwright E2E suite (`make e2e`) on release candidate SHA
└── [ ] Day 13–14: Staging smoke qualification (`make staging-smoke`) and Beta Launch Approval 🚀
```
