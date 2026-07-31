# Shop storefront overhaul

**Opened:** 2026-07-28
**Revised:** 2026-07-28 (second pass — see §14 for what changed and why)
**Register entry:** #1 in [`feature-depth-backlog.md`](./feature-depth-backlog.md)
**Reference standard:** the search overhaul in `6fac0a6` (PR #15)

---

## 1. Why

`PRODUCT.md` states the register as "brand / product (dual-register marketplace;
brand surfaces and product surfaces are equally important)" and the first design
principle as "**The maker is the hero.** Every design decision should elevate the
artisan and their work, not the platform."

`DESIGN.md` §1 makes the same split concrete: "brand surfaces (landing,
discovery) lean into committed warmth and editorial typography, while product
surfaces (dashboards, forms, shop management) stay restrained and task-focused."

The storefront is the platform's principal brand surface. It is currently built
like a product surface.

### 1.1 What the platform collects

`shop` (`src/db/schema.ts:144-228`) stores, among the tax and lifecycle columns:

`tagline`, `description`, `category`, `tags[]`, `image`, `bannerImage`,
`productionType`, `hasProductionPartner`, `productionPartnerDetails`,
`languages[]`, `shippingOrigin` (jsonb, **encrypted**), `policies` (jsonb),
`announcement`, `isVatRegistered`, `createdAt`.

`shopSocials` (`src/db/schema.ts:241`) stores one validated URL per platform
across seven platforms, unique per `(shopId, platform)`.

All of it is captured through eight-step onboarding
(`src/lib/shops/onboarding.server.ts`, 706 lines) and stays editable in shop
settings (`src/lib/shops/settings.server.ts` plus twelve `ShopSettings*.tsx`
components).

### 1.2 What buyers see

`ShopSummary` (`src/lib/products/types.ts:87`):

```ts
export type ShopSummary = {
  id: string
  name: string
  description: string | null
  slug: string
  image: string | null
}
```

Five fields. `getShopBySlugQuery` (`src/lib/products/operations.server.ts:228`)
selects those plus two guard columns. `ShopPage.tsx` is 129 lines: avatar, name,
description, product grid, name-substring search box.

### 1.3 The contradiction

- The creator dashboard prompts sellers to add a **banner**, **socials**, and an
  **announcement** (`src/components/CreatorDashboardPage.tsx:60-101`; keys
  `creator_readiness_banner`, `creator_readiness_socials`,
  `creator_readiness_announcement`). None appears on any public page.
- The **admin** review dialog renders the banner
  (`src/route-components/admin/shops/application-review/ShopVisualsSection.tsx:37-40`).
  Moderators see it; buyers do not.
- Staging seed populates `bannerImage` for every curated shop
  (`src/db/seed-staging.ts:622`) and it has never been displayed.

The platform asks makers to invest in a profile, validates it, stores it, shows
it to moderators, and hides it from the only audience that matters.

### 1.4 Risk profile

**No schema migration is required.** Every field exists, is validated, and is
populated. This is projection, presentation, and instrumentation. The only
candidate database change is a supporting index for the review aggregate (§4.6),
and only if measurement justifies it.

That does **not** make it trivial: §4.3 (encrypted PII), §4.4 (legal
disclosure), and §6.2 (variant stock) each carry real consequences.

---

## 2. Scope

**In scope**

1. A public shop-profile projection with an explicit column allowlist.
2. Storefront UI: banner, tagline, announcement, story, production-partner
   disclosure, policies, languages, origin country, socials, member-since,
   rating summary.
3. Product-browsing parity with search: sort, in-stock, in-shop category filter,
   all URL-addressable.
4. Structured data and SEO reflecting the richer profile.
5. Four correctness fixes found during research (§3).
6. Telemetry for storefront reach and profile completeness.
7. Unit, component, E2E, and accessibility coverage; full en/nl localization.

**Out of scope**

- Shop following/favouriting (no schema; see the backlog's closing note).
- Buyer↔seller messaging.
- Review model changes — this plan *reads* aggregates only (backlog #3).
- Onboarding and shop settings. Capture is complete; this plan consumes it.
- The `shippingOrigin` decryption defect in checkout/fulfillment (§3.4) — it
  touches the money path and needs its own change.

---

## 3. Correctness fixes folded in

### 3.1 Nested `<main>` landmarks

`src/routes/shops/$shopSlug.tsx:42` renders `<main><Outlet /></main>`, and both
children render their own `<main>`: `ShopPage.tsx:47` and `ProductDetail.tsx:78`.
Two nested main landmarks per page violates WCAG 2.1 and is a real screen-reader
defect on the storefront *and* every product page.

**Fix:** the layout renders a plain wrapper; leaf routes keep their `<main>`.
Covered by an axe scan per §9.4 — `docs/ACCESSIBILITY_ASSURANCE.md` records
"Current exceptions: **none**", so this cannot ship as a known deviation.

### 3.2 Duplicate shop fetch per page load — resolved shape

`src/routes/shops/$shopSlug.tsx:8` and `src/routes/shops/$shopSlug.index.tsx:25`
both call `getShopBySlug`, so every storefront view runs the query twice.

The first pass of this plan left the fix open. **Resolved:**

- The **index route** fetches the full profile. It must, because its `head()`
  builds title, canonical, OG image, and JSON-LD from shop data, and `head()`
  receives its own route's `loaderData` — not the parent's.
- The **layout route** keeps the minimal `getShopBySlug`. Its header chrome
  renders on product-detail pages too, where no profile is loaded, so it cannot
  depend on the index route's data.

Net effect: one minimal query plus one full query, instead of two minimal ones.
Not a single query, but the heavy read happens exactly once.

Reading parent loader data from a *component* is available and already used —
`src/route-components/admin/index.tsx:15-16` calls `getRouteApi('/admin/')` and
`getRouteApi('/admin')` together on `@tanstack/react-router` `^1.169.2`. That
precedent covers rendering, not `head()`, which is why the split above stands.

### 3.3 Divergent product-listing paths

`getShopProductsQuery` (`src/lib/products/operations.server.ts:250`) hand-rolls
conditions `buildProductWhere` (`:79`) already expresses, differing only by an
`ilike` name search. It cannot sort, and it re-queries the shop row separately
with `db.select().from(shop)` — pulling `mollieAccessToken` and every tax column
into memory before discarding them.

**Fix:** add `search?: string` to `ListProductsFilters`
(`src/lib/products/types.ts:43`) and route the storefront through
`listProductsQuery`, which brings sorting for free. Keep ilike semantics
identical so existing E2E coverage stays valid.

### 3.4 Adjacent finding — not fixed here

`shippingOrigin` is written encrypted (`src/lib/shops/settings.server.ts:180`,
`encryptJsonb`) but read two different ways:

| Read site | Method |
|---|---|
| `src/lib/checkout/order-persistence.server.ts:220` | `decryptJsonb` ✓ |
| `src/lib/checkout/notifications.server.ts:82,137` | `decryptJsonb` ✓ |
| `src/lib/checkout/summary.server.ts:115,155` | `decryptJsonb` ✓ |
| `src/lib/products/dashboard.server.ts:294` | `decryptJsonb` ✓ |
| `src/lib/checkout/operations.server.ts:138` | raw `as` cast ✗ |
| `src/lib/checkout/order-persistence.server.ts:161` | raw `as` cast ✗ |
| `src/lib/shop-orders/fulfillment.server.ts:34` | raw `as` cast ✗ |
| `src/lib/shop-settings.ts:216` | raw `as` cast ✗ |

`decryptJsonb` (`src/lib/infra/encryption.server.ts:94`) passes plaintext through
unchanged for legacy rows, so the raw-cast sites work on legacy data and silently
read a base64 ciphertext string on rows written since encryption landed —
`.country` on a string yields `undefined`.

This sits in checkout and fulfillment. **It is out of scope here and needs its
own change with money-path review.** Recorded so it is not lost.

**Resolved 2026-07-30, separately from this plan.** The table above undercounted:
there were ten sites across two columns, including the buyer-facing checkout
summary, VAT invoices, and a SQL `->>` extraction that no decryption can fix. See
`feature-depth-backlog.md` → "read without decryption" for the full list and the
two guards added to keep it fixed.

---

## 4. Phase 1 — the public shop profile projection

### 4.1 Placement

Per `docs/ARCHITECTURE.md` §"Directory ownership" and the `src/lib/shop-orders/`
reference migration:

| File | Contents |
|---|---|
| `src/lib/shops/public-profile.server.ts` | `getShopProfileQuery(slug)` — server-only persistence |
| `src/lib/shops/public-profile.ts` *(new)* | Browser-safe types and the read-time Zod schemas (§4.5). Must not import db, secrets, or `*.server.ts`. |
| `src/lib/shop-profile.ts` *(new)* | `getShopProfile` server function; owns input validation and RPC authorization |
| `src/lib/shops/public-profile.server.test.ts` | Allowlist and guard tests (§9.1) |

`ShopSummary` and `getShopBySlugQuery` stay as they are — product detail and the
layout chrome do not need the heavier shape.

### 4.2 The allowlist

The `shop` table mixes public marketing data with tax identity and payment
credentials in one row. The query **must** select an explicit column list. Never
`select()`, never spread the shop row into a response.

**Published:** `id`, `name`, `slug`, `tagline`, `description`, `category`,
`tags`, `image`, `bannerImage`, `announcement`, `productionType`,
`hasProductionPartner`, `productionPartnerDetails`, `languages`,
`isVatRegistered`, `createdAt`.

**Never published:** `businessAddress`, `vatId`, `taxId`, `dateOfBirth`,
`businessRegistrationNumber`, `legalEntityType`, `mollieAccountId`,
`mollieAccessToken`, `mollieRefreshToken`, `mollieTokenExpiresAt`,
`paymentConnected*`, `moderationNote`, `moderationStage`, `submittedAt`,
`reviewedAt`, `reviewedBy`, `resubmissionCount`, `ownerId`, `onboarding*`,
`sellerTerms*`, `pausedAt`, `archivedAt`, `scheduledDeleteAt`, `isSuspended`,
`status`, `currency`.

`ownerId` especially must not ship — it is a `user.id`, and the DAC7 columns
beside it exist for tax reporting, not publication.

### 4.3 The two jsonb columns are not alike

This is the correction that most changes the implementation.

**`shippingOrigin` is encrypted at rest.** Writes go through
`encryptJsonb` (`src/lib/shops/settings.server.ts:180`). It **must** be read with
`decryptJsonb<ShippingOriginData>` from `src/lib/infra/encryption.server.ts`.
Selecting the column and reading `.country` off it returns `undefined` on any
row written since encryption landed (§3.4).

It is encrypted because it is treated as seller PII — it carries `state`,
`city`, and `postalCode` alongside the country. Publishing **any** part of an
encrypted-at-rest PII column is a deliberate act, not a projection detail:

- Publish **only** `country`, `processingTimeDays`, `shipsInternational`.
- Never `state`, `city`, `postalCode`.
- The reduction happens **server-side in the query**, so the narrowed object is
  all that crosses the boundary. Never send the decrypted object and filter in
  the component.

**`policies` is plaintext jsonb** and is read today with an unvalidated cast
(`src/lib/products/dashboard.server.ts:302`, `record.policies as Policies`). For
an authenticated dashboard that is tolerable. For an anonymous public page it is
not: a legacy or malformed row would render garbage or throw during SSR.

- Parse with Zod at read time against `policiesSchema`
  (`src/lib/sell-onboarding.ts:97`). On parse failure, treat policies as absent
  and render nothing — never partially rendered, never crashed.
- Publish `returns`, `exchanges`, `customOrders`, `additionalInfo`,
  `mandatoryRightsAcknowledged`. Omit `paymentMethods`: it is seller-declared and
  does not reflect what checkout actually offers.

### 4.4 Trader identity disclosure — RESOLVED 2026-07-28

**Decision: publish country only. Do not publish seller addresses, VAT IDs, or
registration numbers.** The projection as built in §4.2/§4.3 is correct and needs
no change.

Standard applied: publish what is legally required, nothing more.

**Why address publication is not required.** DSA Article 30(7) would oblige a
marketplace to publish each trader's name, address, phone, email, and trade
register details "on the online platform's online interface where the information
on the product or service is presented". But **Article 29 excludes providers that
qualify as micro or small enterprises** under Recommendation 2003/361/EC — micro
being <10 staff and ≤€2M turnover, small being <50 staff and ≤€10M. Eurtisan is
operated by a French micro-entreprise (`BUSINESS.md`) and qualifies comfortably.
The exclusion is lost only on designation as a very large online platform
(45M+ EU users), and lapses 12 months after outgrowing small-enterprise status.

**Re-open this decision when** the operating entity approaches the small-enterprise
ceiling, or converts from micro-entreprise to a company with employees. At that
point Article 30(7) applies in full and the projection must be widened.

Publishing addresses voluntarily would also cut against §4.3: `shippingOrigin` and
`businessAddress` are encrypted at rest precisely because they were classified as
PII, and most sellers on a maker marketplace register a home address.

**What research did surface as required** — none of it about addresses, and none
of it exempt — is recorded in `feature-depth-backlog.md` under "Regulatory gaps".
One item lands inside this plan's scope: see §5.8.

### 4.5 Read-time validation

Browser-safe schemas live in `src/lib/shops/public-profile.ts`:

- `publicPoliciesSchema` — derived from `policiesSchema`, minus `paymentMethods`.
- `publicOriginSchema` — `country`, `processingTimeDays`, `shipsInternational`.
- `publicSocialSchema` — platform enum plus a URL refined to `http:`/`https:`.
  `socialRowSchema` (`src/lib/sell-onboarding.ts:257`) accepts any non-empty
  string, so a `javascript:` URL can already be stored. Filter at read **and**
  at render (§5.4) — two layers, because this one is an XSS vector.

Everything that fails validation is dropped silently. A malformed row must
degrade to a sparser page, never to an error.

### 4.6 Aggregates

- **`productCount`** — published, active products; same predicate as
  `buildProductWhere`.
- **`reviewCount` / `ratingAverage`** — across the shop's products. Reuse
  `computeRatingAverage` (`src/lib/search/relevance.ts:31`); do not write a
  second averaging implementation.
- Aggregate over `review → product → shop`, **matching the display convention in
  `getProductReviewsQuery` (`src/lib/reviews/operations.server.ts:306`):
  everything not `hidden`.** Search's `popularityScore` counts approved only
  (`src/lib/products/meilisearch.server.ts:118`). The two differ today; this plan
  does not resolve that (backlog #3) but must not add a third. Comment the
  aggregate with both call sites.

Measure against seeded staging data before adding an index. Candidate is a
composite on `review(product_id, moderation_status)`; `review_product_id_idx` and
`review_moderation_status_idx` exist separately today. Any index follows the
`AGENTS.md` migration procedure (`make db-generate`, review SQL, `make db-check`,
`make db-migrate-fresh`).

### 4.7 Guards

Publicly visible only when `isSuspended === false && status === 'active'`.
Return `null` otherwise; the route turns that into a 404. Do not leak the
difference between "no such shop" and "suspended shop". `getShopBySlugQuery`
already gets this right and PR #20 propagated suspension into search — this is
the third surface that must agree.

### 4.8 Caching

The storefront is a hot anonymous page and the profile changes rarely.
`withServerCache` (`src/lib/infra/server-cache.server.ts`) already backs category
reads.

- Key prefix `cache:shop-profile:<slug>:`, TTL in the same range as the category
  cache.
- Invalidate from every write path that can change published fields:
  `src/lib/shops/settings.server.ts`, `src/lib/shops/onboarding.server.ts`, and
  `src/lib/shops/moderation.server.ts` (suspension must take effect immediately —
  a cached profile outliving a suspension is the failure mode that matters).
- The module documents itself as process-local: "Multi-instance: add Redis
  (REDIS_URL) or accept per-process cache." With suspension invalidation, a
  stale window on another instance is a real exposure. **Either** bound the TTL
  tightly enough that the window is acceptable **or** skip caching in Phase 1 and
  add it once measurement justifies it. Default to skipping — correctness over
  a speculative optimization, per the `AGENTS.md` decision order.

---

## 5. Phase 2 — storefront UI

### 5.1 Placement and structure

`docs/ARCHITECTURE.md` reserves `src/components/` for components used by
unrelated routes and puts route-owned page UI in `src/route-components/`
mirroring the route path. These panels are route-owned:

| File | Renders |
|---|---|
| `src/route-components/shops/$shopSlug.tsx` | Composition (replaces today's thin wrapper) |
| `src/route-components/shops/storefront/ShopBanner.tsx` | `bannerImage` |
| `.../ShopIdentityHeader.tsx` | name, tagline, production-type badge, languages, country, member-since |
| `.../ShopAnnouncement.tsx` | `announcement` |
| `.../ShopStoryPanel.tsx` | `description`, production-partner disclosure (§5.2) |
| `.../ShopPoliciesPanel.tsx` | returns, exchanges, custom orders, processing time, international (§5.3) |
| `.../ShopSocialLinks.tsx` | validated socials (§5.4) |
| `.../ShopRatingSummary.tsx` | rating and review count (§5.5) |
| `src/components/ui/StarRating.tsx` | Extracted from `ProductReviews.tsx:22`, now shared — a primitive, so `ui/` per ARCHITECTURE.md |

`src/components/ShopPage.tsx` is route-owned and sits in `src/components/`
against the current convention. Since it is being rewritten anyway, it moves to
`src/route-components/shops/` as part of this work — not a drive-by refactor.

A single scrollable page with anchored in-page navigation, not tabs: one URL per
shop keeps SEO simple, keeps JSON-LD honest, and avoids hiding policies behind an
interaction. The layout nav (`src/routes/shops/$shopSlug.tsx:31`, currently only
`shop_nav_products`) gains About and Policies anchors.

Every panel renders **only when its data is present**. A sparse profile must look
deliberate, not broken — that is the difference between honouring the maker and
exposing them.

### 5.2 Production-partner disclosure

`hasProductionPartner` and `productionPartnerDetails` tell a buyer whether the
maker produces the goods themselves. On a platform whose purpose is connecting
buyers with makers, this is among the most consequential fields on the page.
Render it plainly and without euphemism whenever `hasProductionPartner` is true.

### 5.3 Policies and mandatory consumer rights

`policiesSchema` requires `mandatoryRightsAcknowledged`
(`src/lib/sell-onboarding.ts:241-253`) — the seller confirms statutory consumer
rights apply regardless of their own policy. Publishing "no returns" without that
statement misrepresents the buyer's legal position.

**Whenever policies render, render the statutory-rights statement alongside
them.** Not conditional on the seller's returns setting.

### 5.4 Social links

- `rel="nofollow ugc noopener noreferrer"`, `target="_blank"`, new-window
  destination announced accessibly.
- Re-validate the scheme at render even though §4.5 filtered at read. Two layers,
  because a stored `javascript:` URL is an XSS vector.
- Platform icon **plus** visible text label — `PRODUCT.md` forbids relying on
  colour or icon alone.

### 5.5 Rating display

Hide the shop rating below a small threshold (start at 3 reviews). A "5.0" from
one review is not information, and the codebase already encodes this caution in
`computeBayesianRating`'s prior. Below threshold, show the product count instead.

### 5.8 Trader-status disclosure

CRD Article 6a(1)(b), added by the Omnibus Directive and in force since
2022-05-28, obliges the marketplace to tell the consumer — **before** they are
bound — whether the seller is a trader, "on the basis of the declaration of that
third party". Where the seller is not a trader, Article 6a(1)(c) obliges the
marketplace to state that EU consumer protection law does not apply to the
contract. **There is no micro/small exemption for this**, unlike DSA Article 30.

The storefront is one of the surfaces where that disclosure belongs, alongside
the product page and checkout.

It cannot be built yet: **Eurtisan does not collect a trader declaration.**
`shop.legalEntityType` is `individual | business`, a DAC7 tax field — a French
micro-entrepreneur is `individual` for tax purposes and a trader in consumer law.
Using it as a proxy would produce wrong disclosures in exactly the population
this marketplace targets.

So this plan does **not** implement the disclosure. It reserves the position for
it in `ShopIdentityHeader` and records the dependency; collecting the declaration
is an onboarding change tracked in the backlog. Do not fake it from
`legalEntityType`.

### 5.6 Design

`DESIGN.md` frontmatter is the token source: moss (`#3d8b6e`) primary, sage
(`#4a9e8f`) accent, walnut neutrals, brick and ochre semantics — warm OKLCH
throughout. Fraunces for display/headline, Manrope for title/body/label. 4pt
spacing scale, `rounded.xl` (16px) cards, restrained elevation with tonal
layering in dark mode.

The creative north star is "The Lisbon Atelier" — "a maker's workshop in
late-morning light: warm stone, handmade paper, mossy ceramic glazes, and linen
curtains." As a brand surface the storefront should lean into committed warmth
and editorial typography (`DESIGN.md` §1), unlike the restrained dashboard
surfaces. This is the one place in the buyer journey where that register is
explicitly licensed.

Constraints: no purple, no orange (`PRODUCT.md` anti-references); dark mode stays
warm and atmospheric, never cold or terminal-like. Reuse the existing page
vocabulary (`page-wrap`, `island-shell`, `island-kicker`, `display-title`) rather
than inventing parallel classes.

### 5.7 Images

Use `getImageUrl` / `ResponsiveImage` (`src/lib/images/url.ts`,
`src/lib/images/responsive.tsx`). Banner keys match
`^shops/[^/]+\.(jpg|jpeg|png|webp)$` and go through the same-origin delivery
endpoint that signs imgproxy paths server-side — never construct an imgproxy URL
in the browser. The banner needs a responsive set, not the single `960` width the
admin dialog uses. Banner and avatar are decorative (`alt=''`); the shop name is
already text.

---

## 6. Phase 3 — product browsing parity

**Status: built.** `ShopProductFilters`, `getShopProductCategoriesQuery`, and the
extended `shopSearchSchema` have landed, with unit, DB, and E2E coverage.

Two deviations from the contract below, both deliberate:

- **`inStock` is a boolean, not the string `'true'`.** The router serialises
  search values as JSON, so a string param reaches the address bar as
  `?inStock=%22true%22`. Found in the browser, not in tests. The schema still
  accepts either on the way in.
- **The back button does not step through filter changes.** Every navigation on
  this page uses `replace: true`, which was already true of its search box and
  pagination and is what `/search` does for its own filters. Consistency with
  the sibling surface won over the sentence below; switching both surfaces to
  `push` is a separate, joint decision.

### 6.1 URL contract

Extend `shopSearchSchema` (`src/routes/shops/$shopSlug.index.tsx:13`):

| Param | Type | Default |
|---|---|---|
| `page` | positive int | 1 |
| `search` | string ≤ 255 | — |
| `sort` | `newest` \| `price_asc` \| `price_desc` | `newest` |
| `inStock` | boolean | false |
| `category` | category slug | — |

All state in the URL, so a filtered storefront is linkable and the back button
works. Reuse `SortOption` (`src/lib/products/types.ts:56`); do not invent a
storefront-specific sort type.

Only categories that actually occur in this shop's published products appear in
the filter — the same principle as search's facet counts, cheap here because the
result set is one shop.

Distinct empty states: no products at all (existing seller CTA), no search
results, no results for a filter combination (offer to clear filters).

### 6.2 In-stock — a real semantic trap

`product.stockCount` and `productVariant.stockCount` are **independent columns**.
Variants carry their own stock (`src/lib/products/variants.server.ts:336`), and
generated variant combinations are created with `stockCount: 0` (`:507`). Nothing
syncs an aggregate back to `product.stockCount`.

Search's `inStock` uses `product.stockCount > 0` only
(`src/lib/products/meilisearch.server.ts:103,114`), so a variant product with
stock on every variant but zero on the parent row is already treated as out of
stock by search.

**Decision: mirror search's semantics exactly** — `product.stockCount > 0`, via a
condition added to `buildProductWhere`. Rationale: a storefront filter that
disagreed with search about the same product would be worse than one that is
consistently limited, and the correct fix (an aggregate across variants) belongs
to the catalog domain, not to this plan.

Document the limitation in code at the new condition, pointing at the search
call site, and add it to the backlog as a catalog-level item. **Do not silently
introduce a second definition of "in stock."**

---

## 7. Phase 4 — SEO and structured data

**Status: built.** `generateStoreJsonLd` now emits `logo`, `sameAs`, `address`,
and `aggregateRating` alongside the original five, with 11 tests covering the
omission rules. Two notes:

- **The rating threshold is not re-implemented here.** `ShopProfile.rating` is
  already null below `SHOP_RATING_MIN_REVIEWS`, so the route passes null and the
  emitter omits `aggregateRating`. One decision, one place.
- **`sameAs` is scheme-checked a second time**, even though `publicSocialSchema`
  filtered at read. This value is serialised into a `<script>` tag, so it gets
  the same two-layer treatment as the rendered links (§5.4).
- **The `updatedAt` question is answered: it moves.** `updateShopSettings` builds
  its update object with `updatedAt: new Date()` as the base
  (`settings.server.ts:152`) and rewrites socials inside the same call, so the
  sitemap's `lastmod` is honest. No change needed.

Extend `generateStoreJsonLd` (`src/lib/marketing/seo-structured-data.ts:106`),
which currently emits five properties:

- `image` — banner preferred, avatar fallback.
- `logo` — avatar.
- `sameAs` — validated social URLs. Exactly what `sameAs` is for, and a direct
  SEO gain from data already held.
- `aggregateRating` — **only above the §5.5 threshold.** Emitting a rating built
  from one review is a structured-data violation and risks a manual action.
- `address` — `PostalAddress` with `addressCountry` only, consistent with §4.3.
  Revisit if §4.4 changes.

OG image prefers the banner (usable aspect ratio) over the avatar. Sitemap
coverage already exists and is correct
(`src/lib/marketing/sitemap.server.ts:107-124`, keyed on `shop.updatedAt`,
excluding suspended shops) — but confirm `updatedAt` actually moves when a
profile field changes, or the sitemap advertises stale `lastmod`.

---

## 8. Phase 5 — telemetry

**Status: built.** `eurtisan_shop_profile_views_total` (unlabelled) increments in
`getShopProfileQuery`, which is server-only and runs once per storefront serve —
so a client-side navigation cannot inflate it, and misses and suspended shops are
not counted. `eurtisan_shop_profile_completeness` is fed hourly by
`src/jobs/shop-profile-completeness.ts`.

Three things worth recording:

- **The histogram is reset each tick.** It resamples the same population, so
  without a reset the buckets would accumulate every previous run and drift
  further from reality the longer the process lived. The series means "current
  spread across active shops".
- **The job is excluded from `EurtisanJobStale`.** That alert fires after 10
  minutes without a successful tick and every job runs as a continuous service in
  `docker-compose.prod.yml`, so an hourly job would sit in permanent critical
  alert. Six existing daily jobs have the same problem and are *not* excluded —
  recorded in `docs/runbooks/job-failure.md` rather than changed here, because
  altering on-call behaviour for unrelated jobs is an operations decision.
- **Verified against real data**, not just unit tests: 22 seeded shops, scores
  spanning 0.17 to 1.0, `eurtisan_job_runs_total{status="success"} 1`.

Deliberately modest. Search needed its own event table because query text *is*
the signal; a storefront view is not comparable, and a second event pipeline
would be over-building.

**Prometheus** (`src/lib/infra/metrics.server.ts`):

- `eurtisan_shop_profile_views_total` — counter, **unlabelled**. Never label by
  shop id or slug: unbounded cardinality. Per-shop counts, if ever wanted, belong
  in the database.
- `eurtisan_shop_profile_completeness` — histogram over the fraction of
  publishable fields populated across active shops, computed by a periodic job.

The second is the interesting one: the creator dashboard has nagged sellers to
complete their profiles with no way to tell whether it works. Once the storefront
renders those fields, this closes the loop and directly measures whether this
overhaul changed maker behaviour.

The job follows existing conventions: registered in `src/jobs/` alongside its
siblings, wrapped in `withJobMetrics`, holding a singleton advisory lock via
`src/lib/infra/job-lock.server.ts`.

Deferred: per-shop view analytics, storefront→product click-through, seller
traffic dashboards. Each is a feature with its own retention and privacy
questions.

---

## 9. Phase 6 — tests

### 9.1 Unit — `src/lib/shops/public-profile.server.test.ts`

The load-bearing test is a **projection allowlist assertion**: assert the exact
key set returned by `getShopProfileQuery` equals an expected set, so the test
fails the moment anyone widens it. That is what keeps `taxId`, `businessAddress`,
and `mollieAccessToken` out permanently, long after this plan is forgotten.

Also cover:

- Suspended shop → `null`; non-active status → `null`; unknown slug → `null`.
- **An encrypted `shippingOrigin` round-trips through `decryptJsonb` and yields
  `country`** — with `postalCode`, `city`, and `state` absent from the result.
  This is the test that would have caught §3.4's class of bug.
- Malformed `policies` → policies absent, no throw.
- A `javascript:` social URL is dropped at read.
- Rating aggregate matches `computeRatingAverage`; suppressed below threshold.
- Socials ordered deterministically.

DB-backed, so a `*.test.ts` file running serial per the Vitest gate in
`AGENTS.md`.

### 9.2 Component

`src/route-components/shops/storefront/*.test.tsx`, Testing Library. These must
stay **database-free** to remain in the browser-runtime graph (`AGENTS.md`
Vitest gate):

- Each panel absent, not empty, when data is missing.
- A fully populated profile renders every section.
- Exactly one `<h1>`; sensible heading order.
- Social links carry `rel="nofollow ugc noopener noreferrer"`; a `javascript:`
  URL is dropped at render too.
- Statutory-rights statement renders whenever policies do, including when returns
  are refused.
- Rating hidden below threshold, shown above.

### 9.3 E2E — extend `e2e/customer/shop-page.spec.ts`

The three existing tests must keep passing unmodified — they are the regression
guard for §3.3. Add:

- A fully-populated seeded shop shows banner, announcement, story, policies,
  socials. — **done**, against `atelier-verrier`. It also asserts "Ships from
  France", which only renders if the encrypted `shippingOrigin` decrypted, and
  asserts the street, postcode, and VAT ID are absent from the page.
- A sparse shop shows none of those and still renders cleanly. — **done**,
  against `quiet-bindery`, including that the in-page nav offers only the
  sections that rendered.
- Sort and filter round-trip through the URL and survive a reload. — **done.**
  Two tests added; all three originals still pass unmodified.
- Suspended shop → 404 (unknown slugs are covered; suspension is what matters
  after PR #20). — **done.** It creates its own shop rather than mutating a
  curated one, asserts the storefront renders *first* so the 404 is attributable
  to the suspension rather than to prior invisibility, and asserts the response
  leaks neither the shop name nor the word "suspended".

All 8 tests in the file pass. One unrelated spec, `auth-2fa.spec.ts`, fails —
verified pre-existing by stashing this branch, reseeding from the original seed,
and reproducing the identical failure (`getByText(/scan this uri/i)` not found).

### 9.4 Accessibility

`docs/ACCESSIBILITY_ASSURANCE.md` defines a formal regime, not an aspiration:
`make test-accessibility` runs vitest-axe scans plus static contrast, reflow,
reduced-motion, forced-colors, and skip-navigation contracts, and records
"Current exceptions: **none**."

**Status: built.** `make test-accessibility` now runs 196 tests across 11 files,
up from 143 across 10; `ShopStorefront.test.tsx` is in the Makefile list and the
matrix has its row. The scans were mutation-tested — breaking the category
label's `htmlFor` produces an axe `select-name` failure, so the gate is real
rather than vacuous. That mutation also left the sparse-state scan green, which
is the argument for scanning both ends of the range rather than one.

Required here:

- Axe scans for the storefront in populated and sparse states, added to the
  focused accessibility files. — **done**, plus a filtered-empty state, which
  renders the controls alongside the empty grid.
- **Any new semantic colour pairing** — notably banner-overlaid text, where a
  photographic background sits under type — must be added to the OKLCH contrast
  table in `src/lib/accessibility/contrast.test.ts` and clear 4.5:1 for normal
  text, 3:1 for focus and UI indicators. Text over an uncontrolled seller-uploaded
  image cannot be proven contrast-safe: put the type on a solid or scrimmed
  surface, not directly on the photograph.
- Reduced motion honoured on any banner or hover treatment. — nothing on this
  surface animates beyond token-driven colour transitions, so there was nothing
  to gate.
- Full keyboard operation of in-page nav, sort, and filters; skip-link target on
  the product grid. — **partly done.** Every control is a native `button`,
  `select`, `input`, or `a`, and jsdom confirms the names and pressed state, but
  jsdom has no focus ring and no layout: real tab-order and focus-visibility
  remain manual-checklist items, not automated ones. **No skip-link target was
  added to the product grid** — see below.
- The critical-flow matrix gains a **Shop storefront** row, honestly marked
  `not-run` for manual screen-reader evidence. Do not turn local axe output into
  fabricated NVDA/VoiceOver evidence — the document forbids it explicitly. —
  **done**, `not-run`.

The contrast-table item needed no entry: the banner scrim uses the existing
`scrim-image` tokens and no type is placed over the photograph, which is what
§5.1 decided precisely to avoid an unprovable contrast claim.

### 9.5 Seed data

Staging seed already sets `bannerImage` (`src/db/seed-staging.ts:622`). Extend one
curated shop to a *complete* profile (announcement, policies, socials, languages,
production partner) and deliberately leave another **sparse**, so both branches
are visible on staging and E2E has fixtures for each. Staging seed stays
idempotent, additive, deterministic, and curated per `AGENTS.md`.

Note that seeded `shippingOrigin` must be written through `encryptJsonb` to match
production shape — a plaintext seed row would pass §9.1's decryption test
vacuously via the legacy-passthrough branch.

**Status: built** — in `src/db/seed.ts` rather than the staging seed, because
that is where dev and E2E both read from. `Atelier Verrier`
(`CURATED_COMPLETE_SHOP_ID`) fills every publishable field including the
production-partner disclosure; `Quiet Bindery` (`CURATED_SPARSE_SHOP_ID`) fills
nothing optional. Both are `active`, so both are actually reachable — every
previously well-formed demo shop sat in `draft`, `pending_review`, or `approved`
and was therefore invisible to the public route.

Writing the seed to production shape turned up four defects that had been
masked by it:

1. **`shippingOrigin` was seeded as plaintext** for every shop. Now encrypted at
   the single insert site, so a shop added later cannot reintroduce it.
2. **`shop_socials` was truncated but never populated**, so "Find this maker"
   could not appear in any seeded environment, including E2E.
3. **Bulk-generated shops had no `processingTimeDays` or `shipsInternational`**,
   a shape onboarding cannot produce, which silently hid the dispatch facts.
   `The Forge` and `Aegean Crafts` additionally stored country *names*
   (`'Belgium'`, `'Greece'`) where both write paths require ISO-3166-1 alpha-2.
4. **`e2e/fixtures/orders.ts` rewrote the creator shop's origin as plaintext**
   with `country: 'France'` on every run — which, once the seed was correct,
   would have quietly undone it for the shop most specs point at.

### 9.6 Localization

Every new string goes into both `messages/en.json` and `messages/nl.json`.
Current parity is exact — 2137 keys, zero drift either way. It stays zero.

Covers: section headings, policy labels, the four production types
(`handmade`/`vintage`/`supplies`/`mixed`), seven social platform names,
processing-time and ships-international phrasing, the statutory-rights statement,
member-since, and every empty state.

Pluralization uses the project's message format, never a ternary in JSX. The
existing shape, from `orders_shop_count`:

```json
[{ "declarations": ["input count", "local countPlural = count: plural"],
   "selectors": ["countPlural"],
   "match": { "countPlural=one": "{count} shop", "countPlural=other": "{count} shops" } }]
```

The category page's `productCount === 1 ? 'product' : 'products'` is the mistake
not to repeat — Dutch plural rules differ, and a ternary hardcodes English.

---

## 10. Sequencing

| Step | Work | Depends on |
|---|---|---|
| 1 | §3.1 landmarks, §3.3 listing consolidation | — |
| 2 | §4 projection, decryption, read-time validation, allowlist tests | 1 |
| 3 | §3.2 loader split | 2 |
| 4 | §5 storefront UI + component tests | 2 |
| 5 | §6 browsing parity | 1, 4 |
| 6 | §7 structured data | 2 |
| 7 | §8 telemetry | 2 |
| 8 | §9.3 E2E, §9.4 accessibility, §9.5 seed | 4, 5 |
| 9 | Docs (§13) | all |

Steps 1–2 are the foundation and land together. Steps 6 and 7 are independent of
4–5 once the projection exists. **§4.4 must be answered before step 4 ships.**

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Sensitive column reaches the public payload | Explicit allowlist (§4.2) plus key-set assertion (§9.1); never `select()` on `shop` |
| Encrypted `shippingOrigin` read raw, publishing a ciphertext or `undefined` | `decryptJsonb` mandated (§4.3); round-trip test (§9.1); encrypted seed rows (§9.5) |
| Over- or under-disclosing trader identity | §4.4 decision gate before step 4 |
| Malformed jsonb crashes an anonymous SSR page | Zod parse at read, degrade to absent (§4.3, §4.5) |
| Stored `javascript:` URL becomes XSS | Scheme filter at read *and* render (§4.5, §5.4) |
| Storefront disagrees with search about "in stock" | Mirror search semantics exactly and document (§6.2) |
| Cached profile outlives a suspension | Skip caching in Phase 1 by default (§4.8) |
| Text over seller-uploaded banner fails contrast | Type on scrimmed/solid surface; contrast table entry (§9.4) |
| Heavier query on a hot public page | §3.2 first; aggregates measured before indexing (§4.6) |
| Sparse profiles look broken | Conditional panels (§5.1) with an explicitly sparse fixture (§9.5) |
| Structured-data penalty from thin ratings | Threshold gate on `aggregateRating` (§7) |
| Prometheus cardinality blow-up | Unlabelled counters (§8) |
| en/nl drift | Parity at 0; both files updated per string (§9.6) |

---

## 12. Definition of done

- [x] `ShopProfile` projection is allowlisted, and a test fails if it widens.
- [x] `shippingOrigin` is decrypted, narrowed server-side to country /
      processing time / international, and proven by a round-trip test.
- [x] `policies` is Zod-parsed at read and degrades to absent on failure.
- [x] Trader-identity disclosure decision (§4.4) recorded in this document.
- [x] Banner, tagline, announcement, story, production-partner disclosure,
      policies with statutory-rights statement, languages, origin country,
      socials, member-since, and rating all render — and are all absent, cleanly,
      when unset.
- [x] One `<main>` and one `<h1>` per storefront page; product detail landmark
      fixed too.
- [x] Storefront issues one minimal and one full shop query, not two.
- [x] Sort, in-stock, and in-shop category filters work, are URL-addressable, and
      match search's in-stock semantics.
- [x] JSON-LD carries `sameAs`, `image`, `logo`, country-level `address`, and
      `aggregateRating` only above threshold.
- [x] Telemetry emits without per-shop labels.
- [x] Unit, component, and E2E coverage per §9; the three original shop-page E2E
      tests pass unmodified.
- [x] `make test-accessibility` passes; new contrast pairings in the OKLCH table;
      critical-flow matrix row added with honest `not-run` manual status.
- [x] `messages/en.json` and `messages/nl.json` at exact key parity.
- [x] `make lint`, `make format`, `make check` pass.
- [x] `docs/ARCHITECTURE.md` updated for new directories; backlog entry #1 moved
      to done; §3.4 filed as its own backlog item.

---

## 13. Docs to update on completion

- `docs/ARCHITECTURE.md` — `src/lib/shops/` family and
  `src/route-components/shops/storefront/`.
- `docs/ACCESSIBILITY_ASSURANCE.md` — critical-flow matrix row.
- `docs/plans/feature-depth-backlog.md` — entry #1 done; §3.4 and §6.2 added.

---

## 14. Revision note

The first pass of this plan was written from a trace of the storefront read path.
A second pass against the surrounding subsystems changed six things materially:

1. **`shippingOrigin` is encrypted at rest.** The first pass treated it as a
   plain jsonb column to project a subset from. It requires `decryptJsonb`, and
   publishing any part of it is a PII decision rather than a projection detail
   (§4.3). This would have shipped either a ciphertext string or `undefined`.
2. **`policies` is unvalidated.** Read today with a bare cast; acceptable on an
   authenticated dashboard, not on anonymous SSR (§4.3, §4.5).
3. **The §3.2 loader question is resolved, not deferred.** `head()` receives its
   own route's `loaderData`, so the profile must load in the index route while
   the layout keeps minimal chrome data (§3.2).
4. **Component placement was wrong.** `docs/ARCHITECTURE.md` puts route-owned UI
   in `src/route-components/` mirroring the route path, not
   `src/components/shop/storefront/` (§5.1).
5. **In-stock is semantically ambiguous.** `product.stockCount` and
   `productVariant.stockCount` are independent; search already resolves this one
   way and the storefront must not invent a second (§6.2).
6. **Accessibility is a formal gate.** `make test-accessibility`, an OKLCH
   contrast table, a critical-flow matrix, and "Current exceptions: none" — not
   the informal "verify with the tooling" the first pass assumed (§9.4).

Two smaller additions: `DESIGN.md` explicitly licenses the brand register for
this surface (§5.6), and `withServerCache` exists but is skipped by default
because a cached profile outliving a suspension is worse than an uncached read
(§4.8).
