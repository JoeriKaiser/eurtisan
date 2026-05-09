# Eurtisan v1.0 Feature Roadmap

> European-centered marketplace for creatives, artisans, and makers.
> Each section below is a self-contained feature specification designed to be fed individually to a PRD-generating agent.

---

## Table of Contents

1. [Category Management](#feature-1-category-management)
2. [Product Catalog (Public)](#feature-2-product-catalog-public)
3. [Product Management (Creator API)](#feature-3-product-management-creator-api)
4. [Shop Storefront](#feature-4-shop-storefront)
5. [Marketplace Homepage](#feature-5-marketplace-homepage)
6. [Search & Discovery](#feature-6-search--discovery)
7. [Shopping Cart](#feature-7-shopping-cart)
8. [Checkout Flow](#feature-8-checkout-flow)
9. [Inventory Locking & Stock Management](#feature-9-inventory-locking--stock-management)
10. [Platform Order System](#feature-10-platform-order-system)
11. [Buyer Order Management](#feature-11-buyer-order-management)
12. [Creator Order Fulfillment](#feature-12-creator-order-fulfillment)
13. [Review System](#feature-13-review-system)
14. [Notification System](#feature-14-notification-system)
15. [Dispute Resolution](#feature-15-dispute-resolution)
16. [Creator Dashboard](#feature-16-creator-dashboard)
17. [Creator Shop Settings](#feature-17-creator-shop-settings)
18. [Creator Product Backoffice](#feature-18-creator-product-backoffice)
19. [Creator Payout View](#feature-19-creator-payout-view)
20. [Admin Dashboard](#feature-20-admin-dashboard)
21. [Admin User Management](#feature-21-admin-user-management)
22. [Admin Shop Moderation](#feature-22-admin-shop-moderation)
23. [Admin Dispute Resolution](#feature-23-admin-dispute-resolution)
24. [Admin Payout Oversight](#feature-24-admin-payout-oversight)
25. [Admin Order Inspector](#feature-25-admin-order-inspector)
26. [SEO — Meta Tag System](#feature-26-seo--meta-tag-system)
27. [SEO — XML Sitemap](#feature-27-seo--xml-sitemap)
28. [SEO — Structured Data (JSON-LD)](#feature-28-seo--structured-data-json-ld)
29. [SEO — Robots.txt](#feature-29-seo--robotstxt)
30. [Performance Optimization](#feature-30-performance-optimization)
31. [Accessibility Compliance](#feature-31-accessibility-compliance)
32. [Mollie Payment Integration](#feature-32-mollie-payment-integration)
33. [Mondial Relay Shipping Integration](#feature-33-mondial-relay-shipping-integration)
34. [Email Notification Delivery](#feature-34-email-notification-delivery)
35. [Security Hardening](#feature-35-security-hardening)
36. [Monitoring & Observability](#feature-36-monitoring--observability)
37. [Domain & SSL Setup](#feature-37-domain--ssl-setup)

---

<!-- ## Feature 1: Category Management

### Context
Categories organize products into a browsable hierarchy so buyers can discover items by type rather than only by shop or search. A category like "Art" might contain subcategories "Paintings", "Sculptures", and "Prints". This is a foundational catalog feature that other features (product listing, search filters) depend on.

### Functional Requirements
- Categories have a name, a URL-safe slug, and an optional parent category.
- Categories form a tree (one-level depth is acceptable for v1.0 if full recursion adds complexity).
- Only admins can create, edit, or delete categories.
- Products are assigned to exactly one category.
- Deleting a category with products is blocked; products must be reassigned first.

### Database Schema
```sql
category
  id          uuid primary key
category
  name        text not null
category
  slug        text not null unique
category
  parent_id   uuid nullable references category(id)
category
  created_at  timestamp default now()
```
- Index on `slug` for lookups.
- Index on `parent_id` for tree queries.

### API / Server Functions
- `listCategories()` — Public. Returns flat list or tree. Used in navigation and filters.
- `getCategoryBySlug(slug: string)` — Public. Returns category with product count.
- `createCategory(input: CategoryInput)` — Admin only. Validates slug uniqueness, prevents circular parent references.
- `updateCategory(id: string, input: Partial<CategoryInput>)` — Admin only.
- `deleteCategory(id: string)` — Admin only. Blocked if products reference it.

### UI / Routes
- Category links in the homepage navigation menu and search sidebar.
- No dedicated admin UI for category CRUD in v1.0; admin functions exposed via server functions for now (or a minimal `/admin/categories` page if time permits).

### Edge Cases & Error Handling
- Circular parent reference: reject with 400.
- Duplicate slug: reject with 409.
- Category with products: reject deletion with 409 and message.

### Security Considerations
- Write operations require `admin` role.
- Slug is user-controlled input; sanitize and validate with Zod.

### Acceptance Criteria
- [ ] Public pages display category hierarchy.
- [ ] Products can be filtered by category.
- [ ] Admin can create, edit, and delete categories.
- [ ] Deleting a category with products returns a clear error.

### Dependencies
- None.

### Deferred / Out of Scope
- Multi-select categories per product.
- Category-specific SEO descriptions.
- Drag-and-drop category reordering UI. -->

---

## Feature 2: Product Catalog (Public)

### Context
The public product catalog is how buyers browse and discover items. It includes product listing pages, individual product detail pages, and the data layer that powers them. Every product belongs to exactly one shop and one category.

### Functional Requirements
- Products display with name, price (in EUR), primary image, stock status, and shop name.
- Product detail pages show full description, image gallery, price, stock count, shop link, and an add-to-cart form.
- Inactive products return 404.
- Out-of-stock products display clearly and disable add-to-cart.
- Product URLs use slugs scoped to the shop: `/products/$shopSlug/$productSlug` or flat `/products/$productSlug` with uniqueness enforced.

### Database Schema
```sql
product
  id            uuid primary key
product
  shop_id       uuid not null references shop(id)
product
  category_id   uuid references category(id)
product
  name          text not null
product
  slug          text not null
product
  description   text
product
  price_cents   integer not null  -- EUR, integer only
product
  stock_count   integer not null default 0
product
  is_active     boolean not null default true
product
  created_at    timestamp default now()
product
  updated_at    timestamp default now()

product_image
  id            uuid primary key
product_image
  product_id    uuid not null references product(id)
product_image
  url           text not null
product_image
  alt_text      text
product_image
  sort_order    integer not null default 0
```
- Unique index on `(shop_id, slug)`.
- Index on `category_id`, `is_active`, `created_at`.
- Index on `product_image(product_id, sort_order)`.

### API / Server Functions
- `listProducts(filters: ProductFilters, pagination: Pagination, sort: Sort)` — Public. Supports filtering by shop, category, active status, and price range. Sort by newest, price ascending/descending.
- `getProductBySlug(slug: string)` — Public. Returns product with images (ordered by `sort_order`), shop info, and category info. Returns 404 if inactive.
- `getProductsByShop(shopSlug: string, pagination)` — Public. Used on shop storefront.

### UI / Routes
- `/products/$productSlug` — Product detail page. SSR for SEO.
- Product card component used in grids on homepage, shop pages, and search results.

### State Management & Data Flow
- Product data loaded server-side via TanStack Start `loader` for initial render.
- Client-side caching via TanStack Query with stable keys: `['product', slug]`, `['products', filters]`.

### Edge Cases & Error Handling
- Product slug not found: 404 page.
- Shop suspended: all its products 404.
- No images: display a placeholder.
- Price displayed as EUR with `,` separator (e.g., €12,50).

### Security Considerations
- Product slugs are public; no auth needed.
- Never expose internal IDs where slugs suffice.

### Acceptance Criteria
- [ ] Product detail page loads with all fields and images.
- [ ] Inactive products are inaccessible.
- [ ] Out-of-stock products show clear messaging.
- [ ] Product grids support pagination.
- [ ] Prices always display in EUR format.

### Dependencies
- Feature 1: Category Management (for category filtering).

### Deferred / Out of Scope
- Product variants (size, color).
- Product videos.
- Related products recommendations.

---

## Feature 3: Product Management (Creator API)

### Context
Creators need full control over their inventory through server-side operations. This feature defines the API surface for creating, updating, and deleting products, including image handling. The UI for these operations is defined in Feature 18.

### Functional Requirements
- Creators can create products with name, slug, description, price (EUR), stock count, category, and images.
- Product slugs must be unique within the creator's shop.
- Creators can update any field on their own products.
- Creators can soft-delete (deactivate) or hard-delete products. Soft delete preferred to preserve order history.
- Image uploads are handled as part of product creation/update.
- Price is validated as a positive integer in cents.

### API / Server Functions
- `createProduct(input: CreateProductInput)` — Creator only. Zod validates: name (1-100 chars), slug (URL-safe, unique per shop), price_cents (>0), stock_count (>=0), category_id (optional, valid UUID). Inserts product then images.
- `updateProduct(productId: string, input: UpdateProductInput)` — Creator only. Partial update. Ownership verified via `shop.owner_id`. Slug uniqueness checked if changed.
- `deleteProduct(productId: string, hard: boolean)` — Creator only. Soft delete sets `is_active = false`. Hard delete removes row and orphaned images.
- `listCreatorProducts(shopId: string, pagination, filters)` — Creator only. Paginated list of products for a shop with image counts.

### Auth & Authorization
- All functions use `authPipeline` with `requireRole('creator')` and `requireShopOwnership`.
- Admins bypass ownership but still require `admin` role.

### Edge Cases & Error Handling
- Duplicate slug within shop: 409 Conflict.
- Category not found: 400 Bad Request.
- Price with decimal or negative: Zod rejection.
- Updating another creator's product: 403 Forbidden.
- Image upload failure: 500, product not created (transaction rollback).

### Security Considerations
- Validate all inputs with Zod on the server.
- Check file type and size on image upload (max 5MB, jpg/png/webp).
- Sanitize description text (escape HTML or use markdown parser safely).

### Acceptance Criteria
- [ ] Creator can create a product with images.
- [ ] Duplicate slug within shop is rejected.
- [ ] Only shop owners can modify their products.
- [ ] Soft-deleted products are hidden from public catalog.
- [ ] Image sort order is preserved.

### Dependencies
- Feature 1: Category Management.
- Feature 2: Product Catalog (public read paths must exist).

### Deferred / Out of Scope
- Bulk product import/export.
- Product drafts (publish later).
- Inventory history/audit log.

---

## Feature 4: Shop Storefront

### Context
Every creator has a public-facing shop page that acts as their brand home on the marketplace. Buyers can browse all products from a single creator, learn about the shop, and navigate to individual products.

### Functional Requirements
- Each shop has a public page at `/shops/$shopSlug`.
- The page displays the shop name, description, and a grid of active products.
- Products are paginated (12–24 per page).
- Buyers can search within the shop (filters product names).
- Suspended shops return 404.
- Empty shops show a friendly "No products yet" message.

### Database Schema
Uses existing `shop` table plus `product` and `product_image` from Feature 2.

### API / Server Functions
- `getShopBySlug(slug: string)` — Public. Returns shop details. 404 if suspended or not found.
- `getShopProducts(shopSlug: string, search?: string, pagination)` — Public. Returns active products for the shop, optionally filtered by search query.

### UI / Routes
- `/shops/$shopSlug` — Shop header (name, description), product grid, pagination.
- Shop card component used in marketplace homepage and shop directory.

### State Management & Data Flow
- SSR for shop info and first page of products.
- Client-side pagination or infinite scroll for additional products.

### Edge Cases & Error Handling
- Shop slug not found: 404.
- Shop suspended: 404 (do not reveal existence).
- Creator has no products: render empty state with CTA to browse marketplace.

### Security Considerations
- Shop slugs are public.
- Do not expose owner email or internal user ID.

### Acceptance Criteria
- [ ] Shop page renders with correct info and product grid.
- [ ] Suspended shops are inaccessible.
- [ ] Empty shops show appropriate messaging.
- [ ] Pagination works correctly.

### Dependencies
- Feature 2: Product Catalog (public).

### Deferred / Out of Scope
- Shop themes or customization.
- Shop reviews/ ratings.
- Shop banner image upload (handled in Feature 17).

---

## Feature 5: Marketplace Homepage

### Context
The homepage is the front door of the marketplace. It must immediately communicate what Eurtisan is and help buyers start browsing. The current landing page showcases framework features; this replaces it with marketplace content.

### Functional Requirements
- Displays featured/active shops (up to 6).
- Displays category navigation (links to category browsing).
- Displays recent or highlighted products (up to 12).
- Includes a prominent search bar linking to the search page.
- All content is server-rendered for SEO and fast first paint.

### API / Server Functions
- `getFeaturedShops(limit: number)` — Public. Returns active shops with product counts.
- `getRecentProducts(limit: number)` — Public. Returns newest active products with primary image.
- `listCategories()` — From Feature 1.

### UI / Routes
- `/` — Hero section with marketplace branding, search bar, category grid, shop grid, product grid.

### Edge Cases & Error Handling
- No shops yet: hide shop section, show "Be the first creator" CTA.
- No products yet: show browse categories instead.
- No categories: minimal display.

### Acceptance Criteria
- [ ] Homepage loads with marketplace branding.
- [ ] Shops, categories, and products display when available.
- [ ] Search bar navigates to `/search?q=...`.
- [ ] Page is fully server-rendered.

### Dependencies
- Feature 1: Category Management.
- Feature 2: Product Catalog.
- Feature 4: Shop Storefront.

### Deferred / Out of Scope
- Personalized recommendations.
- Hero carousel or animations.
- Newsletter signup.

---

## Feature 6: Search & Discovery

### Context
Buyers need to find specific products across all shops. Search must handle partial matches, support filtering, and return results quickly.

### Functional Requirements
- Full-text search across product names and descriptions.
- Filters: category, price range (min/max EUR), shop.
- Sort options: relevance, price (low/high), newest.
- Pagination (24 per page).
- Results show product card with image, name, price, shop name.

### API / Server Functions
- `searchProducts(query: string, filters: SearchFilters, sort: Sort, pagination)` — Public.
  - If PostgreSQL `to_tsvector` is available, use it. Otherwise use `ILIKE` on name and description as fallback.
  - Filter by category_id, shop_id, price_cents range.
  - Sort by relevance (ts_rank or simple text match position), price_cents, created_at.

### UI / Routes
- `/search?q=...&category=...&minPrice=...` — Search bar (sticky header or page top), filter sidebar, results grid, pagination.
- Search input in the site header navigates here.

### State Management & Data Flow
- URL query params drive server-side search state.
- SSR for initial results; client-side updates filter state in URL.

### Edge Cases & Error Handling
- Empty query: show all products or prompt for input.
- No results: friendly empty state with suggestions.
- Special characters in query: sanitized, not executed.
- Very long query (>100 chars): truncated or rejected.

### Security Considerations
- Search query is untrusted input; never concatenate into SQL. Use parameterized queries via Drizzle.
- Prevent SQL injection through strict Zod validation of filter parameters.

### Acceptance Criteria
- [ ] Search returns relevant products by name/description.
- [ ] Filters combine correctly (category + price range).
- [ ] Sorting changes result order.
- [ ] Pagination works with filters applied.
- [ ] Empty results show helpful messaging.

### Dependencies
- Feature 1: Category Management.
- Feature 2: Product Catalog.

### Deferred / Out of Scope
- Autocomplete/suggestions.
- Search analytics.
- Fuzzy spelling correction.

---

## Feature 7: Shopping Cart

### Context
The cart is where buyers collect items from multiple shops before checkout. Because Eurtisan supports multi-shop orders, the cart must group items by shop and handle both anonymous (session-based) and authenticated users.

### Functional Requirements
- Buyers add products to cart from product detail pages.
- Cart shows items grouped by shop with per-shop subtotals.
- Quantity can be updated or items removed.
- Adding an existing product increments quantity (up to stock limit).
- Anonymous carts use a session ID stored in a cookie.
- On login, anonymous carts merge into the user's cart. Duplicate products sum quantities (capped at stock).
- Carts expire: 7 days for anonymous, 30 days for authenticated.
- Out-of-stock items show warning and disable checkout.

### Database Schema
```sql
cart
  id          uuid primary key
cart
  user_id     uuid nullable unique references user(id)
cart
  session_id  text nullable unique
cart
  expires_at  timestamp not null
cart
  updated_at  timestamp default now()

cart_item
  id          uuid primary key
cart_item
  cart_id     uuid not null references cart(id) on delete cascade
cart_item
  product_id  uuid not null references product(id)
cart_item
  quantity    integer not null default 1
cart_item
  created_at  timestamp default now()
```
- Unique index on `(cart_id, product_id)`.
- Index on `cart(user_id)`, `cart(session_id)`, `cart(expires_at)`.
- Index on `cart_item(cart_id)`.

### API / Server Functions
- `getCart()` — Authenticated or anonymous. Looks up by `user_id` or `session_id` cookie. Returns cart with items grouped by shop, including product name, price, image, stock status.
- `addToCart(productId: string, quantity: number)` — Validates stock. Upserts cart_item. Creates cart if missing.
- `updateCartItem(itemId: string, quantity: number)` — Validates stock. Removes item if quantity <= 0.
- `removeCartItem(itemId: string)` — Deletes item.
- `mergeAnonymousCart(sessionId: string)` — Called on login. Merges session cart into user cart, summing quantities (respecting stock). Deletes old session cart.
- `clearExpiredCarts()` — Cleanup utility. Deletes carts past `expires_at`.

### UI / Routes
- `/cart` — Multi-shop layout. Per-shop sections with items, quantity steppers, remove buttons, subtotal. Checkout CTA disabled if any item out of stock or cart empty.
- "Add to cart" button on `/products/$productSlug`.
- Cart item count badge in header.

### State Management & Data Flow
- Cart data fetched server-side for `/cart`.
- Add-to-cart mutations invalidate cart query.
- Session ID cookie: `eurtisan_session`, httpOnly, secure, SameSite=lax.

### Edge Cases & Error Handling
- Product deleted while in cart: item shows as "unavailable", can be removed.
- Stock drops below cart quantity: show warning, cap quantity at stock, disable checkout.
- Concurrent add-to-cart from two tabs: last write wins (acceptable for v1.0).
- Merge conflict: anonymous cart has product A qty 2, user cart has product A qty 3, stock is 4 → merged qty is 4 (capped).

### Security Considerations
- Session ID is a cryptographically random string (32+ bytes), not guessable.
- Cart operations never trust client-calculated totals; always recalculate from database.
- Users cannot view or modify other users' carts.

### Acceptance Criteria
- [ ] Anonymous users can add items and return later (within 7 days).
- [ ] Authenticated users retain cart across sessions (30 days).
- [ ] Login merges anonymous cart correctly.
- [ ] Cart groups items by shop with subtotals.
- [ ] Out-of-stock items warn and block checkout.
- [ ] Product deletion handles gracefully.

### Dependencies
- Feature 2: Product Catalog.

### Deferred / Out of Scope
- Save for later / wishlist.
- Cart abandonment emails.
- Promo codes.

---

## Feature 8: Checkout Flow

### Context
Checkout converts the cart into an order. Because Eurtisan is multi-shop, a single checkout creates one platform-level order and multiple shop-level child orders. Payment is mocked in v1.0; the real Mollie integration is Feature 32.

### Functional Requirements
- Checkout collects one shipping address for the buyer.
- Each shop in the cart requires a shipping method selection.
- Order summary displays per-shop subtotals, shipping costs, and grand total.
- On confirmation, inventory is validated and locked (see Feature 9), the order tree is created, and the buyer is redirected to a mock payment success page.
- If validation fails (stock changed), buyer sees specific errors and can retry.

### API / Server Functions
- `createCheckout(input: CheckoutInput)` — Authenticated only.
  - Validates cart ownership and stock for every item.
  - Locks inventory via Feature 9.
  - Creates `platform_order` + `shop_order` children + `order_item` rows.
  - Calculates totals (sum of item prices + shipping per shop).
  - Returns `platformOrderId`.
- `getCheckoutSummary(cartId: string)` — Returns pre-checkout summary: items by shop, shipping options per shop, totals.

### UI / Routes
- `/checkout` — Multi-step or single-page form:
  1. Shipping address (name, street, city, postal code, country).
  2. Per-shop shipping method selection (mock options: Standard, Express).
  3. Order summary with total.
  4. Confirm button → calls `createCheckout` → redirects to `/orders/$platformOrderId/success`.

### State Management & Data Flow
- Checkout form state managed with TanStack Form.
- Shipping address stored in `platform_order.shipping_address` as JSONB.
- Server function validates all inputs; never trust client totals.

### Edge Cases & Error Handling
- Stock exhausted during checkout: 409 with specific product IDs. Client shows retry prompt.
- Empty cart: redirect to `/cart`.
- Invalid shipping address: Zod validation error per field.
- Session expires during checkout: redirect to login, preserve cart.

### Security Considerations
- Checkout requires authentication.
- Address data is PII; handle under GDPR principles (encrypt at rest if feasible, minimize retention).
- Prevent checkout price tampering by always recalculating server-side.

### Acceptance Criteria
- [ ] Authenticated buyer can complete checkout from cart.
- [ ] Order tree created correctly with per-shop children.
- [ ] Stock exhaustion during checkout shows specific error.
- [ ] Empty cart blocks checkout.
- [ ] Address validation prevents incomplete submissions.

### Dependencies
- Feature 7: Shopping Cart.
- Feature 9: Inventory Locking & Stock Management.
- Feature 10: Platform Order System.

### Deferred / Out of Scope
- Multiple shipping addresses.
- Gift wrapping options.
- VAT calculation at checkout.

---

## Feature 9: Inventory Locking & Stock Management

### Context
To prevent overselling in a concurrent marketplace, stock must be reserved when a buyer starts checkout and released if they abandon it. This is an internal infrastructure feature, not a user-facing UI.

### Functional Requirements
- When `createCheckout` is called, the system deducts stock for each cart item.
- Stock is held for 15 minutes. If the order is not completed (payment confirmed) within this window, stock is automatically restored.
- If a buyer cancels checkout explicitly, stock is restored immediately.
- Cart quantity updates and add-to-cart operations validate against available stock (accounting for locked inventory).

### Database Schema
Uses `product.stock_count` from Feature 2. No additional tables required for v1.0; inventory state is managed by decrementing `stock_count` on checkout creation and incrementing on cancellation/timeout.

Alternative (if restoration tracking is needed):
```sql
inventory_lock
  id            uuid primary key
inventory_lock
  product_id    uuid not null references product(id)
inventory_lock
  quantity      integer not null
inventory_lock
  platform_order_id uuid references platform_order(id)
inventory_lock
  expires_at    timestamp not null
inventory_lock
  created_at    timestamp default now()
```
- Index on `inventory_lock(product_id)`, `inventory_lock(expires_at)`.

### API / Server Functions
- `lockInventory(productId: string, quantity: number, orderId: string)` — Internal. Atomically checks and deducts stock. Uses `SELECT FOR UPDATE` or equivalent.
- `releaseInventory(orderId: string)` — Internal. Restores all stock held for an order.
- `releaseExpiredLocks()` — Cleanup job/poller. Finds locks past `expires_at` and restores stock.

### Edge Cases & Error Handling
- Race condition: two buyers check out last item simultaneously. Database transaction ensures one succeeds, one gets 409.
- Partial stock: buyer wants 5, only 3 available. Rejected with available quantity.
- Product deleted after lock: release becomes no-op.

### Security Considerations
- Inventory functions are internal only; never exposed directly to clients.
- All stock changes happen inside database transactions.

### Acceptance Criteria
- [ ] Checkout deducts stock atomically.
- [ ] Abandoned checkouts restore stock within 15 minutes.
- [ ] Explicit cancellation restores stock immediately.
- [ ] No overselling occurs under concurrent load.

### Dependencies
- Feature 2: Product Catalog.

### Deferred / Out of Scope
- Backorder support.
- Inventory audit log.
- Warehouse/bin-level tracking.

---

## Feature 10: Platform Order System

### Context
The split-order architecture is the backbone of multi-shop checkout. A single buyer action creates a `PlatformOrder` (the umbrella) and one `ShopOrder` per shop (the fulfillable units). Each `ShopOrder` has its own status, shipping, and tracking.

### Functional Requirements
- `PlatformOrder` holds the buyer, total, payment reference, shipping address, and overall status.
- `ShopOrder` holds the shop, subtotal, shipping cost, method, tracking info, and independent status.
- `OrderItem` preserves the product name and unit price at purchase time (price snapshot), preventing changes if the product is later edited.
- Status machine for `ShopOrder`: `pending_payment` → `paid` → `processing` → `shipped` → `delivered` → `completed` | `disputed` | `refunded`.
- `PlatformOrder` status derives from children (e.g., `completed` when all shop orders completed).

### Database Schema
```sql
platform_order
  id                uuid primary key
platform_order
  buyer_user_id     uuid not null references user(id)
platform_order
  status            text not null default 'pending_payment'
platform_order
  total_cents       integer not null
platform_order
  mollie_payment_id text nullable
platform_order
  billing_address   jsonb not null
platform_order
  shipping_address  jsonb not null
platform_order
  created_at        timestamp default now()
platform_order
  updated_at        timestamp default now()

shop_order
  id                uuid primary key
shop_order
  platform_order_id uuid not null references platform_order(id)
shop_order
  shop_id           uuid not null references shop(id)
shop_order
  status            text not null default 'pending_payment'
shop_order
  subtotal_cents    integer not null
shop_order
  shipping_cents    integer not null default 0
shop_order
  shipping_method   text nullable
shop_order
  tracking_number   text nullable
shop_order
  tracking_url      text nullable
shop_order
  created_at        timestamp default now()
shop_order
  updated_at        timestamp default now()

order_item
  id                uuid primary key
order_item
  shop_order_id     uuid not null references shop_order(id)
order_item
  product_id        uuid not null references product(id)
order_item
  product_name      text not null
order_item
  unit_price_cents  integer not null
order_item
  quantity          integer not null
```
- Indexes: `platform_order(buyer_user_id)`, `platform_order(status)`, `shop_order(platform_order_id)`, `shop_order(shop_id)`, `shop_order(status)`, `order_item(shop_order_id)`.

### API / Server Functions
- `createPlatformOrder(input)` — Internal, called by checkout. Creates all three levels in a transaction.
- `getPlatformOrder(id: string)` — Buyer or admin. Returns full tree with shop orders and items.
- `getShopOrder(id: string)` — Creator (owner), buyer (if parent is theirs), or admin.
- `updateShopOrderStatus(id: string, status: ShopOrderStatus)` — Creator or admin. Valid transitions enforced.
- `listBuyerOrders(pagination)` — Authenticated buyer. Their platform orders.
- `listShopOrders(shopId: string, filters)` — Creator. Orders for their shop.

### Edge Cases & Error Handling
- Invalid status transition: reject with 400.
- Buyer requests another buyer's order: 403.
- Order not found: 404.

### Security Considerations
- Strict ownership checks on every read.
- Status transitions are server-enforced; never trust client-provided status.

### Acceptance Criteria
- [ ] Checkout creates platform order + shop orders + order items atomically.
- [ ] Price snapshots are preserved in order_item.
- [ ] Status transitions follow the defined machine.
- [ ] Buyers see only their own orders; creators see only their shop's orders.

### Dependencies
- Feature 2: Product Catalog.
- Feature 8: Checkout Flow.

### Deferred / Out of Scope
- Order editing after creation.
- Partial refunds at the platform order level.

---

## Feature 11: Buyer Order Management

### Context
After checkout, buyers need to track their purchases, see shipping updates, and access review prompts. This feature covers the post-purchase buyer experience.

### Functional Requirements
- Buyers see a list of all their platform orders at `/orders`.
- Each order shows: order ID, date, total, and per-shop status summary.
- Order detail page shows full breakdown: items, prices, shipping info, tracking links, and current status per shop.
- Review CTAs appear on delivered items but are disabled until 14 days after delivery.

### API / Server Functions
- `listBuyerOrders(pagination)` — Authenticated. Returns platform orders with summary.
- `getBuyerOrderDetail(platformOrderId: string)` — Authenticated. Full tree. Verifies `buyer_user_id` matches.

### UI / Routes
- `/orders` — Order list, sorted by date descending.
- `/orders/$platformOrderId` — Order detail with expandable shop order sections.

### Edge Cases & Error Handling
- Order with multiple shops: show per-shop progress bars or status badges.
- Cancelled orders: show cancellation reason/timestamp.
- Tracking URL invalid: display as plain text instead of link.

### Acceptance Criteria
- [ ] Buyer sees all their orders.
- [ ] Order detail shows correct items, prices, and statuses.
- [ ] Tracking links are clickable when valid.
- [ ] Review CTA appears only on eligible delivered items.

### Dependencies
- Feature 10: Platform Order System.
- Feature 13: Review System (for review CTAs).

### Deferred / Out of Scope
- Order cancellation by buyer.
- Reorder functionality.

---

## Feature 12: Creator Order Fulfillment

### Context
Creators receive orders for their shop and must process them: view details, mark as shipped, and provide tracking information. This is the operational heart of the seller experience.

### Functional Requirements
- Creators see a list of incoming `ShopOrder` items for their shop.
- List is filterable by status and sortable by date.
- Order detail shows: buyer name (not email), shipping address, items, and status.
- Creator can mark an order as "shipped" and enter a tracking number and tracking URL.
- Status transitions: `paid` → `processing` (optional) → `shipped` → `delivered`. For v1.0, `delivered` may be set manually or assumed after a delay.

### API / Server Functions
- `listShopOrders(shopId: string, statusFilter?, pagination)` — Creator only. Returns shop orders.
- `getShopOrderDetail(shopOrderId: string)` — Creator or admin.
- `markShopOrderShipped(shopOrderId: string, trackingNumber?: string, trackingUrl?: string)` — Creator only. Validates status is `paid` or `processing`.
- `markShopOrderDelivered(shopOrderId: string)` — Creator or system. Transitions from `shipped`.

### Auth & Authorization
- `authPipeline` with `requireRole('creator')` and `requireShopOwnership`.
- Admin bypass.

### UI / Routes
- `/creator/orders` — Table/list of shop orders with status badges, filter dropdown, search.
- `/creator/orders/$shopOrderId` — Detail view with buyer info, address, items, status timeline, ship button with tracking form.

### Edge Cases & Error Handling
- Invalid status transition: 400.
- Tracking URL not a valid URL: Zod rejects.
- Order already shipped: idempotent or reject.
- Buyer address in unsupported country: still display, flag for creator.

### Security Considerations
- Mask buyer email; show only name.
- Do not expose buyer's other orders.

### Acceptance Criteria
- [ ] Creator sees only their shop's orders.
- [ ] Can mark orders shipped with tracking info.
- [ ] Invalid status transitions are rejected.
- [ ] Buyer receives notification on ship (Feature 14).

### Dependencies
- Feature 10: Platform Order System.
- Feature 14: Notification System.

### Deferred / Out of Scope
- Bulk ship action.
- Shipping label generation (Feature 33).
- Automated delivery confirmation.

---

## Feature 13: Review System

### Context
Reviews build trust between buyers and creators. They are tied to actual purchases to prevent fake reviews. A buyer can only review products from orders they have received.

### Functional Requirements
- Buyers can submit one review per product per `ShopOrder`.
- Reviews consist of a 1–5 star rating and an optional text comment.
- Review eligibility: the `ShopOrder` status must be `delivered`, and at least 14 days must have passed since delivery.
- Reviews are public and displayed on the product detail page.
- Product detail shows average rating and review count.

### Database Schema
```sql
review
  id              uuid primary key
review
  shop_order_id   uuid not null references shop_order(id)
review
  product_id      uuid not null references product(id)
review
  buyer_user_id   uuid not null references user(id)
review
  rating          integer not null check (rating between 1 and 5)
review
  comment         text
review
  created_at      timestamp default now()
```
- Unique constraint on `(shop_order_id, product_id)`.
- Index on `review(product_id)`, `review(shop_order_id)`.

### API / Server Functions
- `createReview(input: CreateReviewInput)` — Authenticated buyer. Validates eligibility (14 days post-delivery, matching buyer).
- `getProductReviews(productId: string, pagination)` — Public. Returns reviews with buyer name and date.
- `getReviewableItems(platformOrderId: string)` — Authenticated buyer. Lists items from the order that are eligible for review.

### UI / Routes
- `/orders/$platformOrderId` — "Write a review" button on eligible items (disabled with tooltip if not yet eligible).
- Review form modal: star rating (clickable), comment textarea, submit.
- `/products/$productSlug` — Reviews section with average rating, distribution bars, and paginated review list.

### Edge Cases & Error Handling
- Review before eligible: 403 with days remaining.
- Duplicate review: 409 (enforced by unique constraint).
- Product deleted after review: review still visible on order page; hidden from product page (or shows "product unavailable").
- Empty comment: allowed; only rating required.

### Security Considerations
- Eligibility is server-enforced; never trust client timestamp.
- Comments sanitized (HTML escaped) to prevent XSS.

### Acceptance Criteria
- [ ] Buyer can review eligible products.
- [ ] 14-day gate is enforced server-side.
- [ ] Only one review per product per order.
- [ ] Average rating displays correctly on product page.
- [ ] Reviews appear immediately after submission.

### Dependencies
- Feature 10: Platform Order System.
- Feature 11: Buyer Order Management.

### Deferred / Out of Scope
- Review editing or deletion.
- Creator response to reviews.
- Photo/video attachments.

---

## Feature 14: Notification System

### Context
Users need to know when something important happens: an order is placed, an item ships, a review arrives, or a dispute opens. v1.0 supports in-app notifications only; email is deferred to Feature 34.

### Functional Requirements
- Notifications are user-scoped and persistent.
- Types: `order_placed`, `order_shipped`, `review_received`, `dispute_opened`, `payout_sent`.
- Each notification includes a `data` JSON blob with IDs for deep-linking (e.g., `{ platformOrderId: "..." }`).
- Users see an unread count badge in the header.
- Notifications can be marked as read individually or all at once.
- Old notifications are not deleted in v1.0.

### Database Schema
```sql
notification
  id          uuid primary key
notification
  user_id     uuid not null references user(id)
notification
  type        text not null
notification
  data        jsonb not null default '{}'
notification
  read_at     timestamp nullable
notification
  created_at  timestamp default now()
```
- Index on `notification(user_id, read_at)` for unread counts.
- Index on `notification(user_id, created_at)` for listing.

### API / Server Functions
- `createNotification(userId: string, type: string, data: object)` — Internal utility. Called by order state transitions, dispute actions, etc.
- `getNotifications(pagination)` — Authenticated. Paginated list.
- `getUnreadNotificationCount()` — Authenticated. Returns count for header badge.
- `markNotificationRead(notificationId: string)` — Authenticated.
- `markAllNotificationsRead()` — Authenticated.

### UI / Routes
- Header: bell icon with red badge showing unread count.
- `/notifications` — Paginated list with type icons, message preview, timestamp, and deep-link. Click marks as read.

### State Management & Data Flow
- Notifications created synchronously during order transitions.
- TanStack Query cache holds unread count; mutations invalidate.

### Edge Cases & Error Handling
- Notification for deleted entity: deep-link leads to 404; show "content no longer available".
- 10,000+ notifications: pagination handles it.
- Unread count stale after logout/login: refetched.

### Security Considerations
- Users can only read/mark their own notifications.
- `data` JSON is not executed; it's only used for URL construction.

### Acceptance Criteria
- [ ] Notification created on order placement for buyer and creators.
- [ ] Notification created on shipment for buyer.
- [ ] Unread badge updates in real-time (or on navigation).
- [ ] Deep-links navigate to correct pages.
- [ ] Mark as read works individually and in bulk.

### Dependencies
- Feature 10: Platform Order System (for triggers).

### Deferred / Out of Scope
- Email delivery.
- Push notifications.
- Notification preferences/settings.
- Notification deletion.

---

## Feature 15: Dispute Resolution

### Context
When a transaction goes wrong, buyers need a formal process to raise concerns. The platform mediates through an admin-driven dispute workflow.

### Functional Requirements
- Buyers can open a dispute on any `ShopOrder` within 30 days of delivery.
- Dispute requires a reason (`item_not_received`, `not_as_described`, `damaged`, `other`) and a description.
- Opening a dispute locks the `ShopOrder` status to `disputed`.
- Both buyer and creator can add messages to a dispute thread.
- Admins view all open disputes in a queue.
- Admins can resolve a dispute by: closing with no action, issuing a partial refund, or issuing a full refund.
- Resolution updates the `ShopOrder` status and logs the decision.

### Database Schema
```sql
dispute
  id              uuid primary key
dispute
  shop_order_id   uuid not null unique references shop_order(id)
dispute
  buyer_user_id   uuid not null references user(id)
dispute
  reason          text not null
dispute
  description     text not null
dispute
  status          text not null default 'open'
dispute
  resolution      text nullable
dispute
  refund_cents    integer nullable
dispute
  created_at      timestamp default now()
dispute
  updated_at      timestamp default now()

dispute_message
  id              uuid primary key
dispute_message
  dispute_id      uuid not null references dispute(id)
dispute_message
  sender_user_id  uuid not null references user(id)
dispute_message
  message         text not null
dispute_message
  created_at      timestamp default now()
```
- Index on `dispute(status)`, `dispute(buyer_user_id)`.
- Index on `dispute_message(dispute_id)`.

### API / Server Functions
- `openDispute(input: OpenDisputeInput)` — Authenticated buyer. Validates 30-day window and `delivered` status.
- `addDisputeMessage(disputeId: string, message: string)` — Buyer (if they opened it), creator (if shop owner), or admin.
- `listOpenDisputes()` — Admin only.
- `getDisputeDetail(disputeId: string)` — Participants or admin.
- `resolveDispute(disputeId: string, resolution: ResolutionInput)` — Admin only. Updates status, records refund amount (mock in v1.0).

### UI / Routes
- Buyer: `/orders/$platformOrderId` — "Open dispute" button on delivered shop orders.
- `/disputes/$disputeId` — Dispute thread for buyer and creator.
- Admin: `/admin/disputes` — Queue table with age, reason, participant names.
- `/admin/disputes/$disputeId` — Detail with message thread, order info, resolution controls (dropdown + refund input).

### Edge Cases & Error Handling
- Dispute opened after 30 days: 403.
- Dispute on non-delivered order: 400.
- Duplicate dispute on same shop order: 409 (enforced by unique constraint).
- Refund amount > order total: 400.

### Security Considerations
- Only dispute participants and admins can view threads.
- Resolution is admin-only.
- Refund logic is protected by role checks.

### Acceptance Criteria
- [ ] Buyer can open a dispute within 30 days of delivery.
- [ ] Dispute locks shop order status.
- [ ] Messages are threaded and visible to relevant parties.
- [ ] Admin can resolve with close/partial/full refund.
- [ ] Notifications sent on dispute open and resolution.

### Dependencies
- Feature 10: Platform Order System.
- Feature 14: Notification System.

### Deferred / Out of Scope
- Automated dispute escalation rules.
- Evidence uploads (photos).
- Appeals process.

---

## Feature 16: Creator Dashboard

### Context
When a creator visits `/creator`, they need an at-a-glance view of their business: how much they've earned, what needs shipping, and what is running low.

### Functional Requirements
- Dashboard shows: revenue this month (sum of paid shop orders), pending orders count, low-stock product count (stock < 5).
- Recent activity list: latest orders, latest reviews.
- Links to deeper sections: products, orders, payouts, shop settings.

### API / Server Functions
- `getCreatorDashboardStats()` — Authenticated creator. Aggregates across all owned shops.
- `getCreatorRecentActivity(limit: number)` — Recent orders and reviews.

### UI / Routes
- `/creator` — Grid of stat cards, recent activity feed, quick-action buttons.

### Edge Cases & Error Handling
- New creator with no shops: prompt to create shop (or redirect to shop creation).
- New creator with no data: show 0s and empty states.
- Multiple shops: stats aggregate across all owned shops.

### Acceptance Criteria
- [ ] Stats reflect real database values.
- [ ] Page loads quickly (< 500ms for stats).
- [ ] Empty states are friendly and actionable.

### Dependencies
- Feature 10: Platform Order System.
- Feature 3: Product Management (for stock counts).

### Deferred / Out of Scope
- Charts/graphs.
- Date range selection.
- Export to CSV.

---

## Feature 17: Creator Shop Settings

### Context
Creators need to brand their shop and manage its public-facing information.

### Functional Requirements
- Edit shop name, slug, and description.
- Upload a shop banner or logo image.
- Slug uniqueness is enforced platform-wide.
- Changes reflect immediately on the public storefront.

### API / Server Functions
- `updateShop(shopId: string, input: UpdateShopInput)` — Creator only. Validates slug uniqueness if changed.
- `uploadShopImage(shopId: string, file: File)` — Creator only. Stores image, returns URL.

### Auth & Authorization
- `requireShopOwnership`.

### UI / Routes
- `/creator/shop` — Form with name, slug, description textarea, image upload with preview.

### Edge Cases & Error Handling
- Slug collision: 409.
- Image too large: reject > 5MB.
- Invalid image type: reject non-image files.

### Acceptance Criteria
- [ ] Creator can update shop info and image.
- [ ] Slug uniqueness enforced.
- [ ] Changes visible on public storefront immediately.

### Dependencies
- Feature 4: Shop Storefront (to see changes).

### Deferred / Out of Scope
- Custom CSS/themes.
- Shop policies (returns, shipping).
- Shop vacation mode.

---

## Feature 18: Creator Product Backoffice

### Context
The UI counterpart to Feature 3. Creators manage their product catalog through a dedicated interface.

### Functional Requirements
- Paginated product list with search, active/inactive filters.
- "New Product" form with all fields and image upload.
- "Edit Product" form pre-populated with current data.
- Image gallery reordering (drag handles or arrow buttons).
- Activate/deactivate toggle.

### UI / Routes
- `/creator/products` — Product table with thumbnail, name, price, stock, status, actions.
- `/creator/products/new` — Creation form.
- `/creator/products/$productId/edit` — Edit form.

### API / Server Functions
Uses Feature 3 functions: `listCreatorProducts`, `createProduct`, `updateProduct`, `deleteProduct`.

### Edge Cases & Error Handling
- Unsaved changes warning when navigating away.
- Image upload progress indication.
- Form validation errors displayed per field.

### Acceptance Criteria
- [ ] Creator can perform full product CRUD via UI.
- [ ] Image upload and reordering works.
- [ ] Validation errors are clear and actionable.

### Dependencies
- Feature 3: Product Management (Creator API).
- Feature 1: Category Management (for category selector).

### Deferred / Out of Scope
- Bulk edit.
- CSV import.
- Rich text editor for description.

---

## Feature 19: Creator Payout View

### Context
Creators want transparency into what they have earned and what is pending. v1.0 shows this as read-only; actual payout triggering is manual or deferred.

### Functional Requirements
- Table of earnings per `ShopOrder`.
- Columns: order ID, date, amount (subtotal minus platform fee), status (`pending`, `processing`, `sent`).
- Summary cards: total earned, pending amount.

### API / Server Functions
- `listCreatorPayouts(shopId: string, pagination)` — Creator only. Derives from `shop_order` where status is `completed` or `delivered`.

### UI / Routes
- `/creator/payouts` — Table with filters, summary cards.

### Edge Cases & Error Handling
- Refunded orders show negative adjustments.
- Currency always in EUR.

### Acceptance Criteria
- [ ] Payouts match shop order subtotals.
- [ ] Statuses are accurate.
- [ ] Read-only in v1.0 (no payout initiation).

### Dependencies
- Feature 10: Platform Order System.

### Deferred / Out of Scope
- Automatic payout scheduling.
- Bank account collection.
- Tax document generation.

---

## Feature 20: Admin Dashboard

### Context
Admins need a high-level view of platform health and activity.

### Functional Requirements
- Overview cards: total registered users, active shops, open disputes, pending payouts.
- Recent signups and recent orders list.
- Navigation to admin subsections.

### API / Server Functions
- `getAdminStats()` — Admin only. Aggregated counts.

### UI / Routes
- `/admin` — Dashboard layout with cards and lists.

### Edge Cases & Error Handling
- Zero counts display as 0, not null/undefined.

### Acceptance Criteria
- [ ] Stats load correctly.
- [ ] Navigation works to all admin sections.

### Dependencies
- None.

### Deferred / Out of Scope
- Real-time charts.
- Revenue graphs.

---

## Feature 21: Admin User Management

### Context
Admins manage the user base, including role assignment.

### Functional Requirements
- Paginated list of all users with search by name or email.
- View user profile details.
- Change user role: `customer`, `creator`, `admin`.
- Prevent removing the last admin.

### API / Server Functions
- `listUsers(query?: string, pagination)` — Admin only.
- `getUserDetail(userId: string)` — Admin only.
- `updateUserRole(userId: string, role: UserRole)` — Admin only.

### UI / Routes
- `/admin/users` — User table with search.
- `/admin/users/$userId` — Detail view with role dropdown.

### Edge Cases & Error Handling
- Last admin demotion: 403 with clear message.
- Self-demotion: warn or block.

### Security Considerations
- Role changes are powerful; log them.

### Acceptance Criteria
- [ ] Admin can search and view users.
- [ ] Role changes persist.
- [ ] Last admin is protected.

### Dependencies
- None.

### Deferred / Out of Scope
- User deletion.
- Ban/suspend user account.
- Impersonation.

---

## Feature 22: Admin Shop Moderation

### Context
Admins ensure shop quality and compliance by moderating storefronts.

### Functional Requirements
- List all shops with owner, status, creation date.
- Suspend or unsuspend a shop.
- Add a moderation note visible to admins.
- Suspended shops are hidden from public (404).

### Database Schema
Migration to add to `shop`:
```sql
is_suspended     boolean not null default false
moderation_note  text nullable
```

### API / Server Functions
- `listAllShops(filters, pagination)` — Admin only.
- `moderateShop(shopId: string, action: 'suspend' | 'unsuspend', note?: string)` — Admin only.

### UI / Routes
- `/admin/shops` — Shop table with status badges, suspend/unsuspend buttons.

### Edge Cases & Error Handling
- Suspending a shop with active orders: allowed, but existing orders continue processing.
- Already suspended: idempotent.

### Acceptance Criteria
- [ ] Admin can suspend/unsuspend shops.
- [ ] Suspended shops are inaccessible to public.
- [ ] Moderation notes are saved.

### Dependencies
- Feature 4: Shop Storefront (must respect suspension).

### Deferred / Out of Scope
- Shop verification badge workflow.
- Automated moderation.

---

## Feature 23: Admin Dispute Resolution

### Context
Admins act as mediators in disputes between buyers and creators. This is the admin interface for Feature 15.

### Functional Requirements
- Queue of open disputes sorted by age.
- Detail view with full message thread, order info, and participant details.
- Resolution actions: close (no action), partial refund, full refund.
- Mock refund in v1.0 (logs intent, updates status, defers Mollie call).

### API / Server Functions
Uses Feature 15 functions: `listOpenDisputes`, `getDisputeDetail`, `addDisputeMessage`, `resolveDispute`.

### UI / Routes
- `/admin/disputes` — Queue table.
- `/admin/disputes/$disputeId` — Detail with resolution panel.

### Edge Cases & Error Handling
- Resolving already closed dispute: 400.
- Refund amount validation.

### Acceptance Criteria
- [ ] Admin can view and resolve disputes.
- [ ] Resolution updates order status.
- [ ] Notifications sent to parties.

### Dependencies
- Feature 15: Dispute Resolution.

### Deferred / Out of Scope
- Automated resolution suggestions.

---

## Feature 24: Admin Payout Oversight

### Context
Admins track and manage creator payouts. In v1.0 this is manual tracking; automation comes later.

### Functional Requirements
- List all pending payouts with creator, shop, amount, and link to order.
- Mark payout as sent (manual action).
- View payout history.

### API / Server Functions
- `listPendingPayouts()` — Admin only.
- `markPayoutSent(payoutId: string)` — Admin only.
- `listPayoutHistory(pagination)` — Admin only.

### UI / Routes
- `/admin/payouts` — Pending table and history tabs.

### Edge Cases & Error Handling
- Marking same payout twice: idempotent.

### Acceptance Criteria
- [ ] Pending payouts are visible.
- [ ] Admin can mark as sent.
- [ ] History is accurate.

### Dependencies
- Feature 19: Creator Payout View.

### Deferred / Out of Scope
- Automatic payout via Mollie.
- Payout scheduling.

---

## Feature 25: Admin Order Inspector

### Context
Support tool for admins to investigate any order on the platform.

### Functional Requirements
- Search all platform orders by ID or buyer email/name.
- View complete order tree: platform order, shop orders, items, statuses, addresses.

### API / Server Functions
- `listAllPlatformOrders(query?: string, pagination)` — Admin only.
- `getPlatformOrderDetail(orderId: string)` — Admin only.

### UI / Routes
- `/admin/orders` — Searchable order list.
- `/admin/orders/$platformOrderId` — Full order tree view.

### Acceptance Criteria
- [ ] Admin can find any order.
- [ ] Full details are visible.

### Dependencies
- Feature 10: Platform Order System.

### Deferred / Out of Scope
- Order modification by admin.
- Export to PDF.

---

## Feature 26: SEO — Meta Tag System

### Context
Every public page needs correct HTML `<head>` content for search engines and social sharing. TanStack Start provides a `head()` API that runs server-side.

### Functional Requirements
- Dynamic `<title>`, `<meta name="description">`, canonical URL, and Open Graph tags on every public route.
- Helper function `createPageMeta()` that accepts title, description, OG image URL, canonical path, and JSON-LD object.
- Localization-aware: meta content uses the current locale.
- Product pages include `og:price:amount` and `og:price:currency`.

### Technical Approach
- Create a utility in `src/lib/seo.ts` that returns the `meta` and `links` arrays expected by TanStack Start's `head()`.
- Each public route calls this helper with route-specific data.
- OG images: product primary image or shop banner; fallback to platform logo.

### UI / Routes
Applied to: `/`, `/shops`, `/shops/$shopSlug`, `/products/$productSlug`, `/search`, `/about`.

### Edge Cases & Error Handling
- Missing description: fallback to platform default.
- Missing OG image: fallback to platform default image.

### Acceptance Criteria
- [ ] Every public page has unique, accurate `<title>` and description.
- [ ] Product pages include price in OG tags.
- [ ] Canonical URLs are self-referencing and correct.

### Dependencies
- Feature 2: Product Catalog (for product meta).
- Feature 4: Shop Storefront (for shop meta).

### Deferred / Out of Scope
- Twitter Card customization beyond OG.
- A/B tested meta descriptions.

---

## Feature 27: SEO — XML Sitemap

### Context
Search engines use sitemaps to discover pages. A dynamic sitemap ensures new shops and products are indexed quickly.

### Functional Requirements
- `/sitemap.xml` returns a valid XML sitemap.
- Includes: homepage, shop directory, all active shops, all active products, category pages, about page.
- Each entry has `loc`, `lastmod` (from `updated_at`), `priority`, and `changefreq`.
- Regenerated on request or cached for 24 hours.

### API / Server Functions
- `generateSitemap()` — Queries active shops and products, emits XML string.

### Route
- `/sitemap.xml` — Server-side route returning `text/xml`.

### Edge Cases & Error Handling
- 50,000+ URLs: unlikely in v1.0; if reached, split into sitemap index.
- Suspended shops or inactive products excluded.

### Acceptance Criteria
- [ ] Sitemap is valid XML and passes Google Search Console validation.
- [ ] All active public pages are included.
- [ ] Suspended/inactive content excluded.

### Dependencies
- Feature 2: Product Catalog.
- Feature 4: Shop Storefront.

### Deferred / Out of Scope
- Image sitemap.
- News sitemap.

---

## Feature 28: SEO — Structured Data (JSON-LD)

### Context
Schema.org structured data enables rich snippets in search results (product prices, ratings, shop info).

### Functional Requirements
- `Product` schema on `/products/$productSlug`: `@type: Product`, name, description, image array, offers (price, priceCurrency: EUR, availability: InStock/OutOfStock), brand (shop name), sku (product ID).
- `Store` schema on `/shops/$shopSlug`: `@type: Store`, name, description, url, image.
- `WebSite` schema on `/`: `@type: WebSite`, name, url, potentialAction (search URL template).

### Technical Approach
- JSON-LD injected as `<script type="application/ld+json">` in the page shell.
- Helper function generates schema objects from typed data.

### Edge Cases & Error Handling
- Missing optional fields omitted rather than null.
- Invalid URLs escaped.

### Acceptance Criteria
- [ ] Product pages contain valid Product schema.
- [ ] Shop pages contain valid Store schema.
- [ ] Homepage contains valid WebSite schema.
- [ ] Passes Google's Rich Results Test.

### Dependencies
- Feature 26: SEO — Meta Tag System (for injection mechanism).

### Deferred / Out of Scope
- Review schema (aggregateRating) until review volume exists.
- BreadcrumbList schema.

---

## Feature 29: SEO — Robots.txt

### Context
Tells crawlers which pages to index and which to avoid.

### Functional Requirements
- Static `/robots.txt`.
- `Allow:` public routes.
- `Disallow:` `/cart`, `/checkout`, `/creator`, `/admin`, `/api`, `/orders`.
- Sitemap reference included.

### Route
- `/robots.txt` — Static text response.

### Acceptance Criteria
- [ ] Valid robots.txt served.
- [ ] Private routes disallowed.
- [ ] Sitemap URL referenced.

### Dependencies
- Feature 27: SEO — XML Sitemap (for reference URL).

---

## Feature 30: Performance Optimization

### Context
Fast pages improve SEO rankings and conversion rates. Targets: LCP < 2.5s, CLS < 0.1.

### Functional Requirements
- Product images use responsive `srcset` with multiple sizes.
- Images lazy-load below the fold.
- Placeholder blur or dominant color while loading.
- Admin and creator routes use route-level code splitting (lazy loading).
- Database queries audited for N+1 issues; add missing Drizzle indexes.
- Cart and checkout state minimal; no over-fetching.

### Technical Approach
- `<img loading="lazy" srcset="..." sizes="..." />`.
- TanStack Router `lazy` route configuration for heavy backoffice routes.
- Drizzle `with` relations carefully reviewed; use joins where needed.

### Acceptance Criteria
- [ ] Product images are responsive.
- [ ] No N+1 queries in catalog or order flows.
- [ ] Backoffice routes do not block initial bundle.
- [ ] LCP < 2.5s on product pages (measured in Lighthouse).

### Dependencies
- Feature 2: Product Catalog.

### Deferred / Out of Scope
- CDN integration.
- Service worker caching.
- Edge deployment.

---

## Feature 31: Accessibility Compliance

### Context
All users, including those using assistive technologies, must be able to browse and purchase.

### Functional Requirements
- All interactive elements are keyboard accessible (Tab order logical, Enter/Space activation).
- All form inputs have associated `<label>` elements.
- Error messages are linked to inputs via `aria-describedby`.
- Focus management on modals and page transitions.
- Color contrast meets WCAG AA (4.5:1 for normal text).
- Semantic HTML: `<main>`, `<nav>`, `<article>`, proper heading hierarchy.

### Audit Checklist
- [ ] Cart page usable with keyboard only.
- [ ] Checkout form screen-reader friendly.
- [ ] Creator backoffice tables navigable.
- [ ] Notification badge announced to screen readers.
- [ ] No axe-core critical violations.

### Acceptance Criteria
- [ ] Automated a11y tests pass (axe-core in Testing Library).
- [ ] Manual keyboard navigation test passes for checkout flow.

### Dependencies
- All UI features.

### Deferred / Out of Scope
- WCAG AAA compliance.
- Screen-reader optimized live regions for real-time updates.

---

## Feature 32: Mollie Payment Integration

### Context
Mollie is the chosen European payment provider. It handles the single checkout payment and supports refunds. This feature is reserved for the business-setup phase.

### Functional Requirements
- Define a `PaymentProvider` TypeScript interface with methods: `createPayment(amount, currency, description, redirectUrl, webhookUrl)`, `verifyWebhook(payload, signature)`, `refundPayment(paymentId, amount?)`.
- Implement `MolliePaymentProvider` behind this interface.
- `createCheckout` (Feature 8) uses the provider to initiate payment.
- Webhook handler at `/api/webhooks/mollie` receives payment status updates idempotently.
- On payment success: update `PlatformOrder` and `ShopOrder` statuses to `paid`.
- On payment failure: release inventory, mark order cancelled.
- Refund path in dispute resolution wired to real Mollie refund API.

### API / Server Functions
- `MolliePaymentProvider.createPayment(...)` — Returns payment URL.
- `POST /api/webhooks/mollie` — Verifies signature, idempotently updates order status.

### Environment Variables
- `MOLLIE_API_KEY`
- `MOLLIE_WEBHOOK_SECRET`

### Edge Cases & Error Handling
- Webhook replay: check `PlatformOrder.status` before updating; ignore if already processed.
- Payment expiry: Mollie expires after session timeout; handle as cancellation.
- Partial refund: supported by Mollie and interface.

### Security Considerations
- Webhook signature verification mandatory.
- Never trust payment status from client redirect; only from webhook.
- API key is server-only; never exposed to client.

### Acceptance Criteria
- [ ] Payment flow completes end-to-end.
- [ ] Webhook updates order status correctly.
- [ ] Idempotency prevents duplicate processing.
- [ ] Refunds work via dispute resolution.

### Dependencies
- Feature 8: Checkout Flow.
- Feature 15: Dispute Resolution.

### Deferred / Out of Scope
- Recurring payments/subscriptions.
- Multiple payment methods configuration UI.
- Mollie Connect (onboarding creators directly).

---

## Feature 33: Mondial Relay Shipping Integration

### Context
Mondial Relay (or another European carrier) handles package delivery. Creators generate labels and buyers track shipments.

### Functional Requirements
- Define `ShippingProvider` interface: `getRates(origin, destination, package)`, `createLabel(shipmentDetails)`, `trackShipment(trackingNumber)`.
- Implement `MondialRelayProvider`.
- Checkout shipping method selection calls `getRates` per shop.
- Creator order fulfillment calls `createLabel` and stores tracking info.
- Tracking link displayed to buyer.

### Environment Variables
- `MONDIAL_RELAY_API_KEY`

### Edge Cases & Error Handling
- API downtime: show fallback manual shipping option.
- Unsupported destination: show error, require manual method.

### Acceptance Criteria
- [ ] Shipping rates display at checkout.
- [ ] Labels generate from creator backoffice.
- [ ] Tracking info is stored and displayed.

### Dependencies
- Feature 8: Checkout Flow.
- Feature 12: Creator Order Fulfillment.

### Deferred / Out of Scope
- Multi-package shipments.
- Real-time tracking map.

---

## Feature 34: Email Notification Delivery

### Context
In-app notifications are sufficient for v1.0, but email is needed for trust and re-engagement. Uses a European transactional email provider.

### Functional Requirements
- Define `EmailProvider` interface: `sendTransactional(to, template, data)`.
- Implement provider for chosen service.
- Templates: order confirmation, shipping notification, dispute update.
- Fallback: if email fails, the flow continues (in-app notification is primary).

### Edge Cases & Error Handling
- Bounced email: log, do not retry indefinitely.
- Template rendering error: log, send plain text fallback.

### Acceptance Criteria
- [ ] Emails sent for order confirmation and shipping.
- [ ] Failures do not block user flows.

### Dependencies
- Feature 14: Notification System.

### Deferred / Out of Scope
- Marketing emails.
- Unsubscribe management.
- Email preferences UI.

---

## Feature 35: Security Hardening

### Context
Before production, the platform must resist common attacks.

### Functional Requirements
- Rate limiting: auth endpoints (5 attempts/minute), checkout (1 attempt/5 seconds per user), search (30 requests/minute per IP).
- Content Security Policy headers reviewed and tightened.
- Input sanitization on all text fields (product descriptions, dispute messages).
- IDOR prevention: verify ownership on every resource access (product, order, shop, dispute).
- Penetration test checklist executed: XSS (stored and reflected), CSRF (Better Auth handles cookies), SQL injection (Drizzle parameterized), IDOR, privilege escalation.

### Acceptance Criteria
- [ ] Rate limits enforced.
- [ ] No critical vulnerabilities from checklist.
- [ ] All resource endpoints verify ownership.

### Dependencies
- All features.

### Deferred / Out of Scope
- Bug bounty program.
- SOC 2 compliance.

---

## Feature 36: Monitoring & Observability

### Context
When things break in production, developers need to know why quickly.

### Functional Requirements
- Sentry alerts for: checkout failures, payment webhook errors, unhandled 500s, auth anomalies.
- Structured logging for order lifecycle events (order created, paid, shipped, disputed, resolved).
- Health check endpoint at `/api/health` returns 200 with database connectivity status.

### API / Server Functions
- `GET /api/health` — Returns `{ status: "ok", db: "connected" }` or 503.

### Acceptance Criteria
- [ ] Sentry captures checkout and webhook errors.
- [ ] Order lifecycle is traceable in logs.
- [ ] Health check reflects actual system state.

### Dependencies
- Sentry (already integrated).

### Deferred / Out of Scope
- Custom metrics dashboard.
- Log aggregation pipeline.

---

## Feature 37: Domain & SSL Setup

### Context
The final go-live step: making the platform reachable on a real domain with HTTPS and activating Mollie live mode.

### Functional Requirements
- Production domain configured (DNS A/AAAA records).
- SSL certificate provisioned and auto-renewing.
- Mollie live mode activated (requires verified business entity and domain).
- Environment variables updated for production.

### Acceptance Criteria
- [ ] Site serves over HTTPS with valid certificate.
- [ ] Mollie dashboard shows live mode active.
- [ ] No mixed content warnings.

### Dependencies
- Feature 32: Mollie Payment Integration.

### Deferred / Out of Scope
- Multi-region deployment.
- CDN configuration.
