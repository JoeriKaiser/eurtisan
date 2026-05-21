# PRD: Production-Ready Admin Panel

> **Ticket:** `ADMIN-PROD-001`  
> **Status:** Draft — Ready for Review  
> **Priority:** High  
> **Target Release:** v1.0  
> **Author:** Engineering  
> **Last Updated:** 2026-05-20

---

## 1. Executive Summary

The Eurtisan admin panel currently exists as a functional but disjointed set of pages (`/admin/*`). While core backend operations (shop moderation, order inspection, dispute resolution, payout processing) are wired and working, the **UI layer lacks the cohesion, polish, and completeness expected of a production-grade marketplace administration interface**.

This PRD defines the work required to elevate the admin panel to the same professional standard as the shop onboarding wizard — featuring a unified shell architecture, data visualization, comprehensive entity management, audit logging, bulk operations, and a fully responsive, accessible interface.

---

## 2. Current State Analysis

### 2.1 What Exists Today

| Area | Status | Notes |
|------|--------|-------|
| **Dashboard** (`/admin/`) | ✅ Functional | 4 stat cards + recent signups/orders + nav cards |
| **Shop Moderation** (`/admin/shops`) | ✅ Functional | Suspension + application review with detail dialog |
| **Orders** (`/admin/orders`) | ✅ Functional | Search + paginated table + detail page |
| **Disputes** (`/admin/disputes`) | ✅ Functional | Queue + detail with resolution form |
| **Payouts** (`/admin/payouts`) | ✅ Functional | Pending/history tabs + mark-as-sent |
| **Role-based access** | ✅ Functional | `guardRole('admin')` on all routes |
| **i18n strings** | ✅ Partial | ~80 admin messages exist in Paraglide |
| **Tests** | ⚠️ Partial | Dashboard, disputes, orders, shops have tests |

### 2.2 Quality Gaps (Relative to Shop Onboarding Standard)

| Gap | Severity | Reference Standard |
|-----|----------|-------------------|
| **No unified admin shell** — each page is standalone with no persistent sidebar, breadcrumbs, or context header | 🔴 High | Onboarding `WizardShell` |
| **Raw modal overlays** — shops page uses manual `div` backdrops instead of the `Dialog` primitive | 🔴 High | `dialog.tsx` primitive |
| **No data visualization** — dashboard shows only raw numbers; no trend charts | 🔴 High | Production dashboards |
| **Missing user management** — no way to view users, change roles, or suspend accounts | 🔴 High | Core marketplace need |
| **Missing category management** — no CRUD UI for product categories | 🟡 Medium | Needed for content ops |
| **Missing product catalog** — no cross-shop product listing view | 🟡 Medium | Content moderation need |
| **No audit logging** — admin actions are not tracked or visible | 🟡 Medium | Compliance / security |
| **No bulk operations** — every action is single-item | 🟡 Medium | Operational efficiency |
| **No CSV exports** — data cannot be extracted from UI | 🟡 Medium | Reporting need |
| **Inconsistent table patterns** — column layouts vary across pages | 🟡 Medium | Design system |
| **No mobile admin nav** — onboarding has mobile stepper; admin has nothing | 🟡 Medium | Responsive standard |
| **Limited filtering** — orders only have text search; no date ranges, status multi-select | 🟡 Medium | Operational need |
| **No real-time indicators** — no polling/SSE for live queue updates | 🟢 Low | Nice to have |
| **No keyboard shortcuts** — no admin-specific hotkeys | 🟢 Low | Power-user UX |

---

## 3. Goals & Non-Goals

### 3.1 Goals

1. **Unified Admin Shell** — Persistent sidebar navigation, breadcrumbs, mobile drawer, and page headers on every admin route.
2. **Dashboard v2** — Replace static stat cards with trend charts (signups, orders, revenue, disputes over time) + quick-action widgets.
3. **User Management** — Full user directory with search, filtering by role, role assignment, and account suspension.
4. **Category Management** — CRUD interface for the `category` table with drag-and-drop reordering or parent-child visualization.
5. **Product Catalog** — Cross-shop product listing with search, filter by shop/status, and moderation actions (hide/unhide).
6. **Audit Log** — Read-only timeline of all admin actions (suspensions, approvals, dispute resolutions, payout marks, role changes).
7. **Production Polish** — Use `Dialog` primitive everywhere, consistent `DataTable` component, responsive layouts, loading skeletons, error boundaries, and empty states on every view.
8. **Accessibility Compliance** — All admin interactions keyboard-navigable, ARIA labels correct, focus management on dialogs, color contrast verified.

### 3.2 Non-Goals

- **Real-time websocket dashboard** — Polling every 30s is sufficient; SSE/websockets are out of scope.
- **Advanced RBAC** — Only `admin` vs. non-admin for now; no granular permissions (e.g. `order_read_only`).
- **Third-party integrations** — No Stripe Connect dashboard embedding, no Mollie dashboard links.
- **Email templates editor** — Out of scope.
- **Feature flags UI** — Out of scope.

---

## 4. Detailed Feature Specifications

### 4.1 Admin Shell (`AdminLayout`)

**File:** `src/components/admin/AdminLayout.tsx`

**Behavior:**
- Wraps all `/admin/*` routes via a parent layout route (or each route imports it).
- **Desktop:** Fixed left sidebar (256px) with navigation links, active state highlighting, and section grouping.
- **Mobile:** Hamburger-triggered slide-out drawer overlay.
- **Header bar:** Page title, breadcrumb trail (`Dashboard > Shops > Applications`), user avatar + logout, and a global "Admin Search" quick-jump (Cmd+Shift+K).
- **Keyboard:** `?` opens a shortcuts cheat-sheet modal.

**Navigation Items:**

```
Overview
  Dashboard          /admin/
  Analytics          /admin/analytics

Commerce
  Orders             /admin/orders
  Payouts            /admin/payouts

Content
  Shops              /admin/shops
  Products           /admin/products      [NEW]
  Categories         /admin/categories    [NEW]

Community
  Users              /admin/users         [NEW]
  Disputes           /admin/disputes

System
  Audit Log          /admin/audit-log     [NEW]
```

**Active State:** Use `router.state.location.pathname` to highlight the current section. Support nested active states (e.g., `/admin/orders/xyz` highlights "Orders").

**Responsive:**
- `< md`: Sidebar hidden; top bar has hamburger icon. Drawer slides from left with backdrop.
- `>= md`: Sidebar always visible. Main content has `ml-64` offset.

---

### 4.2 Dashboard v2 (`/admin/`)

**File:** `src/routes/admin/index.tsx` + `src/components/admin/DashboardV2.tsx`

**Layout:**
- Top row: 4 stat cards (same metrics as today) — but each card is clickable and navigates to its respective list view.
- Second row: **Trend Charts** (2-column grid on desktop, stacked on mobile).
  - **Chart 1:** "Signups over last 30 days" — daily line chart.
  - **Chart 2:** "Revenue over last 30 days" — daily bar chart of `platform_order.totalCents` where `status IN ('paid', 'shipped', 'delivered', 'completed')`.
- Third row: **Quick Action Widgets** (3-column grid).
  - **Pending Actions:** Count of pending shop applications + pending payouts + open disputes. Each is a link.
  - **Recent Activity:** Last 5 audit log entries (see 4.7).
  - **System Health:** `rate_limit` queue depth + last error snapshot (if any).

**Chart Library Decision:**
- Use `recharts` (lightweight, React-native, no canvas complexity). Add as a new dependency.
- If bundle size is a concern, lazy-load chart components via `React.lazy()`.

**Data Requirements:**
- New server function: `getDashboardTrends({ days: number })` returning daily aggregates.
- Reuse existing `getAdminDashboardStats`, `getRecentOrders`, `getRecentSignups`.

---

### 4.3 User Management (`/admin/users`) [NEW]

**Files:**
- `src/routes/admin/users.tsx`
- `src/lib/admin-users.ts`
- `src/lib/admin-users.server.ts`

**Schema additions:**
```sql
-- Add to user table (or new table if preferred):
-- user.banned_at timestamp (nullable)
-- user.ban_reason text (nullable)
```

**UI:**
- **Search bar:** Search by name or email (server-side ILIKE).
- **Filters:** Role dropdown (`all`, `customer`, `creator`, `admin`), Status toggle (`all`, `active`, `banned`).
- **Table columns:** Avatar + Name, Email, Role, Shop Count, Created At, Status, Actions.
- **Actions:**
  - "Change Role" — dropdown in a `Dialog` confirmation.
  - "Ban / Unban" — `Dialog` with optional reason textarea.
- **Pagination:** Same pattern as `/admin/shops` (page + pageSize).

**Server Functions:**
- `listUsers({ query?, role?, status?, page, pageSize })`
- `updateUserRole({ userId, role })` — requires `admin`.
- `banUser({ userId, reason? })` / `unbanUser({ userId })` — sets `banned_at`.

**Auth Impact:**
- `requireAuthUser()` must check `banned_at` and reject with `FORBIDDEN` if set.
- Login flow should show a "Your account has been suspended" message.

---

### 4.4 Category Management (`/admin/categories`) [NEW]

**Files:**
- `src/routes/admin/categories.tsx`
- `src/lib/admin-categories.ts`

**UI:**
- **Tree/List view:** Show all categories with indentation for children.
- **Create:** Inline form or `Dialog` — name, slug (auto-generated), parent category dropdown, description.
- **Edit:** Inline or `Dialog` — same fields.
- **Delete:** `Dialog` confirmation. Prevent deletion if products reference the category (FK constraint handles this; show friendly error).
- **Reorder:** Drag-and-drop to reorder siblings. Use `@dnd-kit/sortable` (lightweight, accessible).

**Server Functions:**
- `listCategoriesAdmin()` — returns tree structure.
- `createCategory({ name, slug, parentId?, description? })`
- `updateCategory({ id, name, slug, parentId?, description? })`
- `deleteCategory({ id })`
- `reorderCategories({ orderedIds })`

**Validation:**
- Slug uniqueness.
- No circular parent references.
- Max depth: 3 levels.

---

### 4.5 Product Catalog (`/admin/products`) [NEW]

**Files:**
- `src/routes/admin/products.tsx`
- `src/lib/admin-products.ts`

**UI:**
- **Search:** By product name or shop name.
- **Filters:** Shop dropdown, Status (`active` / `inactive`), Category dropdown, Price range.
- **Table columns:** Thumbnail, Product Name, Shop, Category, Price, Stock, Status, Created At, Actions.
- **Actions:**
  - "View" → links to public product page.
  - "Toggle Active" — instant toggle with optimistic UI.
- **Pagination:** Standard pattern.

**Server Functions:**
- `listAllProducts({ query?, shopId?, categoryId?, status?, minPrice?, maxPrice?, page, pageSize })`
- `toggleProductActive({ productId })`

---

### 4.6 Enhanced Existing Pages

#### 4.6.1 Shop Moderation (`/admin/shops`)

**Required Improvements:**
1. **Replace raw modal `div`s** with the `Dialog` primitive (`Dialog`, `DialogBackdrop`, `DialogPopup`, `DialogTitle`, `DialogDescription`).
2. **Add search** — search by shop name, slug, or owner email.
3. **Add sorting** — click column headers to sort by name, createdAt, status.
4. **Bulk actions** — checkbox selection on rows; bulk suspend/unsuspend.
5. **CSV Export** — "Export" button downloads current filtered view as CSV (client-side generation from loaded data).

#### 4.6.2 Orders (`/admin/orders`)

**Required Improvements:**
1. **Date range filter** — `from` / `to` date inputs.
2. **Status multi-select filter** — dropdown to filter by one or more order statuses.
3. **Sorting** — by date, total, status.
4. **Bulk actions** — not applicable (orders shouldn't be bulk-modified by admins), but bulk "export" is useful.

#### 4.6.3 Disputes (`/admin/disputes`)

**Required Improvements:**
1. **Status filter tabs** — `open`, `resolved`, `all`.
2. **Search** — by buyer name, creator name, or order ID fragment.
3. **Sorting** — by age, created date.
4. **Replace raw modal divs** with `Dialog` primitive where applicable.

#### 4.6.4 Payouts (`/admin/payouts`)

**Required Improvements:**
1. **Search** — by creator name or shop name.
2. **Date range filter** on history tab.
3. **CSV Export** for history.

---

### 4.7 Audit Log (`/admin/audit-log`) [NEW]

**Files:**
- `src/routes/admin/audit-log.tsx`
- `src/lib/audit-log.ts`
- `src/lib/audit-log.server.ts`

**Database:**

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL REFERENCES user(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL, -- e.g. 'shop.suspend', 'shop.approve', 'user.ban', 'dispute.resolve'
  resource_type TEXT NOT NULL, -- 'shop', 'user', 'dispute', 'payout', 'order'
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_created_at_idx ON audit_log(created_at DESC);
CREATE INDEX audit_log_actor_id_idx ON audit_log(actor_id);
CREATE INDEX audit_log_action_idx ON audit_log(action);
CREATE INDEX audit_log_resource_idx ON audit_log(resource_type, resource_id);
```

**Instrumentation:**
Every admin server function must emit an audit entry on success:
- `moderateShop` → `shop.suspend` / `shop.unsuspend`
- `moderateShopApplication` → `shop.approve` / `shop.reject` / `shop.request_changes`
- `markPayoutSent` → `payout.mark_sent`
- `resolveDispute` → `dispute.resolve`
- `updateUserRole` → `user.change_role`
- `banUser` / `unbanUser` → `user.ban` / `user.unban`
- `createCategory` / `updateCategory` / `deleteCategory` → `category.*`
- `toggleProductActive` → `product.toggle_active`

**UI:**
- **Filter bar:** Action type dropdown, Actor search, Date range, Resource type.
- **Timeline view:** Vertical timeline with icons per action type, actor name, timestamp, and expandable metadata JSON.
- **Pagination:** Infinite scroll or standard pagination.

**Server Functions:**
- `listAuditLog({ action?, actorId?, resourceType?, resourceId?, from?, to?, page, pageSize })`

---

## 5. UI/UX Requirements

### 5.1 Design System Compliance

All admin UI must use existing primitives:
- `Button`, `Card`, `Badge`, `Skeleton`, `Input`, `Select`, `Dialog` from `src/components/ui/`.
- Color tokens: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `bg-surface-default`, `border-border-default`, etc.
- No inline Tailwind arbitrary values. Use design tokens only.

### 5.2 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< 768px` | Collapsible sidebar drawer, single-column charts, stacked cards, horizontal-scroll tables |
| `768px–1024px` | Visible sidebar, 2-column grids, compact tables |
| `> 1024px` | Full sidebar, 3-column grids, full tables |

### 5.3 Loading States

Every async data surface must have a `pendingComponent` with `Skeleton` placeholders that match the final layout dimensions. No generic spinners.

### 5.4 Empty States

Every list view must have a contextual empty state with an icon, title, and description (e.g., "No pending payouts" + "When creators request payouts, they will appear here.").

### 5.5 Error States

Every route must have an `errorComponent` that:
- Shows `AlertTriangle` icon.
- Displays the error message safely (no stack traces).
- Offers a "Retry" button where applicable.
- Offers a "Go back" link to the parent admin page.

### 5.6 Feedback Patterns

- **Success:** Green toast/inline banner with `CheckCircle` icon, auto-dismiss after 3s.
- **Error:** Red inline banner with `AlertTriangle` icon, persistent until dismissed.
- **Loading:** Inline spinner on the action button (use `isLoading` prop), disabled state.

### 5.7 Dialog Standards

All modals must use the `Dialog` primitive:
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogPortal>
    <DialogBackdrop />
    <DialogPopup>
      <DialogTitle>...</DialogTitle>
      <DialogDescription>...</DialogDescription>
      {/* content */}
    </DialogPopup>
  </DialogPortal>
</Dialog>
```
- Focus trap must work.
- `Escape` key closes the dialog.
- Clicking backdrop closes the dialog.
- Focus returns to trigger on close.

---

## 6. Technical Architecture

### 6.1 File Structure

```
src/
  components/
    admin/
      AdminLayout.tsx           # Shell with sidebar, header, breadcrumbs
      AdminNav.tsx              # Sidebar navigation links
      AdminMobileDrawer.tsx     # Mobile slide-out drawer
      AdminBreadcrumbs.tsx      # Breadcrumb trail component
      AdminSearch.tsx           # Global Cmd+Shift+K quick-jump
      DataTable.tsx             # Reusable sortable/filterable table
      DataTablePagination.tsx   # Reusable pagination controls
      DataTableFilters.tsx      # Reusable filter bar
      StatCard.tsx              # Reusable stat card (extract from AdminDashboard)
      TrendChart.tsx            # Recharts wrapper
      AuditTimeline.tsx         # Audit log timeline component
      CategoryTree.tsx          # Draggable category tree
      UserRoleDialog.tsx        # Role change confirmation
      BanUserDialog.tsx         # Ban confirmation with reason
  routes/
    admin/
      __root.tsx                # Parent layout route (AdminLayout wrapper)
      index.tsx                 # Dashboard v2
      analytics.tsx             # Analytics page (optional Phase 2)
      shops.tsx                 # Enhanced shop moderation
      products.tsx              # [NEW] Product catalog
      categories.tsx            # [NEW] Category management
      users.tsx                 # [NEW] User management
      orders.tsx                # Enhanced orders
      orders.$platformOrderId.tsx
      disputes.tsx              # Enhanced disputes
      disputes.$disputeId.tsx
      payouts.tsx               # Enhanced payouts
      audit-log.tsx             # [NEW] Audit log
  lib/
    admin-dashboard.ts          # Add getDashboardTrends
    admin-users.ts              # [NEW]
    admin-users.server.ts       # [NEW]
    admin-products.ts           # [NEW]
    admin-products.server.ts    # [NEW]
    admin-categories.ts         # [NEW]
    admin-categories.server.ts  # [NEW]
    admin-orders.ts             # Add date range, status filter
    admin-orders.server.ts      # Add date range, status filter
    audit-log.ts                # [NEW]
    audit-log.server.ts         # [NEW]
    data-table.ts               # [NEW] Shared table helpers (sorting, pagination)
```

### 6.2 Route Tree Changes

Create `src/routes/admin/__root.tsx` as a layout route that renders `AdminLayout` and an `<Outlet />` for child routes. This eliminates the need for each admin page to import its own shell.

**Child routes to add:**
- `/admin/products`
- `/admin/categories`
- `/admin/users`
- `/admin/audit-log`

### 6.3 Shared Components

#### `DataTable`
A reusable table component that accepts:
- `columns: ColumnDef<T>[]`
- `data: T[]`
- `sorting?: { column: string; direction: 'asc' | 'desc' }`
- `onSortChange?: (sort) => void`
- `rowSelection?: boolean` — enables checkboxes for bulk actions
- `selectedRows?: string[]`
- `onSelectionChange?: (ids: string[]) => void`

**Why not `@tanstack/react-table`?** The project does not currently use it. Evaluate adding it vs. building a lightweight custom `DataTable`. Given the project's preference for minimal dependencies, a lightweight custom `DataTable` component (~150 lines) using existing Tailwind tokens is preferred.

#### `DataTablePagination`
Standardized pagination bar with previous/next, page size selector, and "Showing X–Y of Z" text. Accepts `page`, `pageSize`, `total`, `onPageChange`, `onPageSizeChange`.

### 6.4 Chart Architecture

Lazy-load chart components to avoid bloating the initial bundle:
```tsx
const TrendChart = React.lazy(() => import('#/components/admin/TrendChart'))
```
Wrap in `<Suspense fallback={<Skeleton... />}>`.

### 6.5 Audit Log Instrumentation

Create a server-side helper:
```ts
// src/lib/audit-log.server.ts
export async function emitAuditEvent(
  actor: SafeUser,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void>
```

Call this at the **end** of every mutating admin server function, after the main transaction commits successfully. Never let audit logging fail the main operation — wrap in `try/catch` and silently log to stderr if insertion fails.

---

## 7. Data Requirements

### 7.1 Schema Migrations

**Migration 1: `user` table enhancements**
```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ban_reason TEXT;
```

**Migration 2: `audit_log` table**
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_created_at_idx ON audit_log(created_at DESC);
CREATE INDEX audit_log_actor_id_idx ON audit_log(actor_id);
CREATE INDEX audit_log_action_idx ON audit_log(action);
CREATE INDEX audit_log_resource_idx ON audit_log(resource_type, resource_id);
```

**Migration 3: `category` ordering**
```sql
ALTER TABLE category ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
CREATE INDEX category_sort_order_idx ON category(sort_order);
```

### 7.2 Indexes for Performance

```sql
-- User search
CREATE INDEX user_name_email_idx ON "user"(name, email);

-- Product admin queries
CREATE INDEX product_name_idx ON product(name);
CREATE INDEX product_shop_active_idx ON product(shop_id, is_active);

-- Order date filtering
CREATE INDEX platform_order_created_at_idx ON platform_order(created_at DESC);
```

---

## 8. API / Server Function Specifications

### 8.1 New Server Functions

| Function | File | Auth | Input Schema | Output |
|----------|------|------|--------------|--------|
| `listUsers` | `admin-users.server.ts` | admin | `z.object({ query?: z.string(), role?: z.enum(['customer','creator','admin']), status?: z.enum(['all','active','banned']), page: z.number(), pageSize: z.number() })` | Paginated users |
| `updateUserRole` | `admin-users.server.ts` | admin | `z.object({ userId: z.string(), role: z.enum(['customer','creator','admin']) })` | Updated user |
| `banUser` | `admin-users.server.ts` | admin | `z.object({ userId: z.string(), reason?: z.string() })` | Updated user |
| `unbanUser` | `admin-users.server.ts` | admin | `z.object({ userId: z.string() })` | Updated user |
| `listAllProducts` | `admin-products.server.ts` | admin | `z.object({ query?, shopId?, categoryId?, status?, minPrice?, maxPrice?, page, pageSize })` | Paginated products |
| `toggleProductActive` | `admin-products.server.ts` | admin | `z.object({ productId: z.string() })` | Updated product |
| `listCategoriesAdmin` | `admin-categories.server.ts` | admin | — | Tree of categories |
| `createCategory` | `admin-categories.server.ts` | admin | `z.object({ name, slug, parentId?, description? })` | Category |
| `updateCategory` | `admin-categories.server.ts` | admin | `z.object({ id, name, slug, parentId?, description? })` | Category |
| `deleteCategory` | `admin-categories.server.ts` | admin | `z.object({ id: z.string() })` | — |
| `reorderCategories` | `admin-categories.server.ts` | admin | `z.object({ orderedIds: z.string().array() })` | — |
| `getDashboardTrends` | `admin-dashboard.server.ts` | admin | `z.object({ days: z.number().default(30) })` | Daily aggregates |
| `listAuditLog` | `audit-log.server.ts` | admin | `z.object({ action?, actorId?, resourceType?, resourceId?, from?, to?, page, pageSize })` | Paginated entries |
| `emitAuditEvent` | `audit-log.server.ts` | internal | See 6.5 | — |

### 8.2 Enhanced Server Functions

| Function | Changes |
|----------|---------|
| `listAllShops` | Add `query?: string` param for name/slug/owner search |
| `listAllPlatformOrders` | Add `from?: Date`, `to?: Date`, `statuses?: string[]` filters |
| `listOpenDisputes` | Add `query?: string`, `status?: 'all' \| 'open' \| 'resolved'` |
| `listPayoutHistory` | Add `from?: Date`, `to?: Date` filters |

---

## 9. Testing Strategy

### 9.1 Unit Tests (Colocated)

Every new `.ts` file in `src/lib/` must have a colocated `.test.ts`:
- `admin-users.test.ts`
- `admin-products.test.ts`
- `admin-categories.test.ts`
- `audit-log.test.ts`

Every new route component must have a colocated `.test.tsx`:
- `users.test.tsx`
- `products.test.tsx`
- `categories.test.tsx`
- `audit-log.test.tsx`

### 9.2 Test Patterns

Follow existing patterns:
- Mock TanStack Router hooks (`useLoaderData`, `useNavigate`).
- Mock Paraglide `m` object with string-returning functions.
- Use `@testing-library/react` + `vitest`.
- Test loading, empty, error, and happy states.
- Test keyboard interactions (Escape to close dialogs, Enter to submit).

### 9.3 Integration Tests

Test critical admin workflows end-to-end:
1. Admin suspends a shop → audit log entry created.
2. Admin bans a user → user cannot log in.
3. Admin creates a category → appears in category tree.
4. Admin resolves a dispute → dispute status updates + audit entry.

Use the existing test database setup (if any) or mock Drizzle queries.

---

## 10. Accessibility Requirements

- **All tables** must use `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`.
- **All dialogs** must trap focus, return focus on close, and close on Escape.
- **All forms** must have associated `<label>` elements or `aria-label`.
- **Color alone** must never convey state — pair badges with text.
- **Keyboard navigation:** All admin actions must be reachable via Tab. Sorting via Enter on headers.
- **Screen reader:** Route titles update via `head` meta. Live regions for success/error toasts.
- **Contrast:** All text meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).

---

## 11. Performance Requirements

- **Bundle size:** Lazy-load chart components and heavy admin routes. Admin-specific code should not bloat the public-facing bundle.
- **Query performance:** All list queries must run in < 200ms with 10k rows. Use `EXPLAIN ANALYZE` on new queries before merge.
- **Pagination:** All lists are server-side paginated. No unbounded `SELECT *`.
- **Rate limiting:** Admin endpoints are subject to stricter rate limits than public endpoints (already partially in place via `rate_limit` table).
- **Audit logging:** Must not block the main request — fire-and-forget pattern.

---

## 12. Security Requirements

- **All admin server functions** must call `requireRoleUser('admin')` at the top. No exceptions.
- **Input sanitization:** All user-provided search queries must use parameterized ILIKE (Drizzle handles this).
- **No PII in logs:** Audit log `metadata` must never contain passwords, tokens, or full addresses.
- **Ban enforcement:** `banned_at` check must happen in `requireAuthUser` and `requireRoleUser`.
- **CSRF:** Better Auth handles session CSRF protection; no additional action needed.

---

## 13. Implementation Phases

### Phase 1: Foundation (Priority: Critical)
**Goal:** Unified shell + component library + existing page cleanup.

- [ ] Create `AdminLayout`, `AdminNav`, `AdminMobileDrawer`, `AdminBreadcrumbs`.
- [ ] Create `src/routes/admin/__root.tsx` layout route.
- [ ] Refactor existing admin routes to use the layout (remove inline page wrappers).
- [ ] Create shared `DataTable`, `DataTablePagination`, `DataTableFilters` components.
- [ ] Replace raw modal `div`s in `/admin/shops` with `Dialog` primitive.
- [ ] Move `StatCard` to `components/admin/` and make reusable.
- [ ] Add search + sorting to `/admin/shops`.
- [ ] Add date range + status filter to `/admin/orders`.
- [ ] Add status filter + search to `/admin/disputes`.
- [ ] Add search + date filter to `/admin/payouts`.

### Phase 2: User & Content Management (Priority: High)
**Goal:** New entity management pages.

- [ ] Migration: `user.banned_at`, `user.ban_reason`, `audit_log` table, `category.sort_order`.
- [ ] Create `audit-log.server.ts` with `emitAuditEvent` helper.
- [ ] Instrument all existing admin mutations with audit logging.
- [ ] Build `/admin/users` page + backend.
- [ ] Build `/admin/categories` page + backend.
- [ ] Build `/admin/products` page + backend.
- [ ] Update auth flow to enforce `banned_at`.

### Phase 3: Dashboard v2 & Analytics (Priority: High)
**Goal:** Data visualization + trends.

- [ ] Add `recharts` dependency.
- [ ] Create `getDashboardTrends` server function.
- [ ] Build `TrendChart` component (lazy-loaded).
- [ ] Redesign `/admin/` dashboard with charts + quick actions + recent audit entries.
- [ ] Add `/admin/analytics` page (optional: deeper drill-downs).

### Phase 4: Audit Log UI (Priority: Medium)
**Goal:** Complete audit visibility.

- [ ] Build `/admin/audit-log` page with timeline view.
- [ ] Add filtering by action type, actor, date range.

### Phase 5: Polish & QA (Priority: Medium)
**Goal:** Production hardening.

- [ ] CSV export on shops, orders, payouts, users, products.
- [ ] Bulk actions on shops and products.
- [ ] Keyboard shortcuts modal (`?`).
- [ ] Full test coverage for all new files.
- [ ] Run `make lint`, `make format`, `make check`.
- [ ] Accessibility audit (keyboard nav, screen reader, contrast).
- [ ] Performance audit (query `EXPLAIN ANALYZE`, bundle analysis).

---

## 14. Definition of Done

A PR resolving this ticket is only complete when:

1. **All Phase 1–5 items** for the implemented scope are complete.
2. **Every new file** has colocated tests that pass (`make test <path>`).
3. **All existing admin tests** still pass (`make test-related src/routes/admin/`).
4. **`make lint`** and **`make format`** return zero errors/warnings.
5. **`make check`** passes.
6. **TypeScript** compiles with zero errors.
7. **Database migrations** are generated (`make db-generate`) and committed.
8. **i18n strings** are added to Paraglide source messages (not just hardcoded English).
9. **No `any` types** without explicit justification.
10. **No dead code** or commented-out blocks.
11. **Accessibility:** All dialogs, tables, and forms pass manual keyboard and screen-reader checks.
12. **Security:** All new server functions enforce admin role; `banned_at` blocks auth.
13. **Performance:** New SQL queries have indexes and run < 200ms on 10k rows.
14. **Documentation:** This PRD is updated if any architectural decisions diverge from the plan.

---

## 15. Open Questions

1. **Chart library:** Confirm `recharts` is acceptable, or prefer a lighter alternative (`visx`, raw SVG)?
2. **Category drag-and-drop:** Is `@dnd-kit/sortable` acceptable as a new dependency, or prefer a simpler "move up/down" button approach?
3. **Analytics scope:** Should `/admin/analytics` be a separate ticket, or included here?
4. **Bulk actions scope:** Which entities truly need bulk actions for v1.0 launch?
5. **CSV export:** Client-side generation from loaded JSON is fine for now, or do we need server-side streaming for large datasets?

---

## 16. Appendix

### A. Related Files (Current)

| File | Purpose |
|------|---------|
| `src/routes/admin/AdminDashboard.tsx` | Current dashboard component |
| `src/routes/admin/shops.tsx` | Shop moderation + applications |
| `src/routes/admin/orders.tsx` | Order list |
| `src/routes/admin/orders.$platformOrderId.tsx` | Order detail |
| `src/routes/admin/disputes.tsx` | Dispute queue |
| `src/routes/admin/disputes/$disputeId.tsx` | Dispute detail |
| `src/routes/admin/payouts.tsx` | Payout management |
| `src/lib/admin-dashboard.ts` | Dashboard stats |
| `src/lib/admin-orders.ts` | Order queries |
| `src/lib/admin-payouts.ts` | Payout queries |
| `src/lib/shop-moderation.ts` | Shop moderation |
| `src/lib/route-guards.ts` | Auth guards |
| `src/components/ui/primitives/dialog.tsx` | Dialog primitive |
| `src/components/sell/WizardShell.tsx` | Reference layout quality |

### B. New Dependencies (Proposed)

| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | `^2.x` | Dashboard trend charts |
| `@dnd-kit/core` | `^6.x` | Category drag-and-drop |
| `@dnd-kit/sortable` | `^8.x` | Category reordering |
| `@dnd-kit/utilities` | `^3.x` | DnD helpers |

---

*End of PRD*
