# Store-Owner Production Readiness Audit — Eurtisan

**Date:** 2026-06-12  
**Auditor:** Kimi Code CLI (multi-agent evidence gathering)  
**Scope:** Store-owner capabilities across the Eurtisan marketplace application. The audit assumes the perspective of a seller/shop owner who must fully control their store, products, orders, customers, payouts, taxes, and operational visibility before the platform launches to production.  
**Method:** Read-only codebase review by parallel domain agents; no runtime tests or commits performed.

**Strategic update:** Following the audit, the shipping carrier objective has been changed from Mondial Relay to **Sendcloud**. The findings below still describe the current Mondial Relay implementation as evidence, but the planned production integration is now Sendcloud.

---

## Executive Summary

Eurtisan has a solid architectural foundation (TanStack Start, Better Auth, Drizzle/PostgreSQL, Meilisearch, Docker-first workflows, observability stack, GDPR-aware data-export hooks, and a well-modeled order/payout schema). However, **from a store-owner perspective the application is not yet production-ready**. Several core owner workflows are broken, mocked, or missing entirely. The most severe launch blockers are:

1. **Fake shipping carrier integration (plan: Sendcloud)** — store owners cannot generate real labels or track real packages; the Mondial Relay implementation is mocked and must be replaced with Sendcloud.
2. **Payouts are only a status flag** — no actual money movement to seller bank accounts is implemented.
3. **Broken owner navigation** — product edit links and post-approval payment-setup links lead to non-existent routes.
4. **Public Grafana and weak edge CSP** — infrastructure exposure risks.
5. **Missing analytics consent** — GDPR/ePrivacy compliance gap.
6. **Placeholder shop dashboard and fake homepage stats** — store owners have no operational visibility.

Overall risk: **Critical / High**. The items below must be resolved (or explicitly accepted and mitigated) before a store owner can honestly run a business on Eurtisan.

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
- Mondial Relay label generation and manual tracking entry.
- State machine for status transitions (`VALID_TRANSITIONS` in `src/lib/shop-orders.server.ts`).
- Mollie webhook handling for paid/expired/chargeback; inventory decrement; invoice generation.
- Dispute thread for buyers/sellers/admins.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 3.1 | **Store owner cannot cancel/refund after payment** | `cancelOrderQuery` only allows `pending_payment`; `VALID_TRANSITIONS` blocks `cancelled` from paid states. | Owners cannot handle out-of-stock or problematic orders without buyer dispute escalation. |
| 3.2 | **No edit tracking after shipment** | `markShopOrderShippedQuery` supports idempotent tracking updates, but the UI only exposes it during initial ship. | Sellers cannot correct tracking numbers/URLs. |
| 3.3 | **Shipping carrier is fully mocked** | `src/integrations/shipping/mondial-relay-provider.ts` logs a warning and returns fake rates/labels/tracking when API key is missing. | Real physical fulfillment is impossible. |
| 3.4 | **Mollie payment provider defaults to mock mode** | `src/integrations/mollie/mollie-payment-provider.ts` enters mock mode when `MOLLIE_API_KEY` is absent (fatal only in production if env is set). | Misconfigured env risks fake money flows. |
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
| 4.1 | **Payouts are never executed** | `markPayoutSentQuery` only updates the local `payout` row status; no call to Mollie/SEPA/any rail. | Store owners do not receive money. Production launch is blocked. |
| 4.2 | **Mollie Connect credentials undocumented** | `MOLLIE_CLIENT_ID` and `MOLLIE_CLIENT_SECRET` are read but absent from `.env.example`, `src/lib/env.server.ts`, and `AGENTS.md`. | Operators will not know these are required for live seller onboarding. |
| 4.3 | **Mock payment/OAuth routes remain available** | `src/route-components/mollie-mock-oauth.tsx` and `MOCK_PAYMENTS_ENABLED` are registered unconditionally. | Misconfigured production can process fake payments/onboarding. |
| 4.4 | **No payout reconciliation or failure states** | `payout` enum only supports `pending`/`sent`; no `failed`/`returned`/`reversed`. | Discrepancies between DB and bank transfers are invisible. |
| 4.5 | **Payout status enum mismatch** | DB enum is `pending`/`sent`, but code/UI render/use `processing`. | Confusing model; DB filtering by `processing` is impossible. |
| 4.6 | **Silent failure on payout-sent notification** | `src/lib/payouts.server.ts:96-107` has empty `catch { // swallow }`. | Sellers may never be notified of payout status. |
| 4.7 | **No seller withdrawal preferences** | No minimum threshold, payout schedule, or withdrawal request. | Does not meet marketplace expectations. |
| 4.8 | **Hardcoded platform fee and billing identity** | `PLATFORM_FEE_PERCENT = 10` in `src/lib/platform-constants.ts`; `EURTISAN_BILLING_PARTY` hardcoded in `src/lib/invoices.server.ts:96-106`. | Business changes require code deployment. |
| 4.9 | **Financial types use `any`** | `createInvoicesForPlatformOrder(tx?: any)` and `getInvoiceByIdQuery(): Promise<any>`. | Type safety weakened on critical financial data. |

### Risk: Critical

---

## 5. Shipping & Delivery

### What exists
- Shop-level shipping origin address capture.
- Checkout shipping-option calculation with a mocked Mondial Relay rates provider and a `manual` fallback.
- Pick-up point selector UI.
- Label generation + tracking number entry in the ship dialog.
- Buyer tracking status display.

> **Planned direction:** Replace the mocked Mondial Relay integration with a genuine **Sendcloud** integration for labels, rates, and tracking.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 5.1 | **Carrier API is mocked** | `src/integrations/shipping/mondial-relay-provider.ts` returns deterministic fake rates/labels/tracking. Sendcloud integration does not yet exist. | No real labels, no real tracking. |
| 5.2 | **Only one carrier supported** | `src/lib/shipping.ts` only handles `mondial_relay`. Sendcloud carrier abstraction is not yet implemented. | Owners cannot offer DHL/Colissimo/etc. |
| 5.3 | **Pick-up point selector uses mock data** | `src/components/checkout/PickupPointSelectorModal.tsx` returns fake points regardless of input. | Buyers cannot choose real pick-up points. |
| 5.4 | **No product weight/dimensions** | `src/db/schema.ts` `product` table lacks weight/dimensions; estimates use `500 g` per item. | Shipping rates are inaccurate. |
| 5.5 | **No owner shipping-rate management** | No `/studio/$shopId/shipping` route; no free-shipping thresholds, flat rates, zones, handling times. | Owners cannot control shipping economics. |
| 5.6 | **Hardcoded platform default origin** | `getPlatformOrigin()` in `src/lib/checkout.server.ts:164` returns Berlin. | Wrong fallback for non-DE sellers. |
| 5.7 | **No label cancellation/refund workflow** | Once a label is generated, it cannot be voided. | Cost recovery impossible on cancelled orders. |
| 5.8 | **No bulk label printing** | Ship dialog is one order at a time. | Inefficient at scale. |
| 5.9 | **No real tracking webhooks** | Tracking is polled synchronously with a 1-second timeout. | Delivery events are delayed/unreliable. |

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
| 6.1 | **No credit notes / invoice cancellation on refunds** | Refunds via disputes do not amend original invoices. | EU tax law requires correcting documents for refunded sales. |
| 6.2 | **Invoice numbers are not sequential** | `src/lib/invoices.server.ts:360,415` uses UUID-based numbers `INV-${so.id}`. | Most EU jurisdictions require continuous invoice numbering. |
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
| 8.1 | **Homepage displays fake stats** | `src/components/home/HomeStatsStrip.tsx` shows `120` makers, `1450` products, `27` countries when real counts are empty. | Misleading marketing/regulatory risk. |
| 8.2 | **Shop dashboard is a stub** | `src/route-components/studio/$shopId.tsx` only links to Orders and Settings. | No per-shop analytics, sales trends, top products. |
| 8.3 | ~~**Placeholder shop dashboard API**~~ **Fixed** | `src/routes/api/shops/$shopId/dashboard.ts` now returns real per-shop metrics via `getShopDashboardStatsQuery`. | Studio hub and future clients can fetch real metrics. |
| 8.4 | **No per-shop sales/revenue reporting** | Creator dashboard only shows current-month aggregates. | Owners cannot analyze business performance. |
| 8.5 | **CSV export utility unused** | `src/lib/csv-export.ts` exists but is not wired to any report. | No data export for accounting. |
| 8.6 | **Revenue figure is gross, not net** | `src/lib/creator-dashboard.server.ts:121-128` sums `subtotalCents` without fees/refunds. | Misleading financial planning. |
| 8.7 | **Metrics endpoint open by default** | `src/routes/api/metrics.ts` allows unauthenticated access when `METRICS_TOKEN` is unset. | Leaks operational internals. |

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
| 9.1 | **Grafana exposed without IP restriction** | `Caddyfile:14-19` has a TODO and the IP allow-list is commented out. | Public access to logs/traces/metrics. |
| 9.2 | **No analytics consent banner** | Umami script loads unconditionally; no consent UI. | GDPR/ePrivacy risk. |
| 9.3 | **Edge CSP weakens nonce policy** | `Caddyfile:68` includes `script-src 'self' 'unsafe-inline'` and external origins. | Inline XSS payloads become possible. |
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
- Job scripts for inventory cleanup, Meilisearch sync, audit/cart/session/verification cleanup.
- Nightly DB backup with test restore.
- Runbooks and data-retention policy.

### Critical / High gaps
| # | Gap | Evidence | Owner impact |
|---|-----|----------|--------------|
| 10.1 | **Sensitive deployment files in working tree** | `infrastructure/ansible/inventory/staging.yml`, `secrets.yml`, `.vault_pass`, `.env.local` exist locally. | Credential leakage risk if copied/committed. |
| 10.2 | **Observability stack wired for Coolify, not standalone production** | `infra/observability/docker-compose.observability.yml` expects external `coolify` network; `alloy/config.alloy` hardcodes `/eurtisan-app-staging`. | Self-hosted stack will not collect production logs/traces. |
| 10.3 | **Required cleanup jobs not running** | Only `inventory-cleanup` and `meilisearch-sync` are in `docker-compose.prod.yml`/`staging.yml`; session/cart/verification/audit-log cleanup have scripts but no scheduler. | Tables grow indefinitely; violates retention policy. |
| 10.4 | **Backup strategy inconsistent and incomplete** | Retention values conflict (7 vs 30 days); offsite upload not implemented; WAL archiving disabled; S3/Meilisearch not backed up. | RPO/RTO targets not achievable; image assets could be lost. |
| 10.5 | **Manual deployment with incomplete rollback** | `infrastructure/ansible/files/deploy.sh` rolls back image tags but cannot roll back schema; no post-deploy smoke tests. | Failed migrations can leave production inconsistent. |
| 10.6 | **Caddy may fail to start / expose Grafana** | `Caddyfile` TODO for admin IPs; `encode brotli gzip zstd` requires a plugin not in default Caddy image. | Site unreachable or Grafana public. |
| 10.7 | **Health checks inaccurate** | Disk check uses `/tmp`, not actual data volumes; staging healthcheck uses `/` not `/api/health/ready`. | False confidence in monitoring. |
| 10.8 | **No alerting beyond backup failures** | No Alertmanager/Grafana alerting for health/job/disk issues. | Operations team not notified of degradation. |

### Risk: Critical

---

## Cross-Cutting Themes

1. **Mocks and placeholders in production paths.** Multiple critical integrations (Mondial Relay shipping, Mollie fallback, homepage stats, dashboard API, settings API) silently degrade to mock/placeholder behavior rather than failing closed. The shipping objective has been updated to Sendcloud.
2. **Incomplete owner financial control.** Payouts are the most glaring gap: owners can see derived amounts but cannot receive money, set schedules, or reconcile transfers.
3. **Navigation and UI wiring defects.** Product edit links, post-approval payment links, and studio settings links are broken or point to stubs.
4. **GDPR/compliance operational gaps.** Analytics consent, incomplete erasure, public Grafana, and weak edge CSP need attention before launch.
5. **Observability and operability mismatched to deployment topology.** The self-hosted Grafana stack appears configured for a Coolify staging environment, not standalone production.
6. **Audit logging is incomplete.** Owner-side mutations (products, orders, settings) are largely unlogged, while admin mutations are logged.

---

## Recommended Pre-Launch Priority List

### P0 — Launch blockers (do not ship without these)
1. Integrate a real payment rail for payouts or clearly block launch until Mollie Connect payouts are implemented and reconciled.
2. Integrate a real **Sendcloud** API for labels, rates, and tracking; remove silent mock fallbacks in production.
3. Fix broken owner navigation: product edit link, post-approval payment activation link, studio settings link.
4. Remove/replace fake homepage stats; implement real per-shop dashboard metrics.
5. Lock down Grafana (IP whitelist) and implement analytics consent banner.
6. Add payout environment variables to `.env.example` and deployment docs; remove mock OAuth route from production builds.

### P1 — High impact, short-term
7. Implement store-owner order cancellation and refund flow.
8. Implement shop closure/archive/delete and owner-initiated shop pause.
9. Complete shop settings form (banner, policies, socials, announcement, full shipping origin).
10. Add product variant management UI and server functions.
11. Fix broken product/admin thumbnails (use `getImageUrl`).
12. Implement credit notes / invoice cancellation on refunds and sequential invoice numbering.
13. Run missing cleanup jobs in production (session, cart, verification, audit-log).
14. Fix Caddyfile brotli plugin dependency and edge CSP.

### P2 — Medium impact, near-term
15. Add customer list/detail/export for store owners.
16. Add per-shop sales/revenue/VAT reports and CSV exports.
17. Add low-stock notifications and owner-configurable thresholds.
18. Add audit logging for all owner mutations (products, orders, settings).
19. Complete account deletion erasure for retained PII and document retention exceptions.
20. Enforce 2FA on all `/studio` and `/creator` routes.
21. Add shipping-rate management (zones, flat rates, free-shipping thresholds, handling times).
22. Add product weight/dimensions for accurate shipping estimates.

---

## Questions for the Product/Engineering Team

1. **Sendcloud scope:** Should Sendcloud be the sole carrier at launch, or should the integration be built as a multi-carrier abstraction from day one? Which Sendcloud features are required first (labels, rates, tracking, pick-up points, return labels)?
2. **Payout execution:** What is the target payout rail (Mollie Connect payouts, manual SEPA batch, third-party)?
3. **Payment mock policy:** Should `MOCK_PAYMENTS_ENABLED` and the mock OAuth route be statically removed/disabled in production builds?
4. **Invoice numbering:** Should invoice numbers be globally sequential, per-shop sequential, or per-year sequential?
5. **Refund ownership:** Should store owners issue partial/full refunds directly, or must all refunds flow through admin dispute resolution?
6. **Customer contact:** Should owners see unmasked buyer emails, or should contact be mediated through the platform?
7. **2FA policy:** Should 2FA be mandatory for all creator actions, or only financial/admin actions?
8. **Deployment topology:** Is production intended to run behind Coolify, or should the observability stack work on a standalone VPS?
9. **Backup targets:** Are WAL archiving, offsite backups, and S3/Meilisearch backups required before launch?
10. **Store-owner dashboard scope:** What per-shop analytics are required for MVP (sales trend, top products, net earnings, buyer geography)?

---

## Conclusion

Eurtisan’s architecture is production-grade in intention, but the current implementation leaves a store owner without control over the most business-critical parts of their shop: real shipping, real payouts, reliable navigation, accurate analytics, and compliance tooling. The gaps are concentrated in **fulfillment integrations**, **financial operations**, **owner dashboards**, and **production hardening**. Treat the P0 items as launch blockers; the P1 and P2 items should be on the immediate post-P0 roadmap so that store owners can honestly operate, support customers, and reconcile their business once the platform is live.
