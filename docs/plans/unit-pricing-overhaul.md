# Unit pricing (Directive 98/6/EC)

**Opened:** 2026-08-04
**Register entry:** follow-up flagged in [`product-detail-overhaul.md`](./product-detail-overhaul.md) §1.1 and §10
**Reference standard:** the CRD trader-declaration phase (explicit collection, disclosure pinned by tests, fail-closed legacy rows)

> Untracked by convention, like the other plan docs — kept on disk as a working
> record, not committed.

---

## 1. Why

Directive 98/6/EC requires a **unit price** (price per kg/litre/metre…) beside
the selling price for products offered to consumers, and France — the
establishment state — transposed it with a **positive list** for non-food
products. One of our live categories sits on that list. Today the platform
shows a selling price and a VAT note, and nothing else.

## 2. What the law actually says

Verified against the texts, not recalled:

- **Directive 98/6/EC** ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31998L0006)).
  Art. 3(1): selling price **and** unit price for all products; the unit price
  need not be shown if identical to the selling price. Art. 3(4): any
  advertisement mentioning the selling price must also give the unit price.
  Art. 4(1): unambiguous, easily identifiable, clearly legible. Art. 2(b):
  unit price = final price incl. VAT per kg/litre/metre/m²/m³ (or a customary
  single unit). Art. 5(1): Member States may waive where not useful;
  **Art. 5(2): for non-food products, Member States may instead list the
  products to which the obligation remains applicable** — France did.
  Art. 3(3) (bulk sales: unit price only) has no instance on this platform;
  nothing is sold unprefixed and measured in the buyer's presence.
- **France.** Code de la consommation **L112-1** sets the general obligation
  and delegates the modalities to ministerial orders; the current R112-1+ are
  the DGCCRF formal-position procedure since the 2016 recodification, not the
  substance. The substance for unit pricing is the **arrêté du 16 novembre
  1999** (NOR ECOC9900157A, JORF 24 Nov 1999,
  [Légifrance JORFTEXT000000212306](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000212306)):
  Art. 1 — listed prepackaged products exposed for retail must carry the
  selling price per kg/hg/litre/dl/metre/m²/m³, the net quantity, and the
  selling price; one unit per category; Art. 5 — the same conditions apply to
  **any price advertising outside the place of sale**; Art. 6 — no unit price
  needed when the net quantity is exactly 1 kg / 1 hg / 1 L / 1 dl / 1 m / 1 m²
  / 1 m³; Art. 3 — products exempted from net-quantity indication are exempt.
  The general arrêté of 3 December 1987 adds the always-TTC, legible rule.
  The French text contains **no small-retailer exemption** (the Directive's
  Art. 6 was a transitional option France did not keep in this arrêté).
- **The Annex II non-food list** (the part that bites us), in full: toilet
  soaps; dentifrices and dental lotions; **bath and shower products**; hair
  care; shaving products; eaux de toilette (not perfume extracts), eau de
  Cologne, body lotions, emulsions; sun products; soaps; laundry/dishwashing
  products and detergents; rinsing and regenerating products; fabric
  softeners; scouring/descaling/unblocking/stain products; floor, glass and
  material care products; paints and varnishes (**excluding fine art
  colours**); car care products; amateur plant protection and fertilisers;
  DIY products (plaster, cement, glue…).

## 3. Mapping to Eurtisan

| Category (seed) | In scope? | Why |
|---|---|---|
| **Soap & Bath** (Bar Soap, Bath Bombs, Skincare) | **Yes** | "Savons de toilette", "savons", "produits pour le bain et la douche" are on Annex II |
| Candles | No | Not on any Annex list; the earlier guess that candles bite was wrong |
| Textiles, Ceramics, Woodwork, Jewellery, Fine Art, Paper Goods, Furniture, Musical Instruments | No | Not listed; fine art colours are explicitly excluded |
| Food & Drink | n/a | Removed from the platform (Reg 1169/2011 Art. 14 decision) |

Basis of sale inside Soap & Bath: bars and bath bombs are sold **by weight**;
skincare oils/lotions **by volume**. Both bases must exist.

**Data model today:** `product.weightGrams` (nullable, positive, used only for
shipping estimates) — weight basis is already capturable. **Volume is not
captured at all**, and nothing records *what the product is sold by*.
`weightGrams` never reaches any public projection.

**Price surfaces that advertise a selling price** (Art. 3(4)/Art. 5 of the
arrêté): `ProductCard`, `SearchResultCard`, `ProductDetail`, `CartPage` line
items, `CheckoutOrderItems`. Post-purchase documents (order detail, success
page, invoices) are not price advertising and stay as they are.

## 4. What to build

1. **Schema** — migration adding to `product`: `volume_ml` (nullable positive
   integer, check constraint mirroring `weight_grams`) and `sold_by`
   (nullable pgEnum `unit_price_basis`: `weight`, `volume`). Snapshot both
   onto `order_item` like the existing dimension columns, so receipts of
   listed prices stay truthful.
2. **Domain module** — `src/lib/products/unit-pricing.ts`: the scoped-category
   map (Soap & Bath → weight|volume), the Zod schema for the two fields
   (required iff the category is scoped), and the pure derivation
   `unitPriceCents(priceCents, basis, weightGrams, volumeMl)` — price is
   already TTC, divide by quantity in kg or L, round half-up to the cent,
   per-kg for weight and per-litre for volume (one unit per category, as the
   arrêté requires). Art. 6-style skip: if the net quantity is exactly 1 kg or
   1 L, the unit price equals the selling price and need not be shown — the
   module returns `null` and the UI shows nothing.
3. **Write paths** — creator product create/update and onboarding listing
   steps collect `soldBy` + the matching quantity for scoped categories,
   validated at the server boundary; unscoped categories keep both null and
   the inputs hidden.
4. **Read paths** — add the three fields to the public product projection and
   the search projection; render `€X,XX / kg` (or `/ L`) beside the selling
   price on the five surfaces in §3, in the same muted slot as the VAT note,
   localized (en/nl), announced with the price (it sits in the same labelled
   block, no new live region).
5. **Legacy rows** — scoped products published before this phase have no
   quantity. Follow the CRD pattern: never infer, never display a computed

   unit price from missing data; seller-facing completeness flag on the
   studio product list ("unit price missing") and the write gate closes every
   row on its next edit. **Open for the owner:** whether legacy scoped rows
   should additionally lose their search/card placement until declared — the
   stricter reading; I would start with the flag and revisit after a quarter.
6. **Tests** — unit tests for the derivation (rounding, kg/L, the 1 kg/1 L
   skip, VAT-inclusive input); a disclosure-accuracy test in the manner of
   `ranking-disclosure-accuracy.test.ts` pinning the rendered unit price to
   the stored quantity and price; component tests for card/detail/checkout
   including the absent-quantity and unscoped branches; en/nl parity;
   `make test-accessibility` files for the touched surfaces.

## 5. What this plan deliberately does not do

- **Cosmetics labelling** (Reg 1223/2009) remains the separate lawyer item;
  unit pricing does not depend on it.
- No bulk-sale support (Art. 3(3)) — the platform has no bulk sales.
- No per-piece unit prices (the Commission declaration on Art. 2(b) permits
  them; nothing on the Annex list needs one).
- No member-state matrix: the platform is established in France and the
  French list is what its traders must meet; buyers elsewhere see a
  superset of information, which harms no one.

## 6. Gates

Focused unit + component + disclosure tests, en/nl parity, lint/format/tsc,
the accessibility files for the touched surfaces. E2E not run — same call as
every prior phase.

## 7. What was built (2026-08-04)

- **Schema** — migration `0085`: `product.volume_ml`, `product.sold_by`
  (pgEnum `unit_price_basis`: weight|volume), the positive check constraint,
  and the same two columns on `order_item` for the receipt snapshot.
- **Domain** — `lib/products/unit-pricing.ts`: the scoped-root map
  (`soap-bath`), chain scoping, the TTC per-kg/per-litre derivation with the
  Art. 6 waiver at exactly 1000 g/ml, and the completeness predicate.
- **Write paths** — creator create/update and the onboarding listing step
  reject scoped products without a complete declaration
  (`UNIT_PRICE_REQUIRED`) and strip declarations on unscoped products; the
  studio list and detail carry `unitPriceScoped`/`unitPriceMissing`, surfaced
  as a badge on the product table and a warning in the edit form.
- **Read paths** — the public projection, the product-page query, the search
  hydration, the Meilisearch document, the search overlay, and the cart and
  checkout projections all carry the three fields; `UnitPriceNote` renders the
  note on product detail, product card, search result card, cart line, and
  checkout line.
- **Tests** — `unit-pricing.test.ts` (derivation, waiver, scoping),
  `unit-pricing-accuracy.test.ts` (projection carries the declaration, legacy
  renders nothing, unscoped never carries a basis, write gate), and
  `UnitPriceNote.test.tsx`. Live smoke on a seeded scoped product showed
  `€50.00 / kg` on the product page and the cart line.

Gates: focused suites green (280 unit + 270 browser on touched files), tsc,
lint, format clean; en/nl parity holds. E2E not run — same call as every
prior phase, per the standing holiday-laptop note.