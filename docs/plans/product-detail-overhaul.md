# Product detail overhaul

**Opened:** 2026-07-31
**Register entry:** #5 in [`feature-depth-backlog.md`](./feature-depth-backlog.md)
**Reference standard:** the search overhaul in `6fac0a6` (PR #15)
**Status:** approved 2026-07-31; §1–§5 built

> Untracked by convention, like the other plan docs — kept on disk as a working
> record, not committed.

---

## 0. Unlike the last two entries, this one is mostly not a legal gap

Entries #3 and #4 each turned up obligations that were unmet. This one largely
does not, and it is worth saying so explicitly rather than manufacturing
symmetry.

The CRD pre-contractual information duties attach **before the consumer is
bound**, which is checkout, not the product page — and checkout already delivers
them: `components/checkout/CheckoutLegalDisclosures.tsx`, shipping options
carrying `estimatedDays`, and the seller identity block the order-confirmation
email mirrors. `getProductBySlugQuery` also has every visibility filter it should
(shop active, not suspended, product published and active), so there is no repeat
of the category page's counting bug.

So the register's three items — more-from-this-shop, delivery estimate, stock
messaging — are genuine depth, and correctly scoped.

**With one exception, below, which is a real and structural gap.**

---

## 1. The platform sells food and cannot carry food information — **category removed**

**Regulation (EU) 1169/2011, Article 14(1)(a)** — verified against the text
rather than recalled:

> in the case of prepacked foods offered for sale by means of distance
> communication […] mandatory food information, except the particulars provided
> in point (f) of Article 9(1), shall be available **before the purchase is
> concluded** and shall appear on the material supporting the distance selling or
> be provided through other appropriate means clearly identified by the food
> business operator. When other appropriate means are used, the mandatory food
> information shall be provided without the food business operator charging
> consumers supplementary costs

Everything in Article 9(1) except the date of minimum durability must therefore
be on the product page — including **9(1)(c), allergens**, plus the name of the
food, the ingredients list, net quantity, storage conditions, the food business
operator's name and address, and alcoholic strength where it applies.

**The `product` table has no field for any of it.** `name`, `description`,
`priceCents`, `stockCount`, `weightGrams` and the dimensions — that is the whole
model. A seller listing jam or dried herbs today has nowhere to put an ingredient
list, and the buyer has no way to see one.

The taxonomy makes this concrete: **Food & Drink** is a root category, and
**Botanical › Herbs** is culinary-adjacent. (The seeded rows in those categories
are randomly generated non-food items, so nothing is live today — the gap is
structural, not an active breach.)

This is not a disclosure that can be written as prose next to the product, the
way the ranking and review disclosures were. It needs fields, seller input, and
validation gated on category.

**Proposed fix, and it is deliberately the smallest one that complies:**

- A `productFoodInfo` table keyed to `product`, carrying ingredients, allergens,
  net quantity, storage conditions, and the food business operator's name and
  address. One table rather than columns on `product`, because it applies to a
  small fraction of listings.
- Required at publish time when the product's category is under Food & Drink —
  enforced server-side, since a client-side rule is not a compliance control.
- Rendered on the product page, above the fold rather than buried.
- The date of minimum durability is **excluded** by Article 14(1)(a) itself, and
  should not be collected.

**Open question for the user.** The alternative is to **remove Food & Drink from
the taxonomy** until this is built. That is a one-line change and is the honest
option if food is not actually a category you want. I would rather ask than
assume: building the fields is roughly a phase of work, and deleting the category
is minutes.

### 1.1 Two adjacent ones I am *not* claiming

- **Cosmetics (Soap & Bath).** I checked Regulation 1223/2009 Article 19 and it
  does **not** carry a distance-selling rule equivalent to food's Article 14 —
  19(3) is about notices beside unpackaged products in a shop. Cosmetics
  labelling duties fall on the product, not the listing. Worth a lawyer's eye,
  but I am not going to present it as settled when it is not.
- **Unit pricing (Directive 98/6/EC).** Requires a price per kg/litre for goods
  sold by weight or volume. `weightGrams` exists but is nullable and used only
  for shipping estimates. Member-state exemptions vary and small-quantity
  artisan goods are commonly out of scope. Flagged, not proposed.

---

## 2. More from this shop — **built**

There is no recommendation code anywhere in `src/` — the only matches for
`recommend` are seed review copy. The cheapest honest version needs none:
`listProductsQuery({ shopSlug })` already exists, already applies every
visibility filter, and already sorts.

**Proposed:** a rail of other products from the same shop, excluding the current
one, capped at a handful, hidden when the shop has nothing else. No
"related products" across shops — that is a recommender, and inventing one from
category adjacency produces the kind of rail nobody clicks.

---

## 3. Dispatch time, not delivery date — **built**

The register asks for a delivery estimate from the buyer's country. Half of that
is available with no address at all, and half is not:

- **Processing time is known.** `shippingOrigin.processingTimeDays` is on the
  shop, validated by `publicOriginSchema`, and **already rendered on the
  storefront** by `ShopPoliciesPanel`. The product page shows nothing.
- **Transit time is not.** It comes from a carrier rate quote, which needs a
  destination. Guessing it would be worse than omitting it, and a delivery date
  that turns out wrong at checkout is a trust problem, not a conversion win.

**Proposed:** show dispatch time ("usually dispatched in 1–3 business days") from
data already on the shop, and say plainly that delivery cost and time are
calculated at checkout. Not a fake delivery date.

The upstream settings defect was fixed on 2026-08-03. Address edits now decrypt
the current shipping origin, merge only the submitted address fields, and
re-encrypt the complete object, preserving `processingTimeDays` and
`shipsInternational`. Rows that lost those values before the fix cannot be
backfilled because the original values are unrecoverable, so the product
projection remains tolerant of missing processing times.

---

## 4. Stock messaging — **built**

`stockCount` renders as a raw number, and `lowStockThreshold` — a per-product
column the low-stock job already uses — is not consulted by the page at all.

**Proposed:** availability language driven by the seller's own threshold rather
than a hardcoded number, with the exact count shown only when it is genuinely low.
No countdown timers, no "3 people are viewing this" — those are the practices
UCPD Annex I and the Omnibus amendments target, and this codebase has been
careful not to have any.

---

## 5. Smaller findings — **resolved**

- The review summary is rendered by `ProductReviews` at the very bottom of the
  page. The aggregate is already computed; a compact rating line near the price,
  linking down to the reviews, costs nothing and is what buyers look for first.
- `ProductDetail` is a single 313-line component holding the gallery, the buy
  form, the shop card, and the layout. Adding three sections to it as-is will
  make it unpleasant. Worth extracting the buy form while touching it, not as a
  goal in itself.

---

## 6. Proposed scope

**In:** §2 (more from this shop), §3 (dispatch time), §4 (stock messaging), §5
(rating line), and the extraction §5 implies.

**In, if you want it:** §1 food information. It is the only legally load-bearing
item here and it is also the largest — schema, seller form, category-gated
validation, and rendering. It does not fit alongside the rest without doubling
the phase.

**Out:** cross-shop recommendations.

**Decisions for you:**

1. **Food & Drink: build the fields, or drop the category?** Both are defensible;
   they are very different amounts of work.
2. Whether §1, if built, is this phase or its own.

**Gates:** unit tests for the shop-rail query and the stock-language rules;
component tests plus axe for the new sections; en/nl parity;
`make test-accessibility`; the product-detail E2E specs pass unmodified.

---

## 8. What was built

### 8.1 Food is gone, and the rule outlives the taxonomy

**Decision: Eurtisan does not sell food.** So the fields were not built; the
capability was removed.

- `Food & Drink` and its `Preserves` / `Honey` / `Spices` children are out of
  `seed.ts`, with the Article 14 reasoning recorded where the taxonomy is
  defined.
- Migration `0081` deletes them from existing databases. It **refuses** rather
  than orphaning: `product.category_id` is `ON DELETE SET NULL`, so deleting the
  categories under live food listings would leave them published and
  uncategorised. If a deployment has any, a human decides.
- The prohibited-conduct section of the terms now says food may not be listed,
  **and why** — in both locales. That is the part that actually holds: a
  taxonomy can be re-added by an admin in a form, and `Botanical › Herbs` is
  already close enough to culinary that category removal alone would not settle
  it.

Left alone deliberately: `Botanical › Herbs`, which sits beside `Dried Flowers`
and `Wreaths` and reads as decorative. The terms cover the edge case.

### 8.2 More from this shop

`getMoreFromShopQuery` routes through `listProductsQuery` rather than
hand-rolling, so it inherits every visibility filter and a deterministic
`ORDER BY` — the two things the category page turned out to be missing when it
hand-rolled its own. A new `excludeProductId` filter keeps the current product
out of its own rail.

`MoreFromShop` reuses `ProductGrid`, so cards, pricing, VAT lines, and
out-of-stock treatment cannot drift from every other listing surface. Fetched in
the same server call as the product, since the rail is above the fold.

Still no cross-shop "related products": there is no recommender here, and one
synthesised from category adjacency produces a rail of things that merely share
a label.

### 8.3 Dispatch, not delivery

`dispatchDays` comes off the shop's encrypted `shippingOrigin` — decrypted
server-side, with **only** the processing window taken off it, because the rest
of that object is the maker's dispatch address.

The page states the dispatch window and says plainly that delivery cost and time
are calculated at checkout. No invented delivery date. Legacy or previously
damaged rows can still lack processing times; in that case the line is omitted
rather than rendered blank, and a test pins that degradation.

### 8.4 Availability

`resolveAvailability` is a pure function over the stock count and the **seller's
own** `lowStockThreshold`, the column the low-stock job already reads with the
same `<=`. Above the threshold the page says "In stock" without a number; at or
below it, the exact count. A negative count reads as out of stock, not as
"Only -1 left".

No countdowns, no "3 people are viewing this". Those are what the Omnibus
amendments to the UCPD target, and this codebase has none.

### 8.5 Rating beside the price

The aggregate was already computed for the summary at the bottom of the page.
It now also renders next to the price, linking to `#product-reviews`, and shares
`PUBLIC_REVIEW_FILTER` with the review list and the search index — so the compact
figure cannot disagree with the full one.

---

## 9. Gates

- **249 test files, 3,021 tests, all passing.** `tsc`, lint, format clean.
- en/nl parity **2266/2266, drift 0**.
- `make test-accessibility` passes.
- Verified after a full reseed: `dispatchDays {min:3,max:7}`, threshold 5 against
  stock 147 (so "In stock", no number), a 4-item rail excluding the product
  itself, `rating {reviewCount:1, average:2}` on a reviewed product, and **zero
  food categories remaining**.
- E2E not run — same call as the previous three phases.

---

## 10. Not done

- **Unit pricing (98/6/EC)** — planned 2026-08-04 in
  [`unit-pricing-overhaul.md`](./unit-pricing-overhaul.md): Soap & Bath is on
  the French Annex II list, candles are not; scope, schema, and disclosure
  design settled there.
- **Cosmetics** — §1.1 explains why I am not claiming it; worth a lawyer's read.

The former upstream shipping-origin replacement bug was fixed on 2026-08-03.
Settings address edits now preserve processing times; no recovery backfill is
possible for values already lost.
