# Implementation Prompt: Production-Ready Admin Panel

## Context

You are implementing the Eurtisan admin panel to production-grade standards. A comprehensive PRD exists at:

```
docs/prd/admin-panel-production-ready.md
```

**Read it fully before writing any code.**

The existing codebase already has a functional but disjointed admin area under `src/routes/admin/*` and backend libs under `src/lib/admin-*.ts`. Your job is to elevate this to the same professional standard as the shop onboarding wizard (`src/components/sell/WizardShell.tsx`, `src/components/sell/OnboardingProvider.tsx`, `src/components/sell/Step8Review.tsx`).

## Behavioral Contract

### 1. Pattern Compliance (Non-Negotiable)

Before touching any admin code, study these existing implementations and match their patterns exactly:

- **Layout shell quality:** `src/components/sell/WizardShell.tsx` — persistent navigation, responsive breakpoints, mobile drawer behavior, save indicators, keyboard awareness.
- **Dialog standard:** `src/components/ui/primitives/dialog.tsx` — every modal in the admin panel must use this primitive. No raw backdrop `div`s. The current `/admin/shops` page violates this; fix it.
- **Form handling:** `src/components/sell/Step1Identity.tsx` — debounced validation, inline error states, loading indicators, optimistic feedback.
- **Data fetching:** `src/routes/admin/index.tsx` — `createFileRoute`, `beforeLoad: guardRole('admin')`, `loader`, `pendingComponent`, `errorComponent`.
- **Testing:** `src/routes/admin/index.test.tsx` — mock TanStack Router, mock Paraglide `m`, test loading/empty/error/happy states.
- **i18n:** Every user-facing string must use Paraglide (`m.admin_*()`). Add new message keys to the source. Hardcoded English is a defect.
- **Styling:** Use existing Tailwind design tokens only (`text-text-primary`, `bg-surface-default`, `border-border-default`, etc.). No arbitrary values. No one-off color hex codes.

### 2. Quality Hierarchy

When tradeoffs exist, prioritize in this exact order:

1. Security
2. Correctness
3. Data integrity
4. Accessibility
5. Reliability
6. Performance
7. Maintainability
8. Developer experience
9. Convenience

### 3. Hard Rules

- **No `any` types.** Ever. If you need a complex type, define it explicitly.
- **No dead code.** No commented-out blocks. No placeholder TODOs substituting for implementation.
- **No silent failures.** Every catch block must do something meaningful (log, surface error, or explicitly ignore with a comment).
- **No client-side secrets.** Database access stays server-only.
- **No ignored TypeScript errors.** `// @ts-ignore` or `// @ts-expect-error` require explicit justification comments.
- **All server functions validate input with Zod.**
- **All mutating admin functions enforce `guardRole('admin')`.**
- **All new files have colocated tests.**

## Scope

Implement the PRD in the exact phases defined below. **Do not skip phases.** If you cannot complete a phase safely, stop, explain the blocker, and leave the system in a correct state.

### Phase 1: Foundation — Unified Shell + Shared Components + Existing Page Cleanup

**Goal:** The admin area feels like one coherent application, not a collection of standalone pages.

**Deliverables:**
1. `src/components/admin/AdminLayout.tsx` — wraps all admin routes. Desktop: fixed sidebar (256px). Mobile: hamburger drawer. Includes breadcrumbs, page title, global admin search (Cmd+Shift+K), admin avatar/logout. Use the navigation structure from the PRD §4.1.
2. `src/routes/admin/__root.tsx` — parent layout route that renders `AdminLayout` with `<Outlet />`.
3. `src/components/admin/DataTable.tsx` — reusable sortable table. Accept columns, data, optional row selection, sorting state callbacks. Do NOT add `@tanstack/react-table` as a dependency. Build a lightweight custom component (~150 lines) using existing tokens.
4. `src/components/admin/DataTablePagination.tsx` — standardized pagination bar (previous/next, page size selector, "Showing X–Y of Z"). Use on every paginated admin page.
5. `src/components/admin/StatCard.tsx` — extract and generalize from `AdminDashboard.tsx`.
6. Refactor ALL existing admin routes (`/admin/shops`, `/admin/orders`, `/admin/disputes`, `/admin/payouts`) to:
   - Remove their own page wrappers and rely on `AdminLayout`.
   - Replace every raw modal `div` with the `Dialog` primitive.
   - Add `DataTable`-based tables with consistent column headers, hover states, and action buttons.
   - Add `DataTablePagination` everywhere pagination exists.
7. Add search + sorting to `/admin/shops`.
8. Add date range + status multi-select filter to `/admin/orders`.
9. Add status filter tabs + search to `/admin/disputes`.
10. Add search + date filter to `/admin/payouts`.

**Verification:**
- `make lint` passes.
- `make format` passes.
- `make check` passes.
- All existing admin tests pass (`make test-related src/routes/admin/`).
- Keyboard navigation works across all admin pages (Tab, Enter, Escape).
- Mobile drawer opens/closes correctly.

---

### Phase 2: User & Content Management — New Entity Pages

**Goal:** Admins can manage users, categories, and products.

**Deliverables:**
1. **Database migrations** (generate with `make db-generate`):
   - `user.banned_at` (timestamp, nullable)
   - `user.ban_reason` (text, nullable)
   - `audit_log` table (see PRD §7.1 for full schema)
   - `category.sort_order` (integer, default 0)
   - Performance indexes (PRD §7.2)
2. `src/lib/audit-log.server.ts` with `emitAuditEvent()` helper. Every admin mutation must call this after the main transaction commits. Wrap in try/catch so audit failures never block user-facing operations.
3. Instrument ALL existing admin mutations with audit logging:
   - `moderateShop` (suspend/unsuspend)
   - `moderateShopApplication` (approve/reject/request_changes)
   - `markPayoutSent`
   - `resolveDispute`
4. `/admin/users` page + backend (`src/lib/admin-users.ts`, `.server.ts`):
   - Paginated table with search (name/email), role filter, status filter (active/banned).
   - Actions: Change Role (Dialog confirmation), Ban/Unban (Dialog with optional reason).
   - Update `requireAuthUser()` and `requireRoleUser()` to reject users with `banned_at` set.
5. `/admin/categories` page + backend (`src/lib/admin-categories.ts`, `.server.ts`):
   - Tree/list view of all categories with indentation.
   - Create, Edit, Delete (with confirmation Dialog).
   - Slug uniqueness validation. No circular parent references. Max depth: 3.
   - Reordering via simple up/down buttons (do NOT add `@dnd-kit` unless explicitly told to — keep dependencies minimal).
6. `/admin/products` page + backend (`src/lib/admin-products.ts`, `.server.ts`):
   - Cross-shop product listing. Search by name/shop. Filters: shop, category, status, price range.
   - Actions: View (link to public page), Toggle Active (optimistic UI).

**Verification:**
- Migrations run cleanly (`make db-migrate`).
- Every new `.ts` file has a colocated `.test.ts`.
- Every new `.tsx` route file has a colocated `.test.tsx`.
- Audit entries are created for every admin action (verify by querying `audit_log` in Drizzle Studio).
- Banned users cannot log in.

---

### Phase 3: Dashboard v2 — Data Visualization

**Goal:** The dashboard provides actionable insight, not just raw numbers.

**Deliverables:**
1. Add `recharts` as a dependency (run `make install`).
2. `src/lib/admin-dashboard.server.ts` — add `getDashboardTrends({ days })` returning daily signup count, order count, and revenue aggregates.
3. `src/components/admin/TrendChart.tsx` — lazy-loaded Recharts wrapper with loading skeleton fallback.
4. Redesign `/admin/` (`AdminDashboard.tsx`):
   - Keep 4 stat cards but make them clickable (navigate to respective list views).
   - Add two trend charts below: "Signups (30d)" and "Revenue (30d)".
   - Add a "Pending Actions" widget (pending shops + pending payouts + open disputes).
   - Add a "Recent Activity" widget showing last 5 audit log entries.
5. Update `src/routes/admin/index.tsx` loader to fetch trends.

**Verification:**
- Charts render with real data.
- Lazy loading works (chart chunk is separate in build output).
- Dashboard tests updated and passing.

---

### Phase 4: Audit Log UI

**Goal:** Complete transparency of admin actions.

**Deliverables:**
1. `/admin/audit-log` page:
   - Timeline view: vertical list with action icons, actor name, timestamp, resource type.
   - Expandable metadata JSON for each entry.
   - Filters: action type dropdown, actor search, date range, resource type.
   - Pagination via `DataTablePagination`.

**Verification:**
- All historical admin actions appear in the timeline.
- Filters work server-side.
- Tests pass.

---

### Phase 5: Polish & Production Hardening

**Goal:** No rough edges. Ready for real operators.

**Deliverables:**
1. **CSV Export** button on `/admin/shops`, `/admin/orders`, `/admin/payouts`, `/admin/users`, `/admin/products`. Generate client-side from the currently loaded/filtered dataset. No server-side streaming needed for v1.
2. **Bulk actions** on `/admin/shops` and `/admin/products`: checkbox row selection, bulk suspend/unsuspend (shops), bulk toggle active (products). Each bulk action is one API call per item (sequential to avoid lock contention), with a progress indicator.
3. **Keyboard shortcuts modal**: Press `?` anywhere in the admin area to show a cheatsheet of available shortcuts.
4. **Accessibility audit**: Verify every Dialog traps focus and returns focus. Verify all tables have proper `<th scope="col">`. Verify color contrast. Verify all interactive elements are keyboard-reachable.
5. **Performance audit**: Run `EXPLAIN ANALYZE` on all new list queries. Ensure they use indexes and execute in < 200ms on 10k rows.
6. **Final verification**:
   - `make lint` — zero errors/warnings.
   - `make format` — zero changes.
   - `make check` — passes.
   - `make test` — full suite passes (or at minimum `make test-related src/routes/admin/` and all new lib tests).
   - No console errors in browser dev tools on any admin page.

## File Naming Conventions

Follow existing project conventions exactly:

- Components: `PascalCase.tsx` (`AdminLayout.tsx`, `DataTable.tsx`)
- Hooks: `camelCase` with `use` prefix (`useAdminSearch.ts`)
- Server functions: `action-oriented` (`listUsers.ts`, `banUser.ts`)
- Routes: Follow TanStack Router file-based conventions
- Tests: Colocated (`AdminLayout.test.tsx`)

## Open Questions — Resolve These First

Before starting implementation, read the PRD §15 and make the following decisions. If any are ambiguous, ask for clarification rather than assuming:

1. **Charts:** Confirm `recharts` is acceptable, or prefer a lighter alternative?
2. **Category reordering:** Use `@dnd-kit/sortable` (new deps) or simple up/down buttons (no new deps)?
3. **Analytics page:** Is `/admin/analytics` in scope or a follow-up ticket?
4. **CSV export:** Client-side generation from loaded JSON is sufficient for v1?

## Definition of Done

This task is **not complete** until ALL of the following are true:

- [ ] All implemented phases are complete per their deliverables.
- [ ] Every new file has colocated tests; all tests pass.
- [ ] All existing admin tests still pass.
- [ ] `make lint` returns zero errors/warnings.
- [ ] `make format` returns zero changes.
- [ ] `make check` passes.
- [ ] TypeScript compiles cleanly with zero errors.
- [ ] Database migrations are generated and committed.
- [ ] All user-facing strings use Paraglide i18n (no hardcoded English).
- [ ] No `any` types without explicit justification.
- [ ] No dead code or commented-out blocks.
- [ ] All dialogs use the `Dialog` primitive (no raw backdrop divs).
- [ ] All admin server functions enforce `guardRole('admin')`.
- [ ] Audit logging is instrumented on every admin mutation.
- [ ] Banned users are blocked from authentication.
- [ ] Keyboard navigation works on every admin page and dialog.
- [ ] Mobile layout is usable (sidebar drawer, readable tables, accessible touch targets).
- [ ] New SQL queries have indexes and run < 200ms.
- [ ] This PRD and the implementation are consistent. Update the PRD if architectural decisions diverge.

## How to Start

1. Read `docs/prd/admin-panel-production-ready.md` in full.
2. Read the existing admin routes and components (`src/routes/admin/*`, `src/lib/admin-*.ts`).
3. Read the shop onboarding reference files (`src/components/sell/WizardShell.tsx`, `src/components/sell/OnboardingProvider.tsx`).
4. Read `src/components/ui/primitives/dialog.tsx`.
5. Ask any questions about the open questions above.
6. Begin Phase 1. Do not jump ahead.
