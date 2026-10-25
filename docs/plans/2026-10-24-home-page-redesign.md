# Home Page Redesign: "The Lisbon Atelier" Implementation Plan (Revised)

## 1. Context & Architectural North Star

### 1.1 Project & Subsystem Context
Eurtisan is a European-centered marketplace for independent creatives, artisans, and makers. It is established in France, EUR-first, GDPR-conscious, and compliant with EU consumer protection regulations (CRD Directive 2011/83/EU, Omnibus Directive (EU) 2019/2161, UCPD Directive 2005/29/EC, and Directive 98/6/EC unit pricing).

The root route (`/`, defined in `src/routes/index.tsx`) renders the marketplace home page. Currently, the implementation is transitional: `src/routes/index.tsx` delegates to `src/components/HomePage.tsx`, which composes sub-components in `src/components/home/*.tsx` totaling ~840 lines of code.

### 1.2 The Problem
The current home page looks and feels like an anonymous SaaS template with an e-commerce skin:
1. **Structural Monotony:** Eight stacked sections with identical visual rhythm (hero, stats strip, 4-column product grid, 4-box trust strip, 3-column shop card grid, 3-column category grid, centred CTA box, footer).
2. **Absence of Makers & Origin:** The "Newest makers" section shows "Shop O Haven · 9 products" beside an SVG store icon. No maker face, name, country, or craft story appears. Product cards display price and shop name, but no origin.
3. **Breach of `DESIGN.md` Guidelines:** `DESIGN.md:241-248` explicitly prohibits generic bootstrap marketplace card grids with icon + heading + text repeated endlessly, and prohibits SaaS-cream minimalism (white cards on cream). The declared north star is "The Lisbon Atelier" (warm stone, handmade paper, moss glaze, linen), but the implementation uses only white, cream, and dark green.
4. **Variable Font Underutilization:** Fraunces is self-hosted in `public/fonts/` as a full variable font with optical size (`opsz` 9..144) and weight (`wght` 100..900) axes, but `public/fonts/fonts.css` declares it as two static weights (500 and 700).
5. **Misleading Commercial Claim (Legal Risk):** The guest pre-footer CTA (`messages/en.json:1697`) advertises "Join thousands of European makers", while the stats strip directly above displays 22 active makers. Under UCPD Directive 2005/29/EC Arts. 6-7, advertising thousands of makers on an early-stage platform is an unsubstantiated commercial claim.
6. **Hardcoded English Strings:** Several components contain unlocalized English text (`"Spotlight"`, `"View all products"`, `"Shop "`, landmark aria-labels), violating the Paraglide i18n contract across the 24 supported EU locales.
7. **Local Environment Defect:** The local Docker container has empty `IMGPROXY_KEY` and `IMGPROXY_SALT` variables, causing product images through `/api/image` to fail with HTTP 500 errors.

---

## 2. Technical Decisions & Invariants (Post-Review Hardening)

### 2.1 Maker Origin, Encryption Boundary & Runtime PII Safety
- `shop.shippingOrigin` and `shop.businessAddress` are encrypted JSONB columns (`encryptJsonb`).
- For public surfaces, `src/lib/shops/public-profile.ts:38-54` provides `parsePublicOrigin(decryptJsonb<unknown>(row.shippingOrigin))`. This parses the origin and deliberately discards street, city, state, and postal code as PII, returning only `{ country: string }`.
- **Runtime PII Leakage Protection:** TanStack Start serializes route loader data into the HTML hydration payload. If `getFeaturedShopsQuery` selects `shop.shippingOrigin` and uses object spread (`...r`), JavaScript retains the ciphertext or raw address object at runtime, sending it to client browsers.
- **Decision:** In `getFeaturedShopsQuery`, explicitly destructure and omit `shippingOrigin`:
  ```ts
  return result.map(({ shippingOrigin: rawOrigin, ...rest }) => {
    const origin = parsePublicOrigin(decryptJsonb(rawOrigin))
    return {
      ...rest,
      productCount: Number(rest.productCount),
      country: origin?.country ?? null,
    }
  })
  ```
  Add an explicit allowlist unit test in `src/lib/products.test.ts` asserting that serialized output never contains `shippingOrigin`, `businessAddress`, `city`, `street`, or `postalCode`.

### 2.2 Ranking Honesty & Factual Labeling
- `src/test/ranking-disclosure-accuracy.test.ts` enforces that sellers cannot pay for ranking and that no paid placement exists (`sponsored`, `promoted`, etc.).
- `getFeaturedShopsQuery` selects active, non-suspended shops ordered strictly by `desc(shop.createdAt)`.
- **Decision:** Under UCPD Art. 6(1)(b), labeling an automated chronological query as "Featured Studio" or "Spotlight" is deceptive. The lead maker tile and section must be labeled factually: "New to Eurtisan" or "Newest Maker", accompanied by the studio's country and craft discipline.
- **Filtering:** To prevent an empty or unvetted shop from dominating the hero, filter in application code for a shop that has `image !== null` and `productCount > 0`. If none qualifies, fall back to default brand photography.

### 2.3 Product Card Legal Requirements & E2E Snapshot Protection
- `src/components/ProductCard.tsx` encapsulates mandatory legal requirements pinned by tests (EUR price format, VAT status, Directive 98/6/EC `<UnitPriceNote />`, stock badges, accessible label).
- **E2E Snapshot Contract:** `e2e/customer/homepage.spec.ts:19-27` takes a screenshot of the first product card image and compares it to `seeded-product-image.png`. Doubling the dimensions of the first card (`col-span-2 row-span-2`) breaks this snapshot and fails the mobile height comparison (`< 50px` height difference between cards 1 and 2 at lines 40-45).
- **Decision:** Re-use `ProductCard` without breaking dimensions. On desktop, introduce visual rhythm through subtle container framing, editorial section headings, and curated category vignettes, while maintaining the responsive 1-to-4 column grid for product cards.

### 2.4 Hero Search Input Preservation
- `e2e/customer/homepage.spec.ts:62-63` asserts:
  `await expect(page.getByRole('searchbox', { name: /search for handmade products/i })).toBeVisible()`
- `src/components/HomePage.test.tsx:184-235` contains 5 tests asserting search form navigation, validation errors on empty submit, error clearing on typing, and whitespace trimming.
- **Decision:** Do NOT remove the hero search form. Style it with Lisbon Atelier aesthetics (warm borders, tactile background, Manrope typography). This improves the visual design while keeping all unit and Playwright tests green.

### 2.5 Contrast & Text over Photography Rule
- `src/route-components/shops/storefront/ShopBanner.tsx:85-87` establishes the repository rule:
  `"No text is placed on the photograph itself — contrast over an uncontrolled image cannot be proven, so type stays on solid surfaces below."`
- Over light photography, scrims fail WCAG 2.1 AA 4.5:1 text contrast.
- **Decision:** All category titles, maker labels, and craft descriptions must sit on solid semantic surfaces (`bg-surface-default` or `bg-bg-base`) below or adjacent to imagery, never overlaid directly on photography.

### 2.6 Font Loading, Preload & CLS Prevention
- Fraunces latin variable font (`/fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2`, 66 KB) contains full variable axes: `opsz` (9..144) and `wght` (100..900).
- **CSS Syntax:** `font-variation-settings: "opsz" auto;` is invalid CSS. Use `font-optical-sizing: auto;` directly.
- **CLS Prevention:** To avoid layout shift when Fraunces swaps in above the fold, preload the font in `src/routes/__root.tsx`:
  `<link rel="preload" href="/fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />`
- **Mobile Clamp:** Set hero headline clamp to `clamp(2rem, 5vw, 3.75rem)` with `overflow-wrap: anywhere` to prevent layout overflow on 320px screens in inflected languages like German or Finnish.

### 2.7 Simplicity & Architectural Placement (KISS/YAGNI)
- The existing components in `src/components/home/*.tsx` total only ~840 lines across 8 files.
- Creating an extra `panels/` subfolder adds unnecessary directory nesting not found in reference implementations (`src/route-components/shops/storefront/`).
- **Decision:** Keep the sub-components in `src/components/home/*.tsx` and `src/components/HomePage.tsx` (or migrate directly to `src/route-components/home/*.tsx` without an artificial `panels/` layer). Avoid renaming files solely for cosmetic tree re-organization.

---

## 3. Step-by-Step Implementation Plan

### Phase 1: Environment & Font Infrastructure

#### Task 1.1: Local imgproxy credentials fallback in Docker Compose
- **Goal:** Fix the 500 error on `/api/image` requests in local development without requiring manual file edits.
- **Files:** `docker-compose.yml`
- **Action:** Update `docker-compose.yml:110-111,140-141` to provide safe deterministic development fallback hex keys:
  ```yaml
  IMGPROXY_KEY: ${IMGPROXY_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
  IMGPROXY_SALT: ${IMGPROXY_SALT:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}
  ```
  matching `docker-compose.e2e.yml:11-12`.
- **Verification:** Run `curl -I "http://localhost:3000/api/image?key=products%2F6ef70287-e4ee-4c09-8917-889e0f317c3d-0.jpg&format=webp"` and confirm HTTP 307 or 200.

#### Task 1.2: Enable Fraunces variable font axes and font preloading
- **Goal:** Unlock weight range (100..900) and optical sizing for Fraunces while eliminating FOUT/CLS.
- **Files:** `public/fonts/fonts.css`, `src/styles.css`, `src/routes/__root.tsx`
- **Action:**
  1. In `public/fonts/fonts.css:1-54`, replace the static `font-weight: 500;` and `font-weight: 700;` blocks with unified `font-weight: 100 900;` blocks for each unicode subset.
  2. In `src/styles.css`, add `font-optical-sizing: auto;` to `.display-title`. Do NOT add invalid `"opsz" auto` to `font-variation-settings`.
  3. In `src/routes/__root.tsx:44-53`, add `<link rel="preload" href="/fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />`.
- **Verification:** Inspect in DevTools; verify computed font weight varies and no layout shift occurs on initial render.

---

### Phase 2: Data Queries & Server Functions

#### Task 2.1: Surface country origin safely with caching in `getFeaturedShopsQuery`
- **Goal:** Provide maker country of origin to the home page without leaking PII or burdening the hot path.
- **Files:** `src/lib/products/types.ts`, `src/lib/products/operations.server.ts`
- **Action:**
  1. Update `FeaturedShop` in `src/lib/products/types.ts:31-40` to add `country: string | null;`.
  2. In `src/lib/products/operations.server.ts:572-598` (`getFeaturedShopsQuery`):
     - Wrap query execution in `withServerCache('cache:shops:featured:6', 300_000, ...)` (5-minute TTL).
     - Select `shop.shippingOrigin` in the Drizzle query.
     - Destructure to omit `shippingOrigin` from the returned object:
       ```ts
       return result.map(({ shippingOrigin: rawOrigin, ...rest }) => {
         const origin = parsePublicOrigin(decryptJsonb(rawOrigin))
         return {
           ...rest,
           productCount: Number(rest.productCount),
           country: origin?.country ?? null,
         }
       })
       ```
  3. Add an allowlist unit test in `src/lib/products.test.ts` verifying no address PII exists on the return value.
- **Verification:** Run `make test src/lib/products.test.ts`.

---

### Phase 3: Localization (Paraglide & 24 EU Locales)

#### Task 3.1: Add new semantic keys and fix misleading claims in `messages/en.json`
- **Goal:** Fix the UCPD misleading claim, provide honest copy for new sections, and fix hardcoded strings without marketing slop.
- **Files:** `messages/en.json`
- **Action:**
  1. **Fix misleading pre-footer claim:**
     Replace `"home_pre_footer_desc_guest": "Join thousands of European makers selling custom and artisan goods."` with:
     `"home_pre_footer_desc_guest": "Join our growing community of independent European makers and share your craft with buyers across the continent."`
  2. **Add missing keys for hardcoded strings:**
     - `"home_category_spotlight_badge": "Spotlight"`
     - `"home_products_view_all": "View all products"`
     - `"home_shop_prefix": "Studio {name}"`
     - `"home_stats_landmark": "Marketplace statistics"`
     - `"home_charter_landmark": "Our craft charter"`
  3. **Add legally compliant charter copy (no deceptive claims):**
     - `"home_charter_title": "Crafted with intention, traded with care"`
     - `"home_charter_desc": "Every object on Eurtisan comes from an independent workshop in Europe."`
     - `"home_charter_item_1_title": "Direct from the workshop"`
     - `"home_charter_item_1_desc": "Support independent creators directly. Every purchase funds the workshop of European artisans."` (Avoids false "No middlemen" claim).
     - `"home_charter_item_2_title": "Documented studio location"`
     - `"home_charter_item_2_desc": "Every maker profile displays where the studio is established within Europe."` (Avoids false "every listing states origin" claim).
     - `"home_charter_item_3_title": "Protected under EU law"`
     - `"home_charter_item_3_desc": "European consumer rights, transparent pricing, and secure payment processing via Mollie."` (Avoids false "escrow" claim).

#### Task 3.2: Propagate translations across all 24 EU locales
- **Goal:** Maintain exact key parity across all language catalogs without failing CI.
- **Files:** `messages/*.json`, `messages/.translation-hashes.json`
- **Action:**
  1. Add translations for the newly added keys across the other 23 EU language files.
  2. Run `bun run scripts/translate-locales.ts --sync` to update translation hashes.
  3. Verify with `bun run scripts/translate-locales.ts --verify`.
  4. Compile with `make i18n-compile`.
- **Verification:** `bun run scripts/translate-locales.ts --verify` must exit with code 0.

---

### Phase 4: UI Refinement & Panel Styling

#### Task 4.1: Restyle `HomeHeroSection.tsx`
- **Location:** `src/components/home/HomeHeroSection.tsx`
- **Design:**
  - Asymmetric layout with Fraunces optical display typography.
  - Headline clamp: `clamp(2rem, 5vw, 3.75rem)` with `overflow-wrap: anywhere;`.
  - Editorial kicker in warm sage (`text-accent-secondary`) using Manrope, removing `font-mono`.
  - Retain the hero search form, styling it with warm borders and tactile surfaces (`e2e/customer/homepage.spec.ts:62`).
  - Maker spotlight card on right: Filter for a shop with an image and products. Display shop image, factual "New to Eurtisan" badge, maker name, country origin pill, and tagline. Resting card is flat (`shadow-none border border-border-subtle`).

#### Task 4.2: Restyle `HomeStatsStrip.tsx`
- **Location:** `src/components/home/HomeStatsStrip.tsx`
- **Design:**
  - Retain existing metrics to satisfy `HomePage.test.tsx:455-460`.
  - Render with tactile hairline dividers (`border-y border-border-subtle bg-surface-default/40 py-6 sm:py-8`).
  - Use tabular nums and warm typography.

#### Task 4.3: Restyle `HomeFeaturedProducts.tsx`
- **Location:** `src/components/home/HomeFeaturedProducts.tsx`
- **Design:**
  - Retain `ProductCard` to ensure all statutory disclosures (EUR format, VAT status, unit pricing, stock) remain 100% compliant and tested.
  - Maintain identical card dimensions on mobile to keep `e2e/customer/homepage.spec.ts:40-45` green (`< 50px` height difference between cards 1 and 2).
  - Retain identical primary card dimensions to preserve `seeded-product-image.png` snapshot.

#### Task 4.4: Restyle `HomeFeaturedShops.tsx`
- **Location:** `src/components/home/HomeFeaturedShops.tsx`
- **Design:**
  - Section heading: `m.home_shops_title_recent()` ("Newest makers") with subtitle.
  - 3-column grid of maker profile cards.
  - Maker avatar with view transition name (`getShopImageTransitionName(shop.id)`).
  - Studio name, localized origin country pill (e.g. "Portugal"), craft discipline badge, and bio snippet.

#### Task 4.5: Restyle `HomeCategoryDiscovery.tsx`
- **Location:** `src/components/home/HomeCategoryDiscovery.tsx`
- **Design:**
  - Showcase craft disciplines (Ceramics, Textiles, Woodwork) using existing assets (`public/images/megamenu/*.webp`).
  - Text placed strictly on solid semantic surfaces below imagery per `ShopBanner.tsx:86` (no text overlaid on photos).

#### Task 4.6: Restyle `HomeValuePropositionStrip.tsx` (Craft Charter)
- **Location:** `src/components/home/HomeValuePropositionStrip.tsx`
- **Design:**
  - Editorial manifesto section on warm surface with hairline dividers.
  - Displays the four legally compliant charter principles.

#### Task 4.7: Restyle `HomePreFooterCTA.tsx`
- **Location:** `src/components/home/HomePreFooterCTA.tsx`
- **Design:**
  - Retain all auth-conditional routing logic (`/studio/:id`, `/sell/onboarding/:id`, `/sell/status/:id`, `/sell`).
  - Warm container with flat resting state (`shadow-none border border-border-subtle`).
  - Honest copy from updated `home_pre_footer_desc_guest`.

---

### Phase 5: Verification & Quality Gates

#### Task 5.1: Unit & Component Tests
- Run `make test src/components/HomePage.test.tsx` and `make test src/lib/products.test.ts`.
- Verify all 464 lines of test assertions pass.

#### Task 5.2: E2E Playwright Suite
- Run the homepage E2E spec in Docker:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.e2e.yml exec -e E2E_DATABASE_URL=postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test app bunx playwright test e2e/customer/homepage.spec.ts
  ```

#### Task 5.3: Repository Quality Gates
- `make lint`
- `make format`
- `make check`
- `make test-accessibility`
- `make bundle-check`
- `make test`

---

## 4. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Runtime PII Leakage** | TanStack Start loader serializes `shippingOrigin` ciphertext or address PII to client. | Explicitly destructure and omit `shippingOrigin` in `getFeaturedShopsQuery`. Guard with projection allowlist unit test. |
| **Hero Font Swap Layout Shift (CLS)** | Fraunces optical size swap reflows text above the fold. | Add `<link rel="preload" as="font">` in `src/routes/__root.tsx`. |
| **E2E & Test Breakages** | Deleting search or resizing cards breaks Playwright tests. | Retain hero search form; keep mobile card dimensions identical. |
| **UCPD Misleading Commercial Claims** | Claims like "no middlemen" or "escrow" violate EU law. | Revised charter copy to accurately reflect platform intermediary role and Mollie payment processing. |
| **CSS Gzip Budget Overrun** | 1.4 KB gzip headroom in `config/bundle-budgets.json`. | Re-use existing Tailwind utility classes; enforce `make bundle-check` in CI. |
