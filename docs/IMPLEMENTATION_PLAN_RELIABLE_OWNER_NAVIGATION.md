# Implementation Plan — Reliable Owner Navigation

**North Star Objective:** #3 — Reliable owner navigation  
**Audit Source:** `docs/AUDIT_STORE_OWNER_2026-06-12.md`  
**Date:** 2026-06-13  
**Status:** Draft — ready for engineering review  
**Commit Policy:** Do not commit this plan file; it is a working document.

---

## 1. Executive Summary

Store owners cannot reliably move through Eurtisan's seller-facing UI. The audit identified three broken navigation paths that are P0 launch blockers:

1. **Post-approval payment activation link is a 404.** `src/route-components/sell/status/$shopId.tsx` links to `/sell/shops/$shopId/payment`, which does not exist.
2. **Product edit links from the owner catalog go nowhere useful.** `src/components/product/ProductTableRow.tsx` links to `/studio/$shopId?productId=...&tab=products`, but `/studio/$shopId` is a stub that does not read `tab=products` and has no product editor.
3. **Studio settings link points back to the same stub.** `src/route-components/studio/$shopId.tsx` renders a "Settings" card whose `to` prop is `/studio/$shopId`, so clicking it reloads the same stub page.

In addition, the following navigation-adjacent defects directly undermine owner confidence and must be fixed in the same effort:

- Broken product thumbnails in the owner catalog and admin catalog (raw S3 keys rendered as `src`).
- The `/api/shops/$shopId/settings` endpoint is a placeholder that returns JSON without persisting anything.
- The `/api/shops/$shopId/dashboard` endpoint is a placeholder returning `{"message":"Dashboard data"}`.
- The `/studio/$shopId` dashboard is a stub with only Orders and a broken Settings card, and it shows no useful shop data.
- The Mollie Connect OAuth callback silently falls back to mock credentials in non-production environments and marks shops `paymentConnected: true`.

This plan defines a minimal, cohesive set of changes that restore honest, reliable navigation for store owners while preserving existing architecture and staying within the scope of objective #3.

---

## 2. Scope

### In scope

1. Fix the post-approval payment activation link and route.
2. Fix the product edit link from the owner product catalog.
3. Fix the studio settings link and provide a real settings destination.
4. Replace placeholder `/api/shops/$shopId/settings` with a real, persisted settings endpoint.
5. Fix broken product thumbnails in owner and admin product lists.
6. Replace the `/studio/$shopId` stub dashboard with a useful, honest navigation hub **showing real per-shop metrics**.
7. Replace placeholder `/api/shops/$shopId/dashboard` with a real per-shop metrics endpoint used by the hub.
8. Add and update automated tests covering the fixed navigation paths.
9. Update i18n messages for any new UI copy.
10. Update documentation (`AGENTS.md`, `.env.example` if new env vars are introduced).

### Out of scope (documented explicitly to prevent drift)

- Real payout execution (objective #1).
- Sendcloud shipping integration (objective #2).
- Full shop settings form completion (banner, policies, socials, announcement, business address). Only the navigation destination and the existing form fields are fixed here.
- Redesign of `/studio/` index route or consolidation of `/studio` vs `/creator` surfaces.
- New customer list, VAT reports, or full analytics dashboards.
- Broad refactors of authz, styling, or route layout conventions.

---

## 3. Current State & Root Cause Analysis

### 3.1 Post-approval payment link (404)

**File:** `src/route-components/sell/status/$shopId.tsx:35`

```tsx
cta: { label: m.onboarding_status_approved_cta(), href: '/sell/shops/$shopId/payment' }
```

**Problem:** Route `/sell/shops/$shopId/payment` does not exist in `src/routeTree.gen.ts`. The approved seller therefore lands on a 404 when trying to connect payouts.

**Root cause:** The onboarding status page was wired to a route that was never implemented. The real payout onboarding flow lives under `/creator/payouts?shopId=...`, which already contains the Mollie Connect card.

**Fix direction:** Change the CTA to `/creator/payouts?shopId=${shopId}` and pre-select the shop in the URL. Optionally add a `from=onboarding_approved` query parameter for analytics/UX personalization.

### 3.2 Product edit link (broken destination)

**File:** `src/components/product/ProductTableRow.tsx:146-156`

```tsx
<Link
  to='/studio/$shopId'
  params={{ shopId: currentShopId }}
  search={{ productId: product.id, tab: 'products' }}
  ...
>
```

**Problem:** `/studio/$shopId` does not handle `productId` or `tab=products`. The actual product editor is `/creator/products/$productId/edit`.

**Root cause:** The product list was wired to a planned-but-never-built studio tab interface. The working editor exists under `/creator/products`.

**Fix direction:** Change the edit link to `/creator/products/$productId/edit`. The `currentShopId` context is irrelevant for editing because the editor loads its own shops and product detail.

### 3.3 Studio settings link (self-referential)

**File:** `src/route-components/studio/$shopId.tsx:36-47`

```tsx
<Link to='/studio/$shopId' params={{ shopId }} ...>
  <h2>Settings</h2>
</Link>
```

**Problem:** The Settings card navigates to the same page it is already on.

**Root cause:** Placeholder wiring.

**Fix direction:** Point the Settings card to `/creator/shop?shopId=${shopId}`, the existing shop settings route.

### 3.4 Placeholder settings API

**File:** `src/routes/api/shops/$shopId/settings.ts`

The `GET` and `PATCH` handlers return JSON without reading from or writing to the database.

**Problem:** Any client or future mobile app calling this endpoint believes settings are saved when they are not.

**Fix direction:** Implement it properly by delegating to `getCreatorShop` (GET) and `updateShop` (PATCH). Product confirmed no external callers, so no backward-compatibility constraints apply.

### 3.5 Broken product thumbnails

**Files:**
- `src/components/product/ProductTableRow.tsx:44` — owner catalog
- `src/route-components/admin/products.tsx:473-477` — admin catalog

Both render `product.thumbnailUrl` directly. The value stored in the database is an S3 object key, not a browser-accessible URL. The project already provides `getImageUrl(key, options)` in `src/lib/image-url.ts`.

**Fix direction:** Wrap the key with `getImageUrl(..., { width: 80, format: 'webp' })` in both locations. Add `alt=""` (already present in owner row) because adjacent text describes the product.

### 3.6 Studio dashboard stub

**File:** `src/route-components/studio/$shopId.tsx`

The dashboard only shows Orders and a broken Settings card. It does not link to Products, Payouts, or Shop Settings honestly, and it shows no useful shop data.

**Fix direction:** Replace the stub with a small navigation hub that links to the real destinations and displays real per-shop metrics:
- Orders → `/studio/$shopId/orders`
- Products → `/creator/products?shopId=$shopId`
- Payouts → `/creator/payouts?shopId=$shopId`
- Settings → `/creator/shop?shopId=$shopId`
- Metrics cards: pending orders, low-stock products, current-month revenue, total active products.

Keep the page honest: no fake numbers, no placeholder copy.

### 3.7 Mollie Connect mock fallback

**File:** `src/routes/api/auth/mollie/callback.ts:63-84`

When `MOLLIE_CLIENT_ID` or `MOLLIE_CLIENT_SECRET` is missing, the callback generates `org_mock_...` and marks the shop `paymentConnected: true`, except in production where it returns 502.

**Problem:** In staging or misconfigured non-production environments, sellers appear connected without real credentials. This is adjacent to navigation because the post-approval flow leads directly here.

**Fix direction:** Remove the mock fallback entirely. If credentials are missing, return 502 in all environments. Only real Mollie Connect exchanges should mark a shop as `paymentConnected`. Update `MOLLIE_CLIENT_ID` and `MOLLIE_CLIENT_SECRET` documentation in `.env.example` and `AGENTS.md`.

---

## 4. Implementation Phases

### Phase 0 — Preparation & Safety (0.5–1 day)

1. **Verify route tree.** Run `bun run dev` or `bunx @tanstack/router-generator` after any file changes to regenerate `routeTree.gen.ts`.
2. **Add targeted e2e or component tests** for the broken paths before changing code, so failures are observed first.
3. **Confirm no external callers** of `/api/shops/$shopId/settings` or `/api/shops/$shopId/dashboard`; implement real endpoints because they are part of the documented API surface.
4. **Confirm i18n key naming conventions** by reviewing `messages/en.json` and `messages/nl.json`.

### Phase 1 — Quick Navigation Fixes (1 day)

1. **Fix post-approval payment link.**
   - File: `src/route-components/sell/status/$shopId.tsx`
   - Change CTA `href` from `/sell/shops/$shopId/payment` to `/creator/payouts`.
   - Pass `search: { shopId: status.id }`.
   - Keep the interaction simple: the owner lands on the payouts page with the correct shop already selected. No auto-scroll or focus management is required for MVP.

2. **Fix product edit link.**
   - File: `src/components/product/ProductTableRow.tsx`
   - Change Link `to` from `/studio/$shopId` to `/creator/products/$productId/edit`.
   - Remove `tab` and `productId` search params; pass `params: { productId: product.id }`.
   - Remove the now-unnecessary `currentShopId` guard for the edit link if desired, or keep it for consistency.

3. **Fix studio settings link.**
   - File: `src/route-components/studio/$shopId.tsx`
   - Change Settings card `to` from `/studio/$shopId` to `/creator/shop`.
   - Pass `search: { shopId }`.

4. **Fix product thumbnails.**
   - File: `src/components/product/ProductTableRow.tsx`
   - Wrap `product.thumbnailUrl` with `getImageUrl(product.thumbnailUrl, { width: 80, format: 'webp' })`.
   - File: `src/route-components/admin/products.tsx`
   - Wrap `p.thumbnailUrl` similarly.

### Phase 2 — Replace Studio Stub Dashboard (1 day)

1. **Add per-shop metrics query.**
   - File: `src/lib/creator-dashboard.server.ts`
   - Add `getShopDashboardStatsQuery(shopId: string)` that returns:
     - `pendingOrdersCount`
     - `lowStockProductCount`
     - `revenueThisMonthCents`
     - `totalActiveProducts`
   - Reuse existing status constants (`PENDING_STATUSES`, `REVENUE_STATUSES`) and query patterns from `getCreatorDashboardStatsQuery`.

2. **Implement real dashboard API.**
   - File: `src/routes/api/shops/$shopId/dashboard.ts`
   - Replace placeholder response with a call to `getShopDashboardStatsQuery(params.shopId)`.
   - Return the metrics as JSON.

3. **Wire metrics into the studio route loader.**
   - File: `src/routes/studio/$shopId.tsx`
   - Extend the loader to fetch stats via `getShopDashboardStatsQuery` and pass them to `ShopDashboard`.
   - Keep `guardShopOwnership` in `beforeLoad`.

4. **Design the hub.**
   - File: `src/route-components/studio/$shopId.tsx`
   - Replace the two-card stub with:
     - A metrics summary row (pending orders, low stock, revenue, active products).
     - A clear navigation grid:
       - **Orders** — manage and fulfill orders.
       - **Products** — edit catalog.
       - **Payouts** — connect Mollie and view payouts.
       - **Settings** — shop profile, VAT, shipping origin.
   - Use existing Lucide icons and Tailwind classes. Keep copy in `m.*` messages.

5. **Add i18n keys.**
   - Add to `messages/en.json` and `messages/nl.json`:
     - `studio_nav_orders`
     - `studio_nav_orders_desc`
     - `studio_nav_products`
     - `studio_nav_products_desc`
     - `studio_nav_payouts`
     - `studio_nav_payouts_desc`
     - `studio_nav_settings`
     - `studio_nav_settings_desc`
     - `studio_dashboard_title`
     - `studio_dashboard_description`
     - `studio_metric_pending_orders`
     - `studio_metric_low_stock`
     - `studio_metric_revenue_this_month`
     - `studio_metric_active_products`
   - Run `bun run i18n:compile`.

6. **Accessibility.**
   - Ensure each card is an `<a>` or `<Link>` with a visible label.
   - Metrics are read-only summary values; ensure they are not hidden from assistive tech.
   - Maintain keyboard focusability and clear hover/focus states.

### Phase 3 — Real Settings API (1 day)

1. **Implement GET.**
   - File: `src/routes/api/shops/$shopId/settings.ts`
   - Call `getCreatorShop({ data: { shopId: params.shopId } })` or equivalent internal query.
   - Return the same shape as `CreatorShopDetail`.

2. **Implement PATCH.**
   - Validate body with `updateShopSchema` (omit `shopId`, inject from path).
   - Call `updateShop` server function or the internal `updateShopInternal`.
   - Return the updated record.

3. **Authorization.**
   - Reuse `requireRole('creator')` and `requireShopOwnership` from `src/lib/authz`.

4. **Tests.**
   - Add unit/integration tests for GET and PATCH.
   - Verify 403 when user does not own the shop.
   - Verify 409 on slug collision.

### Phase 4 — Harden Mollie Connect Callback (0.5 day)

1. **Remove mock fallback.**
   - File: `src/routes/api/auth/mollie/callback.ts`
   - Delete the `isMockMode` branch.
   - If `MOLLIE_CLIENT_ID` or `MOLLIE_CLIENT_SECRET` is missing, return 502 in all environments.

2. **Update tests.**
   - File: `src/routes/api/auth/mollie/callback.test.ts`
   - Remove or rewrite tests that rely on mock mode.
   - Add a test verifying 502 when credentials are missing.

3. **Document env vars.**
   - Add `MOLLIE_CLIENT_ID` and `MOLLIE_CLIENT_SECRET` to `.env.example`.
   - Verify they are already in `AGENTS.md`; update if not.

### Phase 5 — Testing & Validation (1–2 days)

1. **Unit/component tests.**
   - Add `ProductTableRow.test.tsx` covering edit link destination and thumbnail `src`.
   - Update or add tests for `StudioShopDashboard` hub links.

2. **E2E tests.**
   - Add a navigation smoke test in `e2e/` (or extend an existing creator test):
     - Approve a shop in DB/admin.
     - Visit `/sell/status/$shopId` and click "Set up payouts".
     - Assert URL is `/creator/payouts?shopId=...`.
     - From `/studio/$shopId`, click Products, Settings, Payouts.
     - Assert each lands on a real, non-404 route.
     - From `/creator/products`, click edit on a product.
     - Assert URL is `/creator/products/$productId/edit`.

3. **Manual verification.**
   - Run `make up`, `make dev`.
   - Create or seed a shop.
   - Walk each fixed path in the browser.
   - Verify thumbnails load.
   - Verify no console errors from TanStack Router about invalid `to`/`params`.

4. **Quality gates.**
   - `make lint`
   - `make format`
   - `make check`
   - `make test` (targeted) and `make test-related` for impacted files.

---

## 5. Detailed File-by-File Changes

### 5.1 `src/route-components/sell/status/$shopId.tsx`

**Change:** Update approved-state CTA.

```tsx
// BEFORE
approved: {
  ...
  cta: { label: ..., href: '/sell/shops/$shopId/payment' },
},

// AFTER
approved: {
  ...
  cta: {
    label: m.onboarding_status_approved_cta(),
    href: '/creator/payouts',
    search: { shopId: status.id },
  },
},
```

Also update the render logic to pass `search` to `<Link>` when present.

### 5.2 `src/components/product/ProductTableRow.tsx`

**Changes:**
1. Import `getImageUrl`.
2. Wrap thumbnail `src`.
3. Replace edit link destination.

```tsx
import { getImageUrl } from '#/lib/image-url'

// Thumbnail
<img
  src={getImageUrl(product.thumbnailUrl, { width: 80, format: 'webp' })}
  alt=''
  ...
/>

// Edit link
<Link
  to='/creator/products/$productId/edit'
  params={{ productId: product.id }}
  ...
>
```

### 5.3 `src/route-components/admin/products.tsx`

**Change:** Wrap admin thumbnail `src`.

```tsx
import { getImageUrl } from '#/lib/image-url'

<img
  src={getImageUrl(p.thumbnailUrl, { width: 80, format: 'webp' })}
  alt=''
  ...
/>
```

### 5.4 `src/lib/creator-dashboard.server.ts`

**Change:** Add per-shop dashboard stats query.

```ts
export interface ShopDashboardStats {
  pendingOrdersCount: number
  lowStockProductCount: number
  revenueThisMonthCents: number
  totalActiveProducts: number
}

export async function getShopDashboardStatsQuery(
  shopId: string,
): Promise<ShopDashboardStats> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [[lowStockResult], [pendingResult], [revenueResult], [activeProductsResult]] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(product)
        .where(and(eq(product.shopId, shopId), lt(product.stockCount, 5))),
      db
        .select({ count: count() })
        .from(shopOrder)
        .where(and(eq(shopOrder.shopId, shopId), inArray(shopOrder.status, PENDING_STATUSES))),
      db
        .select({ total: sum(shopOrder.subtotalCents) })
        .from(shopOrder)
        .where(
          and(
            eq(shopOrder.shopId, shopId),
            inArray(shopOrder.status, REVENUE_STATUSES),
            gte(shopOrder.createdAt, startOfMonth),
          ),
        ),
      db
        .select({ count: count() })
        .from(product)
        .where(and(eq(product.shopId, shopId), eq(product.isActive, true))),
    ])

  return {
    pendingOrdersCount: Number(pendingResult?.count ?? 0),
    lowStockProductCount: Number(lowStockResult?.count ?? 0),
    revenueThisMonthCents: Number(revenueResult?.total ?? 0),
    totalActiveProducts: Number(activeProductsResult?.count ?? 0),
  }
}
```

### 5.5 `src/routes/api/shops/$shopId/dashboard.ts`

**Change:** Implement real per-shop dashboard endpoint.

```ts
import { createFileRoute } from '@tanstack/react-router'
import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'
import { getShopDashboardStatsQuery } from '#/lib/creator-dashboard.server'

export const Route = createFileRoute('/api/shops/$shopId/dashboard')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const stats = await getShopDashboardStatsQuery(params.shopId)
            return new Response(JSON.stringify(stats), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        ),
    },
  },
})
```

### 5.6 `src/routes/studio/$shopId.tsx`

**Change:** Extend loader to fetch metrics.

```ts
import { createFileRoute } from '@tanstack/react-router'
import { ShopDashboard } from '#/route-components/studio/$shopId'
import { guardShopOwnership } from '#/lib/route-guards'
import { getShopDashboardStatsQuery } from '#/lib/creator-dashboard.server'

export const Route = createFileRoute('/studio/$shopId')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params }) => {
    const stats = await getShopDashboardStatsQuery(params.shopId)
    return { stats }
  },
  component: ShopDashboard,
})
```

### 5.7 `src/route-components/studio/$shopId.tsx`

**Change:** Replace stub with navigation hub showing real metrics.

```tsx
import { Link, useParams, useLoaderData } from '@tanstack/react-router'
import { Package, Tags, Banknote, Settings } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { formatPriceEUR } from '#/lib/pricing'

export function ShopDashboard() {
  const { shopId } = useParams({ from: '/studio/$shopId' })
  const { stats } = useLoaderData({ from: '/studio/$shopId' })

  const NAV_ITEMS = [
    {
      icon: Package,
      title: m.studio_nav_orders(),
      description: m.studio_nav_orders_desc(),
      to: '/studio/$shopId/orders' as const,
      params: { shopId },
    },
    {
      icon: Tags,
      title: m.studio_nav_products(),
      description: m.studio_nav_products_desc(),
      to: '/creator/products' as const,
      search: { shopId },
    },
    {
      icon: Banknote,
      title: m.studio_nav_payouts(),
      description: m.studio_nav_payouts_desc(),
      to: '/creator/payouts' as const,
      search: { shopId },
    },
    {
      icon: Settings,
      title: m.studio_nav_settings(),
      description: m.studio_nav_settings_desc(),
      to: '/creator/shop' as const,
      search: { shopId },
    },
  ]

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
          {m.studio_dashboard_title()}
        </h1>
        <p className='mb-8 text-text-secondary'>
          {m.studio_dashboard_description({ shopId })}
        </p>

        {/* Metrics */}
        <div className='mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            label={m.studio_metric_pending_orders()}
            value={stats.pendingOrdersCount}
          />
          <MetricCard
            label={m.studio_metric_low_stock()}
            value={stats.lowStockProductCount}
          />
          <MetricCard
            label={m.studio_metric_revenue_this_month()}
            value={formatPriceEUR(stats.revenueThisMonthCents)}
          />
          <MetricCard
            label={m.studio_metric_active_products()}
            value={stats.totalActiveProducts}
          />
        </div>

        {/* Navigation */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              params={item.params}
              search={item.search}
              className='...'
            >
              <item.icon size={20} />
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
```

### 5.8 `src/routes/api/shops/$shopId/settings.ts`

**Change:** Implement real GET/PATCH.

```ts
import { createFileRoute } from '@tanstack/react-router'
import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'
import { updateShopSchema } from '#/lib/shop-settings'
import { getCreatorShop } from '#/lib/creator-dashboard'
import { updateShop } from '#/lib/shop-settings'

export const Route = createFileRoute('/api/shops/$shopId/settings')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const shop = await getCreatorShop({ data: { shopId: params.shopId } })
            if (!shop) {
              return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
            }
            return new Response(JSON.stringify(shop), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        ),
      PATCH: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const raw = await request.json().catch(() => ({}))
            const parsed = updateShopSchema.safeParse({ ...raw, shopId: params.shopId })
            if (!parsed.success) {
              return new Response(
                JSON.stringify({ error: 'Bad Request', issues: parsed.error.issues }),
                { status: 400 },
              )
            }
            const updated = await updateShop({ data: parsed.data })
            return new Response(JSON.stringify(updated), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        ),
    },
  },
})
```

> Note: `updateShop` is a `createServerFn`; calling it inside another server handler may require using the internal `updateShopInternal` from `src/lib/shop-settings.server.ts` instead. Verify during implementation.

### 5.9 `src/routes/api/auth/mollie/callback.ts`

**Change:** Remove mock fallback.

```ts
const mollieClientId = getMollieClientId()
const mollieClientSecret = getMollieClientSecret()

if (!mollieClientId || !mollieClientSecret) {
  return new Response(
    JSON.stringify({
      error: 'Bad Gateway',
      message: 'Mollie Connect credentials are not configured.',
    }),
    { status: 502, headers: { 'Content-Type': 'application/json' } },
  )
}
```

Delete the `isMockMode` variable and the entire conditional branch that follows.

---

## 6. Tests

### 6.1 New tests to add

| Test file | What it covers |
|-----------|----------------|
| `src/components/product/ProductTableRow.test.tsx` | Thumbnail uses `getImageUrl`; edit link points to `/creator/products/$productId/edit`; toggle button calls handler. |
| `src/route-components/studio/$shopId.test.tsx` | Each hub card links to the correct route with correct `shopId`; metrics values are rendered from loader data. |
| `src/lib/creator-dashboard.server.test.ts` | `getShopDashboardStatsQuery` returns correct counts and revenue for a single shop. |
| `src/routes/api/shops/$shopId/dashboard.test.ts` | GET returns real per-shop metrics; GET returns 403 for non-owner. |
| `src/routes/api/shops/$shopId/settings.test.ts` | GET returns shop details; PATCH updates and returns record; PATCH returns 400 on invalid body; PATCH returns 409 on slug collision; GET/PATCH return 403 for non-owner. |

### 6.2 Tests to update

| Test file | Update |
|-----------|--------|
| `src/routes/api/auth/mollie/callback.test.ts` | Remove mock-mode success test; add 502 test for missing credentials; keep real-OAuth success test. |
| `e2e/admin-panel.spec.ts` | Optionally add admin product thumbnail visibility check. |

### 6.3 E2E navigation smoke test (new or extended)

Create `e2e/owner-navigation.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('owner navigation', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test('post-approval payment link, studio hub, and product edit link work', async ({ page }) => {
    // Preconditions: seed a shop with status 'approved' and at least one product.
    const shopId = process.env.E2E_TEST_SHOP_ID ?? '...'

    await page.goto(`/sell/status/${shopId}`)
    await page.getByRole('link', { name: /set up payouts/i }).click()
    await expect(page).toHaveURL(/\/creator\/payouts\?shopId=/)

    await page.goto(`/studio/${shopId}`)
    await page.getByRole('link', { name: /settings/i }).click()
    await expect(page).toHaveURL(/\/creator\/shop\?shopId=/)

    await page.goto(`/studio/${shopId}`)
    await page.getByRole('link', { name: /products/i }).click()
    await expect(page).toHaveURL(/\/creator\/products\?shopId=/)

    await page.goto(`/creator/products?shopId=${shopId}`)
    const editLink = page.locator('table tbody tr a[href*="/creator/products/"][href$="/edit"]').first()
    await expect(editLink).toBeVisible()
    await editLink.click()
    await expect(page).toHaveURL(/\/creator\/products\/.+\/edit/)
  })
})
```

---

## 7. i18n Checklist

- [ ] Add English keys to `messages/en.json`.
- [ ] Add Dutch keys to `messages/nl.json` (or mark for translation if unavailable).
- [ ] Run `bun run i18n:compile`.
- [ ] Verify no runtime `m.key is not a function` errors in browser.

---

## 8. Documentation Updates

- [ ] `AGENTS.md`: verify `MOLLIE_CLIENT_ID` and `MOLLIE_CLIENT_SECRET` are documented (they are). No change required unless env example is missing.
- [ ] `.env.example`: add `MOLLIE_CLIENT_ID=` and `MOLLIE_CLIENT_SECRET=` if not present.
- [ ] `docs/AUDIT_STORE_OWNER_2026-06-12.md`: after implementation, update the status of items 1.1, 1.2, 1.7, 2.1, 2.2, 2.3, 8.3 to "Fixed" or strike through.

---

## 9. Acceptance Criteria

A reviewer can verify the work by running:

```bash
make up
make dev
# in another shell
make lint
make format
make check
make test src/components/product/ProductTableRow.test.tsx
make test src/route-components/studio/\$shopId.test.tsx
make test src/lib/creator-dashboard.server.test.ts
make test src/routes/api/shops/\$shopId/dashboard.test.ts
make test src/routes/api/shops/\$shopId/settings.test.ts
make test src/routes/api/auth/mollie/callback.test.ts
# e2e
make e2e e2e/owner-navigation.spec.ts
```

Expected results:

1. `/sell/status/$shopId` for an approved shop links to `/creator/payouts?shopId=$shopId` and loads without 404.
2. `/creator/products` edit icon links to `/creator/products/$productId/edit` and loads the editor.
3. `/studio/$shopId` shows Orders, Products, Payouts, Settings cards; each links to the correct real route.
4. `/studio/$shopId` displays real per-shop metrics (pending orders, low stock, current-month revenue, active products).
5. `/api/shops/$shopId/dashboard` returns real per-shop metrics.
6. `/api/shops/$shopId/settings` GET returns real persisted data; PATCH persists changes.
7. Owner and admin product thumbnails render with imgproxy URLs and load correctly.
8. Mollie callback returns 502 when `MOLLIE_CLIENT_ID`/`MOLLIE_CLIENT_SECRET` are missing.
9. `make lint`, `make format`, `make check` pass with no errors or warnings.
10. All new and updated tests pass.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Changing the product edit link breaks existing bookmarks or external links. | Low | The old `/studio/$shopId?tab=products` destination never worked; no valid bookmarks exist. |
| `/api/shops/$shopId/settings` callers exist in mobile or third-party clients that expect the placeholder shape. | Low | Product confirmed no external callers. Implement the real shape; no backward-compatibility needed. |
| Removing Mollie mock mode breaks local development flow for sellers. | Medium | Document that developers must set `MOLLIE_CLIENT_ID`/`MOLLIE_CLIENT_SECRET` for payout onboarding; local mock payments remain available via `MOCK_PAYMENTS_ENABLED` for checkout only. |
| Studio hub UI feels redundant with `/creator/` dashboard. | Low | This is a known consequence of having two seller surfaces. The hub is a minimal navigation fix; a larger UX consolidation is out of scope. |
| `getImageUrl` returns `localhost:8080` URLs in e2e/tests if env is not set. | Low | Ensure `VITE_IMGPROXY_BASE_URL` is set in test/e2e environments, or mock `getImageUrl` in component tests. |

---

## 11. Open Questions for Product/Engineering

| # | Question | Answer (2026-06-13) | Implication |
|---|----------|---------------------|-------------|
| 1 | Should the post-approval CTA deep-link to a specific "Connect Mollie" action on `/creator/payouts`? | Use best-practice recommendation: land on `/creator/payouts?shopId=...` with the shop pre-selected; no auto-scroll/focus for MVP. | Plan keeps the interaction simple and predictable. |
| 2 | Should `/studio/$shopId` eventually become the canonical seller hub, with `/creator/*` routes deprecated? | *Still open* | Out of scope for this plan; leave dual surfaces in place. |
| 3 | Is `/api/shops/$shopId/settings` actively used by any mobile app or external client? | No | Implement real shape without backward-compatibility concerns. |
| 4 | Should the studio hub show real shop metrics? | Yes | Metrics are in scope; plan includes `getShopDashboardStatsQuery` and `/api/shops/$shopId/dashboard`. |
| 5 | Do we want to remove `/studio/` index route's placeholder copy as part of this work? | *Still open* | Left out of scope; can be addressed in a separate dashboard objective. |

---

## 12. Definition of Done

- [ ] All broken links identified in objective #3 are fixed and route to real, functional pages.
- [ ] Placeholder settings API is implemented to persist data honestly.
- [ ] Placeholder dashboard API is implemented and returns real per-shop metrics.
- [ ] Studio dashboard is no longer a stub and shows honest navigation plus real metrics.
- [ ] Product thumbnails render correctly in owner and admin lists.
- [ ] Mollie Connect callback no longer silently mocks credentials.
- [ ] Tests cover the fixed paths, metrics, and APIs and pass.
- [ ] Lint, format, and type checks pass.
- [ ] i18n keys are compiled and verified.
- [ ] Documentation is updated where env vars or behavior changed.
- [ ] No secrets, mock credentials, or placeholder TODOs are left in production paths.
