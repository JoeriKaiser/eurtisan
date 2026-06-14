# Store-Owner Production Readiness Audit — Eurtisan

**Date:** 2026-06-12  
**Refreshed:** 2026-06-13  
**Auditor:** Kimi Code CLI (multi-agent evidence gathering)  
**Scope:** Store-owner capabilities across the Eurtisan marketplace application. The audit assumes the perspective of a seller/shop owner who must fully control their store, products, orders, customers, payouts, taxes, and operational visibility before the platform launches to production.  
**Method:** Read-only codebase review by parallel domain agents; targeted runtime tests where noted.

**Strategic update:** Following the audit, the shipping carrier objective has been changed from Mondial Relay to **Sendcloud**. The Sendcloud integration has been implemented and hardened. This document has been refreshed to mark the items that are now fixed and to re-triage the remaining gaps.

---

## Executive Summary

Eurtisan has a solid architectural foundation (TanStack Start, Better Auth, Drizzle/PostgreSQL, Meilisearch, Docker-first workflows, observability stack, GDPR-aware data-export hooks, and a well-modeled order/payout schema). **The five original North Star launch blockers have been partially or fully resolved:**

1. ✅ **Real shipping with Sendcloud** — implemented for rates, labels, tracking, service points, webhook reliability, and reconciliation.
2. ✅ **Reliable owner navigation** — product edit, post-approval payment, and studio settings links are fixed.
3. ✅ **Honest analytics** — shop dashboards are real; homepage seller/product counts and country count are real.
4. ⚠️ **Real payouts** — `executePayoutQuery` calls Mollie delayed-routing routes, the `returned` status is tracked, and the reconciliation job is wired. Mock OAuth/payment routes remain compiled into production builds and must be stripped or guarded.
5. ⚠️ **Production hardening** — Grafana is still public, analytics consent is missing, the edge CSP is weak, and observability configs are still wired for Coolify rather than standalone production.
6. ✅ **Owner-initiated refunds, credit notes, and sequential invoice numbering** — shop owners can refund paid/fulfilled orders; the system creates credit notes and reverses routed payouts.

**From a store-owner perspective the application is not yet production-ready.** The remaining launch blockers are concentrated in **payouts/production hardening**, **owner order lifecycle**, ** invoicing**, and **production operability**. The P0 items below must be resolved (or explicitly accepted and mitigated) before launch.

---

## 1. Store / Shop Management

### What exists
- 8-step onboarding wizard (`src/routes/sell/onboarding`, `src/components/sell/Step1-8.tsx`) with identity, story, visuals, location, policies, socials, first listing, review.
- Shop status lifecycle: `draft` → `pending_review` → `approved`/`rejected`/`changes_requested` → payment connected → `active`.
- Admin moderation flow (`src/lib/sell-onboarding.server.ts`).
- Shop settings editor (`src/routes/creator/shop.tsx`, `src/components/shop/ShopSettingsForm.tsx`) for name, slug, description, image, VAT flag, VAT ID, shipping origin.
- Mollie Connect OAuth for payouts (`src/routes/api/auth/mollie/callback.ts`, `src/lib/payouts.server.ts`).

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 1.1 | ~~**Placeholder settings API**~~ **Fixed** | `src/routes/api/shops/$shopId/settings.ts` now persists GET/PATCH via `getCreatorShopQuery` and `updateShopInternal`. | Settings API returns and updates real shop data. |
| 1.2 | ~~**Broken post-approval payment link**~~ **Fixed** | `src/route-components/sell/status/$shopId.tsx` now links to `/creator/payouts?shopId=...`. | Newly approved sellers land on the real payouts page with the shop pre-selected. |
| 1.3 | ~~**Mollie callback silently mocks credentials**~~ **Fixed** | `src/routes/api/auth/mollie/callback.ts` now returns 502 when `MOLLIE_CLIENT_ID`/`MOLLIE_CLIENT_SECRET` are missing; mock fallback removed. | Misconfigured env fails closed instead of faking a connection. |
| 1.4 | **Incomplete settings form** | `ShopSettingsForm.tsx` / `ShopSettingsFormFields.tsx` omit `bannerImage`, `policies`, `shop_socials`, `announcement`, and only store a partial `shippingOrigin`. | Owners cannot maintain core shop identity after onboarding. |
| 1.5 | **No close / delete shop** | No server function or UI to delete, archive, or pause a shop. | Owners cannot exit the platform or pause sales; GDPR retention workflows are blocked. |
| 1.6 | **Debug logging in auth middleware** | `src/lib/auth-middleware.ts:26-29` logs URL and headers for every server-function call. | PII/leakage risk and noisy production logs. |
| 1.7 | ~~**Studio dashboard stub**~~ **Fixed** | `src/route-components/studio/$shopId.tsx` is now a navigation hub with Orders, Products, Payouts, and Settings cards linking to real routes, plus real per-shop metrics. | Sellers have clear navigation and operational visibility. |

### Risk: Critical / High

---

## 2. Product Catalog Management

### What exists
- Full server-side CRUD: `createProduct`, `updateProduct`, `deleteProduct`, `toggleProductActive` (`src/lib/creator-products.ts`, `src/lib/creator-products.server.ts`).
- Paginated listing with search/filter/status/pagination (`src/components/CreatorProductsPage.tsx`).
- Image upload via presigned S3 URLs, up to 10 images per product, with reorder/remove UI.
- Slug uniqueness checks, XSS sanitization, ownership verification.
- `product_variant` table exists; admin bulk export exists.
- Comprehensive unit tests (`src/lib/creator-products.test.ts`).

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 2.1 | ~~**Broken product thumbnails in owner list**~~ **Fixed** | `src/components/product/ProductTableRow.tsx` now uses `getImageUrl(..., { width: 80, format: 'webp' })`. | Thumbnails render correctly in the owner catalog. |
| 2.2 | ~~**Broken product thumbnails in admin list**~~ **Fixed** | `src/route-components/admin/products.tsx` now uses `getImageUrl(..., { width: 80, format: 'webp' })`. | Admin product list thumbnails render correctly. |
| 2.3 | ~~**Broken product edit link**~~ **Fixed** | `src/components/product/ProductTableRow.tsx` now links to `/creator/products/$productId/edit`. | Owners reach the working product editor from the product list. |
| 2.4 | **Product variants are schema-only** | `product_variant` table is referenced by inventory/order code but has no UI, forms, or server functions for owners. | Core catalog capability (size/color/options) is unusable. |
| 2.5 | **No audit logging for owner mutations** | `src/lib/creator-products.server.ts` does not emit audit events for create/update/delete/toggle. | No forensic trail for catalog changes. |
| 2.6 | **Inconsistent authorization entry checks** | `updateProduct`, `deleteProduct`, `toggleProductActive` in `src/lib/creator-products.ts` rely on internal `verifyProductOwnership` instead of middleware-level enforcement. | Defense-in-depth gap. |
| 2.7 | **Hardcoded Euro symbol and English VAT labels** | `ProductNewFormFields.tsx:162`, `:250-266`; same in edit form. | Violates Euro-first pricing and i18n-readiness rules. |
| 2.8 | **No bulk operations for owners** | Bulk activate/deactivate/export is admin-only. | Large catalogs are tedious to manage. |
| 2.9 | **No draft/versioning workflow** | Products are either active or inactive. | Risk of accidental publication; no rollback. |
| 2.10 | **No low-stock notifications** | Dashboard shows a low-stock count but does not notify owners. | Owners may miss restocking needs. |

### Risk: High

---

## 3. Orders & Fulfillment

### What exists
- Parent `platform_order` + per-shop `shop_order` + `order_item` snapshot model.
- Buyer order history and cancellation while `pending_payment`.
- Seller order list/search/filter, order detail, ship dialog, mark-delivered.
- Sendcloud label generation, tracking, webhook-driven delivery updates, and reconciliation; manual tracking entry remains available as a fallback.
- Product weight/dimensions are now stored on `product` and snapshotted on `order_item` for accurate shipping estimates.
- State machine for status transitions (`VALID_TRANSITIONS` in `src/lib/shop-orders.server.ts`).
- Mollie webhook handling for paid/expired/chargeback; inventory decrement; invoice generation.
- Dispute thread for buyers/sellers/admins.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 3.1 | ~~**Store owner cannot cancel/refund after payment**~~ **Partially fixed** | `refundShopOrderQuery` and the studio order detail UI now allow owners to fully refund paid/processing/shipped/delivered orders, create credit notes, and reverse payouts. Order cancellation while `pending_payment` remains buyer-only. | Owners can issue post-payment refunds directly. |
| 3.2 | **No edit tracking after shipment** | `markShopOrderShippedQuery` supports idempotent tracking updates, but the UI only exposes it during initial ship. | Sellers cannot correct tracking numbers/URLs. |
| 3.3 | ~~**Shipping carrier is fully mocked**~~ **Fixed** | `src/integrations/shipping/sendcloud-provider.ts` calls the Sendcloud v2 API for rates, labels, and tracking. The Mondial Relay mock has been removed. Production requires `SENDCLOUD_PUBLIC_KEY` and `SENDCLOUD_SECRET_KEY`; missing credentials fail closed in production and fall back to a deterministic mock only in tests/development. | Real labels and tracking are produced when credentials are configured. |
| 3.4 | ~~**Mollie payment provider defaults to mock mode**~~ **Fixed** | `MolliePaymentProvider` still mocks in development when no key is set, but in production it now refuses to start when `MOCK_PAYMENTS_ENABLED=true` and requires `MOLLIE_API_KEY` when mock mode is disabled. | Mock money flows cannot be enabled accidentally in production. |
| 3.5 | **No seller dispute dashboard** | No `/studio/$shopId/disputes` list; `listOpenDisputes` is admin-only. | Sellers cannot see all disputes for their shop. |
| 3.6 | **`manual_review` is a dead-end state** | Webhook moves orders to `manual_review` on stock mismatch; `VALID_TRANSITIONS` defines no exits; no operator UI. | Orders can become stuck indefinitely. |
| 3.7 | **Payouts created before dispute window closes** | `markShopOrderDeliveredQuery` creates pending payout immediately; `resolveDisputeQuery` only blocks refund after payout is `sent`, not while `pending`. | Sellers may receive payouts for later-refunded orders. |
| 3.8 | **Weak route guard on order detail** | `src/routes/studio/$shopId.orders.$shopOrderId.tsx` only uses `guardAuth()`; ownership is delegated to server function. | Defense-in-depth gap. |
| 3.9 | **No order-level audit log for owner actions** | Ship/deliver/tracking updates do not emit audit events. | No immutable trail for compliance/disputes. |

### Risk: Critical

---

## 4. Payments, Payouts & Financials

### What exists
- Mollie payment provider abstraction (`src/integrations/mollie/mollie-payment-provider.ts`).
- Checkout flow with per-shop totals, shipping, VAT, Mollie redirect.
- Mollie Connect OAuth for seller onboarding.
- Creator payout view (`src/routes/creator/payouts.tsx`) and admin payout queue.
- Invoice generation for customer + platform fee (`src/lib/invoices.server.ts`).
- Refund flow via admin dispute resolution.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 4.1 | ~~**Payouts are not production-hardened**~~ **Fixed** | `executePayoutQuery` calls `createMollieRoute()`; `instrument.server.mjs` now refuses to start in production if `MOCK_PAYMENTS_ENABLED` or `MOCK_PAYOUTS_ENABLED` is `true`; missing Mollie credentials fail closed. | Real money cannot be accidentally replaced by mock flows in production. |
| 4.2 | ~~**Mollie Connect credentials undocumented**~~ **Fixed** | `MOLLIE_CLIENT_ID` and `MOLLIE_CLIENT_SECRET` are documented in `.env.example`, `.env.production.example`, `.env.staging.example`, `AGENTS.md`, and the Ansible `.env.j2` template. | Operators know these are required for seller onboarding and payouts. |
| 4.3 | ~~**Mock payment/OAuth routes remain available**~~ **Fixed** | `MolliePaymentProvider` rejects mock mode in production; the `/mollie-mock-oauth` route lazy-loads the mock UI so it is not bundled for production and `beforeLoad` throws `notFound()` under `import.meta.env.PROD`. | Mock onboarding/payment UI is unreachable in production builds. |
| 4.4 | ~~**No payout reconciliation or failure states**~~ **Fixed** | `payout_status` enum includes `returned`; `payout` has `returnedAt`/`returnReason`; `reconcilePayouts()` marks routes as `returned` when Mollie reports `route.status === 'returned'`. | Returned transfers are tracked and reconciled. |
| 4.5 | ~~**Payout status enum mismatch**~~ **Fixed** | The derived `CreatorPayoutLine.status` type matches the DB enum (`pending`/`in_transit`/`sent`/`failed`/`reversed`/`returned`); no `processing` value is used for payouts. | Payout UI/status filtering aligns with the database model. |
| 4.6 | ~~**Silent failure on payout-sent notification**~~ **Fixed** | The `catch` block in `payouts.server.ts` now logs with `alert: true` so the notification failure surfaces in monitoring. | Payout notification failures are visible to operators. |
| 4.7 | **No seller withdrawal preferences** | No minimum threshold, payout schedule, or withdrawal request. | Does not meet marketplace expectations. |
| 4.8 | **Hardcoded platform fee and billing identity** | `PLATFORM_FEE_PERCENT = 10` in `src/lib/platform-constants.ts`; `EURTISAN_BILLING_PARTY` hardcoded in `src/lib/invoices.server.ts:96-106`. | Business changes require code deployment. |
| 4.9 | **Financial types use `any`** | `createInvoicesForPlatformOrder(tx?: any)` and `getInvoiceByIdQuery(): Promise<any>`. | Type safety weakened on critical financial data. |

### Risk: Critical

---

## 5. Shipping & Delivery

### What exists
- Shop-level shipping origin address capture.
- Checkout shipping-option calculation backed by the **Sendcloud** v2 API, with a deterministic mock provider for development/tests and a `manual` fallback for seller-entered tracking.
- Real Sendcloud service-point selector populated from the Sendcloud API; selection is validated server-side at checkout.
- Label generation via Sendcloud parcels, tracking number/URL display, and HMAC-verified Sendcloud webhook updates at `/api/webhooks/sendcloud`.
- Webhook reliability: every event is persisted to `sendcloud_webhook_event` and the reconciliation job backfills missed updates.
- Buyer tracking status display.
- Non-production environments are constrained to Sendcloud's **Unstamped letter** method to avoid accidentally purchasing real labels during development/staging.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 5.1 | ~~**Carrier API is mocked**~~ **Fixed** | `src/integrations/shipping/sendcloud-provider.ts` calls the Sendcloud v2 API. The Mondial Relay mock has been removed. | Real labels and tracking when `SENDCLOUD_PUBLIC_KEY`/`SENDCLOUD_SECRET_KEY` are configured. |
| 5.2 | ~~**Only one carrier supported**~~ **Fixed (Sendcloud)** | The shipping-provider abstraction (`src/lib/shipping-provider.ts`) supports multiple carriers through Sendcloud's methods. Sendcloud returns DHL/PostNL/etc. methods as available. | Owners can offer any carrier/service available in their Sendcloud account. |
| 5.3 | ~~**Pick-up point selector uses mock data**~~ **Fixed** | `src/components/checkout/PickupPointSelectorModal.tsx` queries `getServicePoints` and renders real Sendcloud service points. | Buyers choose real pick-up points. |
| 5.4 | ~~**No product weight/dimensions**~~ **Fixed** | `product` and `order_item` now store `weight_grams`, `length_cm`, `width_cm`, `height_cm`. Checkout label generation uses real item dimensions with a safe fallback. | Shipping rates and labels are based on real package data. |
| 5.5 | **No owner shipping-rate management** | No `/studio/$shopId/shipping` route; no free-shipping thresholds, flat rates, zones, handling times. | Owners cannot control shipping economics. |
| 5.6 | **Hardcoded platform default origin** | `getPlatformOrigin()` in `src/lib/checkout.server.ts:164` returns Berlin. | Wrong fallback for non-DE sellers. |
| 5.7 | **No label cancellation/refund workflow** | Once a label is generated, it cannot be voided. | Cost recovery impossible on cancelled orders. |
| 5.8 | **No bulk label printing** | Ship dialog is one order at a time. | Inefficient at scale. |
| 5.9 | ~~**No real tracking webhooks**~~ **Fixed** | Sendcloud status/tracking webhooks are received at `/api/webhooks/sendcloud`, verified with HMAC-SHA256, persisted, and update order/label status. The reconciliation job backfills missed events. | Delivery events are near real-time when Sendcloud delivers webhooks. |

### Risk: Critical

---

## 6. Tax, VAT & Invoicing

### What exists
- VAT registration flag + VAT ID per shop; product VAT categories.
- VAT calculation engine with hardcoded EU rates and offline VAT-ID regex validation.
- Optional VIES API check.
- Reverse-charge logic for EU B2B.
- Invoice generation on payment with snapshots.
- DAC7 threshold helper.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 6.1 | ~~**No credit notes / invoice cancellation on refunds**~~ **Fixed** | `createCreditNoteForShopOrder` creates a negated credit note linked to the original customer invoice when an owner refund is processed. | EU tax law requires correcting documents for refunded sales. |
| 6.2 | ~~**Invoice numbers are not sequential**~~ **Fixed** | `invoice_number_sequence` table and `allocateNextInvoiceNumber` allocate `INV-YYYY-NNNNN`, `INV-FEE-YYYY-NNNNN`, and `CN-YYYY-NNNNN` numbers sequentially per prefix/year. | Most EU jurisdictions require continuous invoice numbering. |
| 6.3 | **No separate business address editing** | `shop.businessAddress` exists but settings/onboarding only capture `shippingOrigin`. | Invoices may show wrong issuer address. |
| 6.4 | **DAC7 tax identity not editable after onboarding** | `taxId`, `legalEntityType`, etc. collected only in onboarding. | Sellers cannot update tax identity; platform cannot correct it. |
| 6.5 | **No seller VAT reporting dashboard** | No aggregation of VAT collected, OSS sales, reverse-charge totals. | Sellers cannot file VAT returns from the platform. |
| 6.6 | **Tax env vars undocumented** | `PLATFORM_VAT_LIABLE`, `ENABLE_VIES_VALIDATION` not in `.env.example`. | Operators unaware of critical tax toggles. |
| 6.7 | **VIES validation off by default and falls open** | `verifyVatIdVies` returns `true` on API failure. | Invalid VAT IDs can slip through reverse-charge. |
| 6.8 | **Client/server VAT regexes inconsistent** | `src/lib/vat.ts` and `src/lib/vat.server.ts` differ for several countries. | IDs accepted client-side may be rejected server-side. |
| 6.9 | **Greek VAT IDs blocked at checkout** | `src/lib/checkout.ts:57-75` requires VAT-ID prefix to equal address country code; Greece uses `GR` addresses but `EL` VAT IDs. | Legitimate Greek B2B buyers rejected. |
| 6.10 | **Concurrent queries inside invoice transaction** | `src/lib/invoices.server.ts:317` uses `Promise.all` over shop orders inside a transaction. | Can fail under multi-shop orders on a single DB connection. |

### Risk: High (several items are individually Critical)

---

## 7. Customer Management from Store-Owner View

### What exists
- Buyer name and masked email visible per order (`src/lib/shop-orders.server.ts`).
- Dispute thread communication.
- Public product reviews visible to owners.
- Admin user management (admin-only).

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 7.1 | **No customer list or customer detail for owners** | No `/studio/$shopId/customers` route or query. | Owners cannot see who bought from them across orders. |
| 7.2 | **No customer search outside orders** | Only order search exposes buyer names. | Impossible to find repeat customers or resolve support issues. |
| 7.3 | **No customer analytics / segmentation** | No lifetime value, order frequency, geography. | Owners cannot run retention or marketing. |
| 7.4 | **No proactive customer contact** | Only dispute thread exists and requires a buyer-initiated dispute. | Owners cannot message buyers about delays, restocks, etc. |
| 7.5 | **Buyer emails masked without opt-in unmasking** | `maskEmail()` in `src/lib/shop-orders.server.ts` hides most of the address. | Owners cannot match buyers to external support/mailing tools. |
| 7.6 | **No customer notes/tags/blacklist** | No schema or UI for owner-specific customer metadata. | No way to flag VIPs or problematic buyers. |
| 7.7 | **No customer export for owners** | CSV export is admin-only. | Owners cannot fulfill tax/accounting needs. |
| 7.8 | **No GDPR tooling for owner-level customer data** | Account deletion handles self-service only; no owner-initiated DSR workflow. | Compliance gap for shop-level data requests. |

### Risk: High

---

## 8. Analytics, Reporting & Dashboards

### What exists
- Creator dashboard with current-month revenue, pending orders, low-stock count, activity feed.
- Admin platform dashboard with KPIs, trends, audit entries.
- Prometheus metrics, Grafana dashboards, Faro RUM, Umami script integration.
- Audit log viewer.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 8.1 | ~~**Homepage still displays one hardcoded stat**~~ **Fixed** | `getMarketplaceStatsQuery` now returns a real country count from distinct shop shipping origins. | Marketing stats are now evidence-based. |
| 8.2 | ~~**Shop dashboard is a stub**~~ **Fixed** | `src/route-components/studio/$shopId.tsx` now shows real pending orders, low-stock count, revenue, and active products with working navigation. | Sellers have operational visibility. |
| 8.3 | ~~**Placeholder shop dashboard API**~~ **Fixed** | `src/routes/api/shops/$shopId/dashboard.ts` now returns real per-shop metrics via `getShopDashboardStatsQuery`. | Studio hub and future clients can fetch real metrics. |
| 8.4 | **No per-shop sales/revenue reporting** | Creator dashboard only shows current-month aggregates. | Owners cannot analyze business performance. |
| 8.5 | **CSV export utility unused** | `src/lib/csv-export.ts` exists but is not wired to any report. | No data export for accounting. |
| 8.6 | ~~**Revenue figure is gross, not net**~~ **Fixed** | `getShopDashboardStatsQuery` returns `netRevenueThisMonthCents` (gross minus refunds minus platform fee). | Sellers see a realistic net earnings figure. |
| 8.7 | ~~**Metrics endpoint open by default**~~ **Fixed** | `/api/metrics` requires a bearer or query-param token when `METRICS_TOKEN` is set; `instrument.server.mjs` refuses to start in production if `METRICS_TOKEN` is missing. | Metrics are no longer publicly scrapeable in production. |

### Risk: High

---

## 9. Security, Authorization & GDPR

### What exists
- Better Auth with email verification, password reset, TOTP 2FA, session token hashing.
- Role hierarchy (`customer` < `creator` < `admin`), route guards, CSRF validation.
- PostgreSQL-backed rate limiting, account lockout, CSP nonces.
- GDPR self-service export and account deletion.
- Audit logging table and admin viewer.
- Webhook HMAC verification, input validation, XSS sanitization.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 9.1 | ~~**Grafana exposed without IP restriction**~~ **Fixed** | `Caddyfile` now restricts `/grafana*` to `GRAFANA_ADMIN_IPS` and defaults to `0.0.0.0/32` when the variable is unset. | Grafana is no longer publicly reachable. |
| 9.2 | ~~**No analytics consent banner**~~ **Fixed** | `AnalyticsConsentBanner` is rendered in `__root.tsx`; Umami is only loaded after the user gives consent. | GDPR/ePrivacy-compliant analytics loading. |
| 9.3 | ~~**Edge CSP weakens nonce policy**~~ **Fixed** | `Caddyfile` baseline CSP no longer includes `script-src 'unsafe-inline'`; external script origins are limited to known CDN/analytics hosts. | Edge responses are protected by a strict CSP. |
| 9.4 | **Account deletion is incomplete** | `src/lib/account-data.server.ts` does not block deletion for shops in review/suspended; retains PII in payouts/invoices/labels/audit logs. | Right-to-erasure gaps. |
| 9.5 | **2FA enforcement inconsistent** | `/studio` routes do not enforce `guardPrivilegedRole` (2FA); only `/creator` layout does. | Compromised passwords can access orders/payouts without 2FA. |
| 9.6 | **Hardcoded invoice identity** | `EURTISAN_BILLING_PARTY` in `src/lib/invoices.server.ts:96-106`. | Legally binding documents may contain wrong entity data. |
| 9.7 | **Admin read-only actions not audited** | Order detail, user list, payout history access are not logged. | Weakened GDPR accountability/incident response. |
| 9.8 | **Brittle authz casts** | Multiple handlers pass `session: {} as never` to `requireRole`. | Type safety bypassed; future refactor risk. |

### Risk: Critical / High

---

## 10. Production Readiness: Deployment, Monitoring, Jobs, Backups

### What exists
- Ansible provisioning, Docker Compose environments, production Dockerfile, Caddy reverse proxy.
- Health/ready/live endpoints, Prometheus metrics, structured logging, Grafana/Loki/Tempo/Prometheus stack.
- Job scripts for inventory cleanup, Meilisearch sync, audit/cart/session/verification cleanup, payout reconciliation, Sendcloud reconciliation.
- Nightly DB backup with test restore.
- Runbooks and data-retention policy.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 10.1 | **Sensitive deployment files in working tree** | `infrastructure/ansible/inventory/staging.yml`, `secrets.yml`, `.vault_pass`, `.env.local` exist locally but are all listed in `.gitignore`. | Credential leakage risk if copied/committed; ensure pre-commit hook is enabled and files are never force-added. |
| 10.2 | ~~**Observability stack wired for Coolify, not standalone production**~~ **Fixed** | `infra/observability/docker-compose.observability.yml` now uses the external `eurtisan` network and `alloy/config.alloy` reads `APP_CONTAINER_NAME` from env. | Self-hosted Grafana/Loki/Tempo/Prometheus stack is topology-agnostic for Ansible/VPS deployments. |
| 10.3 | ~~**Required cleanup jobs not running**~~ **Fixed** | `docker-compose.prod.yml` and `docker-compose.staging.yml` now run `session-cleanup`, `cart-cleanup`, `audit-log-cleanup`, `verification-cleanup`, and `sendcloud-reconciliation` alongside the existing jobs. | Retention policies are enforced automatically; Sendcloud backfill runs continuously. |
| 10.4 | **Backup strategy inconsistent and incomplete** | Retention values conflict (7 vs 30 days); offsite upload not implemented; WAL archiving disabled; S3/Meilisearch not backed up. | RPO/RTO targets not achievable; image assets could be lost. |
| 10.5 | **Manual deployment with incomplete rollback** | `infrastructure/ansible/files/deploy.sh` rolls back image tags but cannot roll back schema; no post-deploy smoke tests. | Failed migrations can leave production inconsistent. |
| 10.6 | ~~**Caddy may fail to start / expose Grafana**~~ **Fixed** | `Caddyfile` now restricts `/grafana*` to `GRAFANA_ADMIN_IPS` (default blocks all) and uses only built-in `gzip zstd` compression (brotli removed). | Site starts with the standard Caddy image and Grafana is not public. |
| 10.7 | ~~**Health checks inaccurate**~~ **Fixed** | Disk check now respects `HEALTH_DISK_PATH` (default `/`) and staging app healthcheck uses `/api/health/ready`. | Health/ready probes reflect real data-volume space and app readiness. |
| 10.8 | **No alerting beyond backup failures** | No Alertmanager/Grafana alerting for health/job/disk issues. | Operations team not notified of degradation. |

### Risk: Critical

---

## Cross-Cutting Themes

1. **Mocks and placeholders in production paths.** Several critical integrations (Mollie fallback, mock OAuth) silently degrade to mock behavior rather than failing closed. The Sendcloud shipping integration now fails closed; payouts must do the same.
2. **Incomplete owner financial control.** Payouts call Mollie routes but the surrounding production surface (mock routes, env docs, reconciliation) is not yet hardened. Owner-initiated refunds and credit notes are still missing.
3. **Navigation and UI wiring defects.** Product edit links, post-approval payment links, and studio settings links are now fixed.
4. **GDPR/compliance operational gaps.** Analytics consent, incomplete erasure, public Grafana, and weak edge CSP need attention before launch.
5. **Observability and operability partially aligned.** The self-hosted Grafana stack is now topology-agnostic and required cleanup jobs are scheduled. Backup/rollback/alerting gaps remain.
6. **Audit logging is incomplete.** Owner-side mutations (products, orders, settings) are largely unlogged, while admin mutations are logged.

---

## Recommended Pre-Launch Priority List

### P0 — Launch blockers (do not ship without these)
1. ~~**Strip Mollie mock OAuth/payment routes from production builds** and fail closed if mock env vars are enabled in production.~~ **Done**
2. ~~**Document `MOLLIE_CLIENT_ID`/`MOLLIE_CLIENT_SECRET`** in env examples and AGENTS.md; wire `job:payout-reconciliation` into compose/deploy.~~ **Done**
3. ~~**Expand payout reconciliation** to handle `returned` routes and remove the silent `catch` in payout-sent notifications.~~ **Done**
4. ~~**Lock down Grafana** with IP allow-list, **implement analytics consent banner**, and **harden edge CSP**.~~ **Done**
5. ~~**Align observability topology** for standalone Ansible/VPS production.~~ **Done**
6. ~~**Replace hardcoded "27 countries"** on the homepage with a real count.~~ **Done**
7. ~~**Add owner-initiated post-payment refunds** and **credit notes**; move invoices to sequential numbering.~~ **Done**
8. ~~**Schedule all required cleanup jobs** in production/staging compose and fix health checks.~~ **Done**

### P1 — High impact, short-term
9. ~~Implement store-owner order cancellation and refund flow.~~ **Done for refunds; cancellation remains buyer-only while pending_payment.**
10. Implement shop closure/archive/delete and owner-initiated shop pause.
11. Complete shop settings form (banner, policies, socials, announcement, full shipping origin).
12. Add product variant management UI and server functions.
13. Fix broken product/admin thumbnails (use `getImageUrl`).
14. ~~Implement credit notes / invoice cancellation on refunds and sequential invoice numbering.~~ **Done**
15. Fix backup retention/offsite and document exclusions.
16. ~~Fix Caddyfile brotli plugin dependency and edge CSP.~~ **Done**

### P2 — Medium impact, near-term
17. Add customer list/detail/export for store owners.
18. Add per-shop sales/revenue/VAT reports and CSV exports.
19. Add low-stock notifications and owner-configurable thresholds.
20. Add audit logging for all owner mutations (products, orders, settings).
21. Complete account deletion erasure for retained PII and document retention exceptions.
22. Enforce 2FA on all `/studio` and `/creator` routes.
23. Add shipping-rate management (zones, flat rates, free-shipping thresholds, handling times).
24. Add label cancellation/return labels/bulk printing.

---

## Questions for the Product/Engineering Team

1. **Sendcloud scope:** Remaining open questions: return labels, bulk printing, and owner-configurable shipping rules.
2. **Payout execution:** Confirmed Mollie Connect payouts.
3. **Payment mock policy:** Should `MOCK_PAYMENTS_ENABLED` and the mock OAuth route be statically removed/disabled in production builds?
4. ~~**Invoice numbering:** Should invoice numbers be globally sequential, per-shop sequential, or per-year sequential?~~ **Decision: per-prefix/year sequential (`INV-YYYY-NNNNN`, `INV-FEE-YYYY-NNNNN`, `CN-YYYY-NNNNN`).**
5. ~~**Refund ownership:** Should store owners issue partial/full refunds directly, or must all refunds flow through admin dispute resolution?~~ **Decision: owners issue full refunds on a per-shop-order basis; disputes remain for contested cases.**
6. **Customer contact:** Should owners see unmasked buyer emails, or should contact be mediated through the platform?
7. **2FA policy:** Should 2FA be mandatory for all creator actions, or only financial/admin actions?
8. **Deployment topology:** Confirmed standalone VPS with Ansible.
9. **Backup targets:** Are WAL archiving, offsite backups, and S3/Meilisearch backups required before launch?
10. **Store-owner dashboard scope:** What per-shop analytics are required for MVP (sales trend, top products, net earnings, buyer geography)?

---

## Conclusion

Eurtisan’s architecture is production-grade in intention, and the original five North Star blockers have been substantially advanced. The remaining gaps are concentrated in **payout production-hardening**, **financial/order lifecycle**, **security/compliance**, and **production operability**. Treat the refreshed P0 items as launch blockers; the P1 and P2 items should be on the immediate post-P0 roadmap so that store owners can honestly operate, support customers, and reconcile their business once the platform is live.
