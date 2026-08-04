# Feature depth backlog

**Opened:** 2026-07-28

A register of surfaces that work correctly but are **shallow relative to the rest
of the platform**. These are not defects — the production-readiness audit is
closed (see [`docs/audits/production-readiness-reconciliation.md`](../audits/production-readiness-reconciliation.md))
and nothing here is a bug. They are gaps between what the platform already
collects or computes and what it actually surfaces.

## The benchmark

The reference standard is the search overhaul in `6fac0a6` (PR #15), which hit
six dimensions in one pass:

| Dimension | What it meant for search |
|---|---|
| Correctness | Pagination truncation past 1000 hits, filter-value escaping, stale-hit handling |
| Domain quality | Bayesian popularity ranking, attribute-ordered relevance, en/nl stemming and synonyms |
| Surface depth | Facet counts, match highlighting, suggestions, in-stock filter |
| Telemetry | `searchEvent` table, click tracking, analytics queries, retention job |
| Ops | Runbook, provisioning and reindex scripts, edge rate limiting, `MEILI_ENV` |
| Tests + i18n | Unit, component, and E2E coverage; every string in `messages/en.json` and `messages/nl.json` |

An entry is "done" when it has been through comparable treatment, not when it
merely looks better.

## Register

| # | Surface | Status | Plan |
|---|---|---|---|
| 1 | Shop storefront / maker profile | **Done** | [`shop-storefront-overhaul.md`](./shop-storefront-overhaul.md) |
| 2 | Category browsing | **Done** | [`category-browsing-overhaul.md`](./category-browsing-overhaul.md) |
| 3 | Reviews | **Done, depth deferred** | [`reviews-overhaul.md`](./reviews-overhaul.md) |
| 4 | Notifications | **Done** | [`notifications-overhaul.md`](./notifications-overhaul.md) |
| 5 | Product detail | **Done** | [`product-detail-overhaul.md`](./product-detail-overhaul.md) |

---

### 1. Shop storefront / maker profile — *done*

The strongest gap between intent and surface in the codebase. Onboarding
collects a full maker profile; the public storefront rendered a name, a
description, and a product grid.

All six benchmark dimensions are covered: the allowlisted public projection
with decryption and read-time validation; the storefront panels; browsing parity
with search; structured data; view and completeness telemetry; and unit,
component, E2E, and accessibility coverage at en/nl parity.

The final CRD Art. 6a(1)(b)/(c) gap closed on 2026-08-03. Onboarding and shop
settings now collect a seller's explicit trader declaration independently from
DAC7 tax identity, and the storefront, product page, and checkout disclose it.
An undeclared legacy shop cannot complete checkout.

See [`shop-storefront-overhaul.md`](./shop-storefront-overhaul.md) for the full
evidence and plan.

---

### 2. Category browsing — *done*

Search received relevance, facets, filters, sorting, and telemetry. The adjacent
discovery surface — serving the same buyer with the same intent — received none
of it.

**Evidence**

- `src/routes/category/$slug.tsx` — the search schema accepts `page` and
  `pageSize` and nothing else. No sort, no price filter, no in-stock filter, no
  facet counts, though `listProductsQuery` already supports `SortOption` and
  price bounds (`src/lib/products/operations.server.ts:79-115`).
- `src/route-components/category/$slug.tsx` carries hardcoded English in an
  otherwise fully localized app: `'Subcategories'`, `'Products'`,
  `'No products in this category yet.'`, and a raw
  `productCount === 1 ? 'product' : 'products'` pluralization. `messages/en.json`
  and `messages/nl.json` are otherwise at exact key parity.
- Pagination navigates with `replace: true`, so paging through a category cannot
  be undone with the browser back button.
- Zero telemetry, while every search interaction is now instrumented.

**Rough shape:** extend the route search schema and reuse `listProductsQuery`
sorting/price filters; add facet counts (the PostgreSQL path can produce them
for a single category cheaply, unlike the general search fallback); extract the
hardcoded strings; drop `replace: true`; add category-browse events alongside
`searchEvent`.

**Built.** See [`category-browsing-overhaul.md`](./category-browsing-overhaul.md).
Three defects surfaced that were not in the evidence above and are worth
remembering as a class:

- The listing query had **no `ORDER BY` at all** — paging could repeat or skip
  products.
- The heading counted drafts, deactivated products, and products from suspended
  shops, so it claimed more than the grid could show (measured 5 vs 4).
- Consolidating onto `buildProductWhere` would have silently dropped every
  subcategory product, because that helper matches a category **exactly** while
  this page must include descendants. Fixed with a separate `categoryIds`
  filter rather than by changing `categorySlug` semantics, which the storefront
  depends on.

Telemetry landed as a Prometheus counter, not a `searchEvent` row — a category
browse is not free text and not personal data, so it does not belong in a table
that exists for GDPR purging.

---

### 3. Reviews — *done*

Reviews became load-bearing when search started ranking on them. The first pass
therefore closed an integrity hole before adding depth: a single report had
silently changed ranking, flagged reviews were counted differently across
surfaces, moderation notified nobody, and required CRD 6a(1)(c), UCPD Annex I
23b, French L.111-7-2, and DSA Article 16/17 disclosures were missing. See
[`reviews-overhaul.md`](./reviews-overhaul.md) §1–§10.

The deferred depth follow-up is now built:

- one official seller reply per review, with owner/2FA authorization, its own
  notice and moderation path, admin audit events, approved-only projection, and
  Article 17 statements of reasons;
- private, idempotent helpful votes with self-vote and own-shop-vote prevention;
- deterministic newest, highest, lowest, and most-helpful sorting plus 1–5-star
  filtering, consistent approved-only counts, aggregates, and pagination;
- accessible, localized buyer and admin interactions with focused database,
  component, disclosure-accuracy, notification, and accessibility coverage.

The public reply attribution uses the shop's published name, not the account
owner's personal name. Reporting either a review or reply records a notice and
does not itself change visibility or ranking.

---

### 4. Notifications — *done*

**Evidence**

- `notification` (`src/db/schema.ts:783`) is `type: text` plus untyped
  `data: jsonb`. The type union is enforced only in Zod at the application edge
  (`src/lib/notifications/operations.server.ts:10`), not in the schema — the same
  class of issue as P2-16 and P2-20 in the closed audit.
- No per-type in-app preferences. `userEmailPreference` governs email; in-app
  notifications are all-or-nothing.
- Delivery is poll-based, with no grouping or digesting, so a burst of order
  events produces a wall of individual rows.

**Rough shape:** promote `type` to a pgEnum with a backfill; per-type
preferences shared with the email preference model; grouping for burst events.

**Built.** See [`notifications-overhaul.md`](./notifications-overhaul.md).

The register was right about the enum and wrong about the polling: there is no
polling. `useUnreadNotificationCount` sets `staleTime` and no `refetchInterval`,
so the badge refreshes on mount and window focus only.

Three things the evidence above did not predict:

- **The DSA Article 17 statement of reasons from entry #3 was never displayed.**
  It was stored complete and correct, and the list rendered only the one-line
  preview. Recording a statement is not providing one.
- The `pgEnum` immediately exposed two writers the Zod enum never covered: a
  direct insert inside the dispute transaction, and a **test factory writing
  `type: 'welcome'`**, a value the application enum never contained.
- Email coverage tracked nothing: a chargeback and a DAC7 threshold warning were
  in-app only, while shipping confirmations emailed. Delivery is now an
  exhaustive table, so adding a type is a compile error until someone decides how
  it reaches anyone.

Also closed: `notification` was the only personal-data table with no retention
rule. `job:notification-cleanup` purges **read** notifications only — an unread
one is undelivered information, and age is not consent to forget it.

**Depth closed 2026-08-04.** Grouping/digesting and per-type in-app preferences
are built; see [`notifications-overhaul.md`](./notifications-overhaul.md) §11.
Preferences toggle exactly what the delivery table declares optional.

---

### 5. Product detail — *done*

The main conversion surface has no path onward and withholds information the
platform already computes.

**Evidence**

- No "more from this shop", no related products. There is no recommendation code
  anywhere in `src/` — the only matches for `recommend` are seed review copy.
- `calculatePackageFromItems` (`src/lib/shipping-estimate.ts`) is used by
  checkout, fulfillment, and returns, but never on the product page — buyers see
  no delivery estimate until they are deep in checkout.
- Stock is in the search index and on the record but drives no urgency or
  availability messaging on the page itself.

**Rough shape:** more-from-this-shop rail (cheap, reuses
`listProductsQuery({ shopSlug })`); shipping estimate surfaced from the buyer's
country; stock/availability messaging.

**Built.** See [`product-detail-overhaul.md`](./product-detail-overhaul.md).

Unlike entries #3 and #4, this one was **mostly not a legal gap** — the CRD
pre-contractual duties attach at checkout, which already discharges them, and
`getProductBySlugQuery` had every visibility filter it should. The three items
above were genuine depth and are built.

The exception: the taxonomy had a **Food & Drink** category, and Regulation (EU)
1169/2011 Article 14(1)(a) requires ingredients, allergens, net quantity and the
food business operator's address to be on the listing before purchase. The
product model has no field for any of it. **Eurtisan does not sell food**, so the
categories were removed (migration `0081`, which refuses rather than orphaning
live listings) and the terms now prohibit food listings and say why — the terms
being the part that survives an admin re-adding a category.

Delivery estimates landed as **dispatch time only**. Transit needs a carrier
quote against a destination, and a delivery date that changes at checkout costs
more trust than it wins.
**Still open from this research:** unit pricing under Directive 98/6/EC is now
planned in [`unit-pricing-overhaul.md`](./unit-pricing-overhaul.md) (2026-08-04),
and the lawyer's read on cosmetics labelling for Soap & Bath remains open;
neither is claimed as settled here.

---

---

## Regulatory gaps

Surfaced 2026-07-28 while resolving the trader-disclosure question for entry #1.
Desk research against primary sources, not legal advice — each should be
confirmed with a qualified adviser before launch. Sources are listed at the end
of this section.

**What does *not* apply:** DSA Article 30(7), which would oblige publishing each
trader's name, address, phone, email, and trade-register details on the product
interface. **Article 29 excludes micro and small enterprise platform operators**
(<10 staff / ≤€2M, and <50 staff / ≤€10M respectively, per Recommendation
2003/361/EC). Eurtisan's operating entity is a French micro-entreprise and
qualifies. The exclusion is lost on designation as a very large online platform,
and lapses 12 months after outgrowing small-enterprise status.

The three items below have **no such exemption**.

### Trader / non-trader declaration — **closed 2026-08-03**

CRD Article 6a(1)(b) (Omnibus, in force 2022-05-28) obliges the marketplace to
tell the consumer, before they are bound, whether the seller is a trader, based
on the seller's own declaration. Where the seller is not a trader, Article
6a(1)(c) requires the marketplace to state that consumer rights stemming from
Union consumer protection law do not apply to that contract.

Eurtisan now stores the explicit declaration as `shop.traderStatus`
(`trader` | `non_trader`). It remains independent from `shop.legalEntityType`,
the DAC7 tax field: no production path derives one from the other.

The declaration is required in seller onboarding and in readiness checks.
Existing rows receive no synthetic backfill; `null` means the seller has not
declared. Owners can correct that state in shop settings, while product and
checkout controls fail closed until they do. The storefront, product page, and
checkout all render the declaration, including the Article 6a(1)(c) consequence
for non-traders.

### Ranking parameters are not disclosed — **closed 2026-07-31**

CRD Article 6a(1)(a) obliges disclosure of the main parameters determining the
ranking of offers, and their relative importance. French Code de la consommation
**L.111-7** imposes the same in national law, with penalties up to €75,000 for
individuals and €375,000 for legal entities.

Search now ranks on `popularityScore`, attribute ordering, and `inStockRank`
(`src/lib/products/meilisearch.server.ts`), plus a Bayesian review prior
(`src/lib/search/relevance.ts`). None of it is disclosed anywhere in the UI.

This belongs to register entry #2 (category browsing) and to search. It is
ironic that the best-documented ranking logic in the codebase is the one the law
requires be explained to users.

**Closed.** `components/browse/RankingDisclosure.tsx` renders on both search and
category, in en and nl, with a variant per surface. The accuracy of the text is
enforced by `src/test/ranking-disclosure-accuracy.test.ts` rather than left to
review — drift makes the disclosure *inaccurate*, which is the failure mode the
article penalises. Also fixed under this heading: the homepage presented recency
as "Featured shops"; it now says "Newest makers".

Still open under the same articles: the trader / non-trader declaration
(6a(1)(b), below) and review-moderation disclosure (L.111-7-2, below).

### Review moderation is not disclosed — **closed 2026-07-31**

French Code de la consommation **L.111-7-2** obliges anyone collecting,
moderating, or publishing consumer reviews to state clearly whether reviews are
checked, and if so how.

Reviews carry `moderationStatus` (`approved` | `flagged` | `hidden`) and are
moderated in admin, with hidden reviews excluded from display aggregates. The
storefront and product pages say nothing about this. Belongs to register entry
#3.

**Closed.** `components/reviews/ReviewDisclosure.tsx` states how reviews are
checked, ordered, dated, moderated and kept, in en and nl, on the product page
and on its empty state. Six of the seven L.111-7-2 items were missing; the
seventh, the free reporting route, already existed.

Two obligations were found alongside it and are also closed:

- **CRD Art. 6a(1)(c)** — whether and how reviews are verified. Eurtisan verifies
  properly (purchase-linked, delivered, one per order item, unique-indexed) and
  never said so. **UCPD Annex I point 23b** makes the undisclosed version a
  *blacklisted* practice, so this was the cheapest and sharpest of the three.
- **DSA Art. 17** — a statement of reasons to the author whenever a review's
  visibility is restricted, demotion included. Verified against the text that
  Art. 19 exempts micro and small enterprises from Section 3 (Arts 20–28) only,
  so Arts 16 and 17 apply at any size.

Accuracy is enforced by `src/test/review-disclosure-accuracy.test.ts` rather than
left to review, on the same reasoning as the ranking disclosure.

**Sources:** [DSA Art. 30](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_30.html) ·
[DSA Art. 29](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_29.html) ·
[CRD Art. 6a](https://service.betterregulation.com/document/417032) ·
[Rec. 2003/361/EC](https://single-market-economy.ec.europa.eu/smes/sme-fundamentals/sme-definition_en) ·
[C. consom. L.111-7](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033219601/) ·
[C. consom. L.111-7-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033207118)

---

## Filed from research, not yet planned

Two items surfaced while researching entry #1. Neither belongs to that plan.

### `shippingOrigin` / `businessAddress` read without decryption — **fixed 2026-07-30**

Filed as four sites. It was **ten**, across two columns. Both are written
encrypted (`src/lib/shops/settings.server.ts:180,184`, `encryptJsonb`), and
`decryptJsonb` passes legacy plaintext through unchanged — so a site that forgot
to decrypt did not throw. It received a base64 string, every property access on
it yielded `undefined`, and the failure was silent.

| Site | Consequence |
|---|---|
| `checkout/order-persistence.server.ts:161` | `sellerCountry` empty → **VAT reverse charge could never apply** on a stored order |
| `checkout/summary.server.ts:184` | same, on the **price quoted to the buyer** before paying |
| `checkout/summary.server.ts:168` | shipping rates quoted from an empty origin |
| `checkout/operations.server.ts:138` | same, at order creation |
| `shop-orders/fulfillment.server.ts:34` | carrier label requested with `undefined` sender address |
| `invoices/operations.server.ts:335,342` | **VAT invoices issued with a blank seller address** |
| `shop-settings.ts:216,222` | settings form showed empty address fields to sellers who had one stored |
| `routes/api/shops/$shopId/settings.ts:54` | ciphertext string in the API response body |
| `products/operations.server.ts:497,504` | `shipping_origin->>'country'` in SQL → homepage "N countries" rendered **0** |

The last one is a different kind: SQL cannot see inside the ciphertext, so no
amount of `decryptJsonb` fixes it. The distinct-count now happens in application
code after decryption, bounded by active shop count and behind the existing
60s stats cache. If that scan ever becomes hot, the alternative is a separate
plaintext `origin_country` column — country alone is already published on the
storefront (§4.3 of the storefront plan), so it is not the sensitive part.

**Why nothing caught it.** The seed *and* `src/test/factories` both wrote these
columns as plaintext, so every dev, E2E, and unit environment took the
legacy-passthrough branch. The factory now encrypts them, which is what turned
the defect into 12 failing checkout tests. Two guards were added:

- `src/test/encrypted-column-reads.test.ts` — static scan rejecting a raw `as`
  cast or SQL `->>` extraction on either column. Mutation-tested. It covers read
  sites that have no behavioural test, which is where all ten lived.
- `src/test/factories/core.ts` — `createShop` writes both columns encrypted, so
  any future read site is exercised against production shape by default.

`src/lib/shops/legal-identity.ts` still casts, deliberately: it takes `unknown`
and both callers pass already-decrypted values. It is listed in the guard's
allowlist with that reason.

### Editing shipping origin in settings destroyed the processing times — **fixed 2026-08-03**

`sell-onboarding.ts` collects `processingTimeDays` and `shipsInternational` and
makes both mandatory. `shop-settings.ts` intentionally accepts a narrower
address object — street, city, postal code, country — because those are the
fields that surface exposes.

The former write path encrypted that narrower input and replaced the complete
stored origin, silently deleting both dispatch fields. `settings.server.ts` now
decrypts the current value, merges only the submitted address fields, and
re-encrypts the complete object. It supports encrypted and legacy plaintext
rows, does not invent absent dispatch data, and stores SQL `NULL` when the seller
explicitly clears the complete origin. Focused persistence tests pin all four
cases. Values lost before the fix cannot be backfilled because their contents
are no longer recoverable; the tolerant public read remains necessary for those
rows.

### "In stock" has no agreed definition for variant products

`product.stockCount` and `productVariant.stockCount` are independent columns.
Variant combinations are generated with `stockCount: 0`
(`src/lib/products/variants.server.ts:507`) and nothing aggregates variant stock
back to the parent row. Search resolves this by using `product.stockCount` alone
(`src/lib/products/meilisearch.server.ts:103`), so a variant product with stock
on every variant but zero on its parent row is treated as out of stock.

The storefront filter now mirrors that rather than inventing a second
definition: `buildProductWhere` pushes `product.stockCount > 0`, with a comment
pointing at the search call site, and a DB test asserts the two produce the same
set. The underlying question — what "in stock" means for a variant product — is
a catalog-domain decision affecting search, browsing, the product page, and
checkout. Whoever fixes it must change both call sites together; the test above
will fail if only one moves.

---

## Not in this register

**Wishlist / favorites does not exist at all** — no table, no code, no route.
That is a net-new feature rather than a depth gap, so it belongs in product
planning rather than here. It is noted because it is a conspicuous absence for a
marketplace and because it would interact with several entries above
(recommendations, notifications, shop follows).
