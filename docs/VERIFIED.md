# Verified areas

Areas that have been deliberately examined and found sound, so work can skip
re-auditing them. This is the positive counterpart to
[`PRODUCTION_READINESS_AUDIT.md`](PRODUCTION_READINESS_AUDIT.md), which records
what is broken.

**This is not a list of "done" areas.** A verdict like "payments ✅" rots
silently: the code changes, the claim stays, and the doc starts steering people
away from something that is now broken. Every row therefore records *evidence*,
*what was not checked*, and the *commit it was verified at* — so each claim is
falsifiable and its staleness is detectable.

Check for drift with:

```
bun run docs:check-verified
```

It flags any row whose paths have changed since the commit it was verified at.
A flagged row is not necessarily wrong — it means the evidence needs re-reading
before you trust it.

## How to use

- **Before starting work in an area:** read the row. If it is flagged stale, or
  your work touches something in "Not checked", verify before relying on it.
- **After verifying an area:** add or update a row. Record the mechanism you
  relied on, not a grade.
- **When a row turns out to be wrong:** delete it and open an audit finding.
  A wrong row is worse than a missing one.

## Ledger

| Area | Paths | Evidence | Not checked | Verified at | Date |
|---|---|---|---|---|---|
| Product search | `src/lib/search/`, `src/lib/products/meilisearch.server.ts`, `src/components/search/` | Rebuilt in #15: finite pagination with exact `totalHits`, filter escaping via `escapeFilterValue`, stale-hit purge, batched sync queue with per-item fallback, atomic reindex swap. Index settings and synonym behaviour exercised live against Meilisearch 1.43.0. | Load/latency at catalogue scale; relevance quality against real traffic (no data yet) | `6fac0a6` | 2026-07-25 |
| Inventory oversell safety | `src/lib/jobs/inventory.server.ts` | Reservation path locks the product row with `SELECT … FOR UPDATE` inside a transaction, then computes availability as `stockCount − sum(active reservations)` before inserting. Correct against concurrent checkout. | Behaviour under reservation-table growth; expiry job timing | `6fac0a6` | 2026-07-25 |
| Returns eligibility rules | `src/lib/returns/rules.ts` | EU 14-day withdrawal window implemented as `WITHDRAWAL_WINDOW_DAYS`, separate defect window, typed exclusion codes per return policy. `rules.test.ts` covers the boundaries. | Refund *amount* calculation; shipping-cost attribution | `6fac0a6` | 2026-07-25 |
| Product image storage lifecycle | `src/lib/images/storage.server.ts`, `src/lib/products/creator.server.ts` | `deleteImageFromStorage` is wired into update, single delete, and bulk delete, so objects are removed with their rows. | Deletes are best-effort and only logged on failure — **a failed delete orphans the object and there is no reaper** | `6fac0a6` | 2026-07-25 |
| Shop moderation authorization | `src/lib/shop-moderation.ts`, `src/lib/shops/moderation.server.ts` | `moderateShop` is admin-only, gated by `requirePrivileged2FA`, and emits an audit event alongside the state change. Idempotent. | **Does not propagate to the search index** — see Known gaps below | `6fac0a6` | 2026-07-25 |
| Alerting wiring | `infra/observability/prometheus/rules/`, `infra/observability/alertmanager.yml` | 25 alert rules across 12 files, Alertmanager routing present, runbook per alert family. Money, backup, job-staleness, and webhook failures all have rules. | Whether thresholds are *correct*; no alert on buyer-facing order volume flatlining | `6fac0a6` | 2026-07-25 |

## Known gaps found while verifying

Recorded here so this document is never read as blanket approval. These belong
in the audit if they are not already tracked there.

- **Suspending a shop does not remove its listings from the search index.**
  `moderateShopQuery` updates `shop.isSuspended`; nothing enqueues a deindex, and
  `removeShopProductsFromMeilisearch` still has zero callers. Cart and checkout
  guard at read time, so the exposure is search only. The stale-hit purge added
  in #15 masks it lazily — listings disappear once someone searches for them.
- **The search E2E specs have never been executed** against a running app. They
  collect correctly and the DOM contract they rely on is covered by component
  tests, but the specs themselves are unproven.
- **`docs/plans/production-readiness/README.md` links 13 phase plans that do not
  exist** in the repository.
- **The audit has no resolution status.** It is dated 2026-06-21 and reports 23
  P0 findings; several PRs have merged since, and there is currently no way to
  tell which findings are still open. Reconciling it is the highest-value
  documentation work outstanding.
