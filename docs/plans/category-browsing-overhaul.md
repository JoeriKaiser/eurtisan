# Category browsing overhaul

**Opened:** 2026-07-30
**Register entry:** #2 in [`feature-depth-backlog.md`](./feature-depth-backlog.md)
**Reference standard:** the search overhaul in `6fac0a6` (PR #15)

> Untracked by convention, like the other plan docs — kept on disk as a working
> record, not committed.

---

## Scope

Category browsing is the direct sibling of search: same buyer, same intent, none
of the depth. In scope: query consolidation, URL contract, localization,
browsing parity, ranking disclosure (category **and** search), telemetry, and
test/accessibility coverage.

Approved 2026-07-30, including the ranking disclosure across both surfaces and
fixing `replace: true` on all three browsing surfaces together.

---

## 1. Correctness — **built**

### 1.1 The descendant trap

`listProductsByCategorySlugQuery` hand-rolled the conditions `buildProductWhere`
already expressed — the same divergence as the storefront's §3.3. Consolidating
was **not** a straight swap:

- `buildProductWhere` filters `eq(categories.slug, …)` — an **exact** match.
- The category page filtered `inArray(product.categoryId, descendantIds)` —
  **including subcategories**.

Routing category browsing through the slug filter would have silently dropped
every subcategory product the moment a buyer browsed a parent. Resolved by
adding a separate `categoryIds` filter to `ListProductsFilters`, kept distinct
from `categorySlug` rather than folded into it, because the storefront depends
on the exact-match semantics (its filter list is built from categories that
actually occur on that shop's products).

The existing test `includes products in descendant categories`
(`products.test.ts:239`) is the regression guard and passes unmodified.

### 1.2 Non-deterministic pagination

The previous implementation issued **no `ORDER BY` at all**, so PostgreSQL was
free to return rows in any order — a buyer paging through a category could see
the same product twice or miss one entirely. Consolidation fixes this by
inheriting `buildOrderBy`.

Not in the original plan; found while reading the query.

### 1.3 URL contract — **built**

`page`/`pageSize` were `z.string().optional()` fed through `Number(page) || 1`.
Now the storefront's schema shape: bounded, with `.catch()` on every param so a
hand-edited URL degrades to the default view. `sort`, `inStock`, `minPrice`, and
`maxPrice` join them, with euros converted to cents at the route boundary.

### 1.4 The product count did not match the grid — **fixed**

`getCategoryBySlugQuery` counted every product in the category tree with **no
publication or shop-visibility filter**, so the heading counted drafts,
deactivated products, and products from suspended shops. Measured on seeded
data: heading **5**, grid **4**.

Two existing tests asserted the old behaviour by seeding shops and products at
their `draft` defaults; both now seed visible fixtures, and a new test pins the
rule by seeding one visible product against a draft, an inactive, and one owned
by a suspended shop.

---

## 2. Localization — **built**

Four hardcoded English strings and a `productCount === 1 ? 'product' : 'products'`
ternary, in an app otherwise at exact en/nl parity. The ternary is now a proper
message-format plural (`category_product_count`) — Dutch plural rules differ, and
this was the mistake the storefront plan explicitly called out.

Parity: **2183/2183, zero drift.**

**Process note:** the first attempt rewrote both files with sorted keys, which
produced a 4,165-line diff. Reverted and re-applied preserving file order — 19
lines each. Do not re-serialise these files wholesale.

---

## 3. Browsing parity + filter consolidation — **built**

Sort, price, and in-stock, all URL-addressable, reusing `SortOption`.
Subcategory counts come from the existing recursive
`listCategoriesWithCountsQuery`; per-facet counts for a single category are cheap
in PostgreSQL, unlike general search.

This is the **third** filter UI:

| Existing | Shape |
|---|---|
| `route-components/search/SearchFilters.tsx` | Rich (price, facets), string-typed |
| `route-components/shops/storefront/ShopProductFilters.tsx` | Typed, no price |

Per the convention added to `ARCHITECTURE.md` last phase, a second consumer
graduates a component to `src/components/`. Extract a shared browse-filters
component taking the typed shape, with optional price and optional facets.

**Outcome: the plan's shape was wrong and was changed.** Reading both components
showed they do not differ by styling but by interaction *and navigation*
semantics — search's filters live in a collapsible `<details>` aside with
string-typed state, and its sort is `<Link aria-current>` in a `<nav>`, versus
`<button aria-pressed>` in a `<fieldset>` on the storefront. One component
absorbing both would have needed six boolean props and been worse than two.

**Built instead:** `src/components/browse/BrowseFilters.tsx`, consumed by the
storefront and the category page — the two that genuinely share a model. The
storefront migrated with **all 53 tests passing unmodified**, axe scans included,
and `ShopProductFilters.tsx` was deleted. `/search` is left alone and the reason
is recorded in the component's doc comment; migrating it is a navigation
semantics decision, not a refactor.

Also built: subcategory product counts via `getChildCategoriesWithCounts`, a
single recursive query rather than a count per child.

---

## 4. Ranking disclosure — CRD 6a(1)(a) / C. consom. L.111-7 — **built**

Legally required, **no micro/small exemption** (unlike DSA Art. 30, which the
storefront plan established does not apply). Penalties to €75,000 for
individuals and €375,000 for legal entities.

Search's actual parameters, in precedence order, from
`meilisearch.server.ts:207`:

`words → typo → proximity → attribute → sort → exactness → inStockRank:desc →
popularityScore:desc`

- `attribute` order: `name` > `shopName` > `categoryName` > `description`
- `popularityScore` = Bayesian rating × 20 + log₁₀(reviewCount + 1) × 10
  (`search/relevance.ts:44`)
- Typo tolerance: 1 typo from 4 chars, 2 from 8
- Synonyms and en/nl tokenization apply

Category browsing has no text query, so its disclosure is genuinely short: the
sort the buyer chose, newest by default.

**Verified: no paid placement exists anywhere** — no sponsored/promoted/boost
mechanism in the schema or lib. Both disclosures state this.

**Built:** `src/components/browse/RankingDisclosure.tsx`, a `<details>` (keyboard
and screen-reader reachable without JS, and it does not push results down when
closed), with `variant: 'search' | 'category'`. Two variants rather than one
vague text, because the surfaces genuinely rank differently. Rendered on both.

### 4.1 "Featured" is recency — **fixed**

`getFeaturedShopsQuery` orders by `desc(shop.createdAt)` — no curation, no
payment. Four labels presented this as editorial: `home_shops_title`,
`home_hero_featured_maker`, `search_featured_collections`,
`megamenu_spotlight_title`. Presenting recency as "featured" without disclosing
the criterion is what L.111-7 targets.

Fixed at the one place the claim was load-bearing: the homepage shop rail now
uses `home_shops_title_recent` ("Newest makers" / "Nieuwste makers"), which
states the criterion instead of implying curation. `HomePage.test.tsx` asserted
the old string and was updated to the corrected behaviour.

### 4.2 The coupling is now enforced

The disclosure text is derived from `rankingRules`, but nothing linked them: that
array is configured against Meilisearch at deploy time from a server-only module,
and the disclosure is eight translated strings. A change to either could not fail
the other's tests, and a *drifted* disclosure is an inaccurate ranking statement
— exactly what L.111-7 penalises, so silent drift is worse than no disclosure.

`src/test/ranking-disclosure-accuracy.test.ts` pins the mapping: every ranking
rule names the message that discloses it, in precedence order; `searchableAttributes`
order matches the order the text names the four fields in, per locale; no
orphaned steps; the component renders all of them; and the schema still contains
no sponsored/promoted/boost field, so the "cannot pay to rank higher" claim stays
true. Mutation-tested three ways — reordering plus adding a rule, swapping two
searchable attributes, and dropping a rendered step — each caught by the intended
test and no other. Both source files carry a pointer back to it.

---

## 5. Telemetry — **built**

**Firm verdict: do not reuse `searchEvent`.** Its `normalizedQuery` is `NOT NULL`,
and the table exists specifically because query text is personal data on a GDPR
purge schedule (`jobs/search-event-cleanup`). A category browse is neither free
text nor personal data.

Use a Prometheus counter labelled by category slug. **36 categories** — a
bounded, curated set, so the cardinality is safe. This is the opposite of the
shop-slug case, where labelling was rejected for unbounded growth.

**Built:** `categoryViewsTotal` in `metrics.server.ts`, incremented in
`getCategoryBySlugQuery`. Two properties worth keeping if this moves:

- Counted in the server query, not the route loader — a client-side navigation
  cannot inflate it, and a miss is not a view.
- The label is the **resolved slug from the database**, never the raw URL
  segment, so a request for `/category/<anything>` cannot mint a new series.
  This is what keeps the cardinality bound real rather than assumed.

Verified live: `eurtisan_category_views_total{category_slug="ceramics"} 1`.

---

## 6. Tests and gates — **built**

- Unit: descendant filtering, sort, deterministic ordering, facet counts, URL
  degradation. The pre-existing `includes products in descendant categories`
  passes unmodified.
- Component: `route-components/category/$slug.test.tsx`, 18 tests including two
  axe scans. The storefront's 53 passed unmodified through the `BrowseFilters`
  migration.
- E2E: `category-detail.spec.ts` and `category-all.spec.ts` unmodified.
  **Not run** — the full gate takes about an hour and was deliberately skipped
  this phase. 18 pre-existing failures unrelated to this work remain.
- Accessibility: category matrix row added; `make test-accessibility` → 214
  tests, `A11Y=0`.
- en/nl parity: **2197/2197, drift 0**.

Full run: **238/238 test files**, `tsc`/`lint`/`format` clean, `promtool-check`
and `promtool-test` clean.

Verified against real seeded data rather than fixtures alone — heading 14 vs
grid 14 (§1.4 was 5 vs 4), `ceramics-porcelain=4` / `ceramics-pottery=7`,
`price_asc` ordering `5116 ≤ 6284 ≤ 10081`.

---

## 7. Cross-surface decision: `replace: true` — **built**

Category, storefront, and search all navigated with `replace: true`, so paging and
filtering could not be undone with the browser back button. The storefront matched
search deliberately last phase. **Approved to fix all three together** rather
than leave category inconsistent; all three now `push`. The storefront test
asserting `replace: true` encoded the old behaviour and was updated.
