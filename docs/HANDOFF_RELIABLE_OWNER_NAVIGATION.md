# Handoff Prompt — Execute Reliable Owner Navigation Plan

**Objective:** Implement the production-ready plan documented in `docs/IMPLEMENTATION_PLAN_RELIABLE_OWNER_NAVIGATION.md`.  
**North Star:** Objective #3 — Reliable owner navigation.  
**When done:** Stage all changes and stash them. **Do not commit.**  
**Quality baseline:** `AGENTS.md` rules apply fully.

---

## 1. What you are building

Fix the broken store-owner navigation paths and adjacent placeholder/mocked behavior identified in the audit (`docs/AUDIT_STORE_OWNER_2026-06-12.md`).

### Core fixes

1. **Post-approval payment link** — `src/route-components/sell/status/$shopId.tsx` currently links to `/sell/shops/$shopId/payment` (404). Route it to `/creator/payouts?shopId=...`.
2. **Product edit link** — `src/components/product/ProductTableRow.tsx` currently links to `/studio/$shopId?tab=products` (broken). Route it to `/creator/products/$productId/edit`.
3. **Studio settings link** — `src/route-components/studio/$shopId.tsx` settings card points to itself. Route it to `/creator/shop?shopId=...`.

### Navigation-adjacent fixes required in the same effort

4. **Product thumbnails** — fix raw S3 key rendering in:
   - `src/components/product/ProductTableRow.tsx`
   - `src/route-components/admin/products.tsx`
   Use `getImageUrl(..., { width: 80, format: 'webp' })`.
5. **Placeholder settings API** — implement real `GET`/`PATCH` in `src/routes/api/shops/$shopId/settings.ts`.
6. **Placeholder dashboard API** — implement real per-shop metrics in `src/routes/api/shops/$shopId/dashboard.ts`.
7. **Studio dashboard stub** — replace `src/route-components/studio/$shopId.tsx` with a navigation hub that also displays real per-shop metrics (pending orders, low stock, current-month revenue, active products).
8. **Mollie Connect mock fallback** — remove silent mock credentials from `src/routes/api/auth/mollie/callback.ts`; return 502 if `MOLLIE_CLIENT_ID`/`MOLLIE_CLIENT_SECRET` are missing.

---

## 2. Source plan

Read and follow `docs/IMPLEMENTATION_PLAN_RELIABLE_OWNER_NAVIGATION.md` in detail. It contains:

- Phase-by-phase execution order.
- File-by-file code change examples.
- Required new i18n keys.
- Test plan (unit, component, API, e2e).
- Acceptance criteria.
- Risks and remaining open questions.

### Product decisions already baked into the plan

- Payment CTA: simple landing on `/creator/payouts?shopId=...` — no auto-scroll/focus.
- Settings API: no external callers, so implement the real shape without backward compatibility.
- Studio hub: show real per-shop metrics (in scope).

---

## 3. Hard constraints

You must follow `AGENTS.md` without exception:

- **Quality gates must pass before you claim done:**
  - `make lint`
  - `make format`
  - `make check`
  - Relevant/impacted tests pass.
- **No placeholder TODOs, mock fallbacks, or fake data left in production paths.**
- **No `any` types without justification.**
- **No ignored TypeScript errors.**
- **No dead code or commented-out code.**
- **All external input validated with Zod.**
- **Authorization checks happen server-side.**
- **i18n keys compiled** (`bun run i18n:compile`) before finishing.
- **Route tree regenerated** as needed (`bunx @tanstack/router-generator` or `make dev`).
- **Database changes require migrations** (none expected here, but if you add one, generate and commit it).
- **Docker-first workflows:** use `make` targets, do not run tooling directly on the host unless documented.

### Scope discipline

- Do **not** implement real payout execution (objective #1).
- Do **not** implement Sendcloud shipping (objective #2).
- Do **not** complete the full shop settings form (banner, policies, socials, announcement, business address) unless required to make navigation honest.
- Do **not** refactor unrelated authz, styling, or route architecture.
- Do **not** redesign `/studio/` index route or consolidate `/studio` vs `/creator` surfaces unless explicitly required.

---

## 4. Execution checklist

Work through the plan phases in order:

- [ ] Phase 0 — Preparation: verify route tree, confirm no external callers of the APIs, inspect i18n conventions.
- [ ] Phase 1 — Quick navigation fixes (payment link, product edit link, settings link, thumbnails).
- [ ] Phase 2 — Studio hub + real per-shop metrics (new query, dashboard API, loader update, hub UI, i18n).
- [ ] Phase 3 — Real settings API.
- [ ] Phase 4 — Harden Mollie Connect callback.
- [ ] Phase 5 — Testing & validation.

---

## 5. Testing you must run

Run these explicitly and ensure they pass:

```bash
make lint
make format
make check
make test src/components/product/ProductTableRow.test.tsx
make test src/route-components/studio/\$shopId.test.tsx
make test src/lib/creator-dashboard.server.test.ts
make test src/routes/api/shops/\$shopId/dashboard.test.ts
make test src/routes/api/shops/\$shopId/settings.test.ts
make test src/routes/api/auth/mollie/callback.test.ts
make e2e e2e/owner-navigation.spec.ts
```

If a command does not exist exactly as written, use the closest documented `make` target or ask.

---

## 6. Definition of done for you

- [ ] All broken navigation paths are fixed and verified in browser/e2e.
- [ ] Thumbnails render correctly in owner and admin product lists.
- [ ] `/api/shops/$shopId/settings` GET/PATCH persist real data.
- [ ] `/api/shops/$shopId/dashboard` returns real per-shop metrics.
- [ ] `/studio/$shopId` shows navigation cards and real metrics.
- [ ] Mollie callback returns 502 when Connect credentials are missing.
- [ ] i18n keys added, compiled, and verified at runtime.
- [ ] New and updated tests pass.
- [ ] `make lint`, `make format`, `make check` pass with no errors or warnings.
- [ ] `.env.example` updated if new env vars are introduced.
- [ ] `docs/AUDIT_STORE_OWNER_2026-06-12.md` updated to reflect fixed items.
- [ ] **All changes staged and stashed. No commits made.**

---

## 7. How to finish

When the work is complete and verified:

```bash
# Stage everything
git add -A

# Stash with a descriptive message
git stash push -m "WIP: reliable owner navigation fixes (objective #3)"
```

Then report back:

1. What was implemented.
2. What was not implemented and why.
3. Test results.
4. The stash message and a summary of changed files.
5. Any blockers or follow-up work needed.

---

## 8. Reminder

- **Do not run `git commit`, `git push`, `git rebase`, or any git mutation beyond `git add` and `git stash`.**
- **Do not treat mock integrations or placeholder endpoints as "good enough" for production.**
- If you find a conflict between this handoff and `AGENTS.md`, follow `AGENTS.md` and report the conflict.
