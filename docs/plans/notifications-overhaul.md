# Notifications overhaul

**Opened:** 2026-07-31
**Register entry:** #4 in [`feature-depth-backlog.md`](./feature-depth-backlog.md)
**Reference standard:** the search overhaul in `6fac0a6` (PR #15)
**Status:** approved 2026-07-31; §0–§4 and §6 built; depth phase built 2026-08-04 (§11)

> Untracked by convention, like the other plan docs — kept on disk as a working
> record, not committed.

---

## 0. A correction to the reviews phase — **fixed**

**The DSA Article 17 statement of reasons I shipped in entry #3 is recorded but
never shown to the author.** `NotificationsPage` renders only
`notificationPreview(item)` — for `review_moderated` that is "Your review was
hidden — see why" — and the `explanation`, `ground`, and `redress` fields sit
unread in `data`. Clicking through deep-links to the product page, which says
nothing about the decision.

There *is* a detail slot in the list item, but it is hardcoded:

```ts
const moderationDetail =
  item.type === 'shop_moderation_update' && data.note?.trim() ? data.note.trim() : null
```

So the obligation is half-met: the statement exists, is complete, and is
addressed to the right person, but a recipient cannot read it. Article 17(1)
requires it be *provided* to the affected recipient. I reported that phase as
delivering the statement of reasons; that was wrong, and this is the first thing
to fix.

It is filed here rather than as a hotfix because the fix is a notification
surface, not a review one — and because it is the same defect as §1 below, of
which it is simply the most consequential instance.

---

## 1. The list renders a fixed set of shapes, and silently degrades outside it — **fixed**

`notificationPreview` is a `switch` with `default: return ''`, and `TYPE_ICONS`
is a lookup with no fallback. A type outside the union renders as a **button with
no icon, no text, and only a timestamp** — clickable, focusable, and announced to
a screen reader as a bare relative time.

Nothing produces such a row today: `createNotification` validates against a Zod
enum. The exposure is that the enum lives only in code while the column is
`text`, so the guarantee holds for exactly as long as every write goes through
that one function and no type is ever renamed or retired. The read path then
writes the guarantee down as a fact:

```ts
type: row.type as NotificationType,   // operations.server.ts:197
```

That cast is the actual defect — an assertion the schema does not support.

**Proposed fix.** Promote `type` to a `pgEnum` with a backfill, matching how the
codebase treats every other closed set (`moderation_status`, `payout_status`,
`return_request_status`, and `review_report_reason` from last phase). The cast
then becomes true rather than hopeful. Add a rendering fallback anyway, because
a row written before a type was retired should degrade to something readable
rather than to a blank button.

---

## 2. Detail is per-type by accident, not by design — **fixed**

Two notification types carry a human-written explanation — `shop_moderation_update`
(`note`) and `review_moderated` (`explanation`) — and only the first is rendered,
by name. Every future type that carries prose will hit the same wall.

**Proposed fix.** A `detail` convention in the notification payload, rendered for
any type that sets it, replacing the hardcoded branch. `review_moderated`
additionally needs its ground and redress information shown, not just the
free text — Article 17(3) is a list of six elements, and prose alone is four of
them.

This is where §0 gets fixed properly rather than by adding a second special case.

---

## 3. Email coverage is arbitrary — **fixed**

Five of thirteen types enqueue an email; eight do not. The split does not track
urgency or the recipient's ability to notice:

| Emails today | In-app only |
|---|---|
| `order_placed`, `order_shipped`, `order_refunded` | `order_chargeback` |
| `dispute_opened`, `dispute_resolved` | `dac7_warning_limit` |
| `shop_moderation_update` | `payout_sent`, `low_stock`, `review_received` |
| | `review_moderated`, `review_report_resolved` |

A **chargeback** and a **DAC7 threshold warning** are the two most consequential
things that can land on a seller — one takes money back, the other creates a
reporting obligation — and both are in-app only, where they are seen whenever the
seller next opens the site. Meanwhile a shipping confirmation, which the buyer
already expects, emails.

**Proposed fix.** Decide email delivery per type explicitly, as a table in code
next to the enum, rather than by whichever call site happened to add it. This is
a product decision as much as a technical one; §7 lists what I would send.

**Not a legal requirement.** The Article 17 statement of reasons is satisfied by
in-app delivery once §2 makes it readable. Email is robustness.

---

## 4. Notifications are the only personal-data table with no retention rule — **fixed**

Every other one has a purge job and a row in
[`DATA_RETENTION.md`](../DATA_RETENTION.md): audit log, sessions, email outbox,
email send log, Brevo events, Sendcloud events, payout reconciliation logs,
search events, verifications, carts. `notification` appears in that document
**only** under account deletion, where its rows are removed.

For a live account, notifications accumulate for the life of the account, and
`data` carries order numbers, product names, shop names, buyer names, and now
moderation explanations.

**Firm verdict: the defect is the silence, not the duration.** Indefinite
retention of a user's own message history is defensible — it is their record, and
GDPR storage limitation is judged against the stated purpose. What is not
defensible is a retention policy that documents ten tables and omits the
eleventh. Either state it or bound it.

**Proposed fix.** A retention row for `notification`, plus a purge job for
**read** notifications older than a threshold — unread ones are undelivered
information and should never be silently dropped. That distinction is the part
worth getting right; the number is a decision for the owner.

---

## 5. What the backlog got slightly wrong

The register says delivery is "poll-based". It is not: `useUnreadNotificationCount`
has `staleTime: 30_000` and no `refetchInterval`, so the badge updates on mount
and on window focus, never while the tab sits open. That is *less* aggressive than
polling, and cheaper — but it means a seller watching the page never sees a new
order appear.

Worth stating precisely before anyone "fixes" the polling that is not there.

Grouping and digesting, the register's third point, I would **defer**. It is real
— twenty rows of `low_stock` is a wall — but it is a presentation improvement on
top of a surface with a compliance gap, a lying cast, and no retention rule. It
also interacts with §3: if bursts are digested, the digest is what should email.

---

## 6. Smaller findings — **resolved**

- `markNotificationReadQuery` returns **404 for a missing notification and 403
  for someone else's**, which distinguishes the two to a caller. The ids are
  UUIDv4 so nothing is enumerable; worth collapsing to 404 anyway, since the
  distinction serves no one.
- It also does select-then-update where a single conditional update would do.
  Harmless, but it is two round trips on the hottest write in this module.
- ~~The unread badge has no `aria-live`.~~ **Wrong — checked before changing it.**
  `Header.tsx` renders the count in an `<output>`, whose implicit role is
  `status`, which carries `aria-live="polite"`. Nothing to fix.

---

## 7. Proposed scope

**In:** §0/§2 (make the statement of reasons readable, generalise detail), §1
(`pgEnum` + backfill + rendering fallback), §3 (explicit per-type email table),
§4 (retention row + purge job for read notifications), §6 (the three small ones).

**Out, proposed for a follow-up:** grouping and digesting, per-type in-app
preferences. Per-type preferences are worth doing *after* §3, since the email
table is the thing a preference would toggle — building preferences first would
mean designing against a delivery model that is about to change.

**Open for the user:**

1. **Which types should email.** I would add `order_chargeback`, `dac7_warning_limit`,
   `payout_sent`, and `review_moderated`; leave `low_stock` and `review_received`
   in-app, since both are routine and frequent.
2. **Retention for read notifications.** I would suggest 12 months, deleting read
   rows only.

**Gates:** unit tests for the enum migration and backfill, the purge job, and the
403/404 change; component tests plus axe for the detail rendering and the
fallback; a test pinning the Article 17(3) elements to what is actually displayed,
in the manner of the two disclosure-accuracy tests; en/nl parity;
`make test-accessibility`.

---

## 8. What was built

### 8.0 / 8.2 The statement of reasons is now readable

`components/notifications/StatementOfReasons.tsx` renders all six Article 17(3)
elements from the payload the reviews phase already stored.

It is a `<details>` **beside** the notification button, not inside it. That is
not styling: the redress element is a link, and a link nested in a button is
invalid and unreachable by keyboard. The constraint dictated the structure.

The hardcoded `shop_moderation_update && data.note` branch became
`notificationDetail(item)`, which resolves prose for any type — the two existing
keys stay distinct because the things are distinct, but the mapping is now in one
documented place instead of inline in JSX for exactly one of them. A future type
can opt in by setting `detail`.

`src/components/notifications/StatementOfReasons.test.tsx` asserts each of the six
elements, that the explanation is shown verbatim, that a demotion reads
differently from a removal, and that a redress route which was **not** offered is
not named.

### 8.1 The type is a real enum

`notification_type` (migration `0080`), with a `DO` block that fails with a
readable message naming any value the enum does not cover — the bare
`ALTER ... USING` would fail with a cast error naming neither the value nor the
fix. Verified by inserting `legacy_bogus_type` and watching it refuse.

The two casts (`created.type as NotificationType`, `row.type as NotificationType`)
are **gone**, because the column finally supports the claim they were making.

Two things the enum caught immediately, both invisible while the column was
`text`:

- `disputes/operations.server.ts` inserts notifications directly inside the
  dispute transaction, bypassing `createNotification` and its Zod check entirely.
- The **test factory wrote `type: 'welcome'`** — a type the application enum never
  contained. Every fixture built through it carried a value that would have
  rendered as a row with no icon and no text.

Plus a rendering fallback, so a row written before a type is retired degrades to
a bell and a generic line rather than a blank button.

`src/test/notification-types.test.ts` fails if the database enum and the Zod enum
drift.

### 8.3 Delivery is a table

`lib/notifications/delivery.ts` maps every type to `in_app`, `auto_email`, or
`caller_email`. Exhaustive by `Record<NotificationType, …>`, so adding a type is a
compile error until someone decides how it reaches anyone.

`caller_email` names the file that sends, so the split between "sent here" and
"sent by the flow" is visible rather than rediscovered by grepping — that
invisibility is how it drifted. `createNotification` sends only `auto_email`
types, keyed `notification:<id>`, so a retried flow cannot double-send.

Now emailing: `order_chargeback`, `dac7_warning_limit`, `payout_sent` (one shared
`seller_alert` template — same shape, and three copies would drift), and
`review_moderated` (`statement_of_reasons`, mirroring the in-app copy).

### 8.4 Retention

`job:notification-cleanup`, wired into prod, staging, Ansible, and
`DATA_RETENTION.md`. Default 365 days.

**Read only.** The cutoff is measured on `readAt`, not `createdAt`: an unread
notification is undelivered information — a chargeback nobody saw, a statement of
reasons nobody opened — and age is not consent to forget it. A notification
created two years ago but read yesterday is one day into its retention.

### 8.6 Smaller findings

- `markNotificationReadQuery` is one conditional update instead of
  select-then-update, and returns **404 for both** a missing notification and
  someone else's. The old 403/404 split told a caller whether an id they do not
  own exists.
- The `aria-live` finding was **wrong**; see §6.

---

## 9. Gates

- **248 test files, 3,006 tests, all passing.** `tsc`, lint, format clean.
- en/nl parity **2258/2258, drift 0**.
- `make test-accessibility` passes.
- Verified live: a chargeback enqueues a `seller_alert`; `low_stock` enqueues
  nothing; a moderation decision enqueues `statement_of_reasons`; and the
  rendered email carries all six elements in readable prose.
- E2E not run — same call as the previous two phases.

---

## 10. Deferred

Grouping and digesting, and per-type in-app preferences, as proposed in §7 and
approved. Preferences should follow the delivery table rather than precede it —
they toggle exactly what it declares.


---

## 11. Depth phase — grouping, preferences, digest (2026-08-04)

The deferred follow-up from §7/§10, built in the order the register demanded:
preferences follow the delivery table.

- **Per-type in-app preferences.** `user_notification_preference` rows exist
  only for the three types the delivery table declares `inApp: 'optional'`
  (`low_stock`, `review_received`, `seller_reply_received`); required types are
  not representable as mutable, enforced in the server function and pinned by
  tests. Enabled by default; disabling marks existing unread rows read in the
  same transaction, and the list/unread queries filter disabled types in SQL.
  Settings renders them with the shared `Switch` primitive.
- **Grouping.** `createNotification` stamps `group_key = daily:<type>:<utc day>`
  for the two burst types; the list query pages groups, aggregates
  `count`/`unreadCount` in SQL, and caps returned `items` to the twenty most
  recent per group so a burst day cannot bloat the payload. Expanding a group
  bulk-reads it; a note names the cap and points at the digest.
- **Digest.** `job:notification-digest` (advisory-locked, wired into prod and
  staging Compose, the Ansible rollout, and Prometheus alerts) enqueues at most
  one `seller_updates` email per seller per completed UTC day, idempotent per
  user/day, skipped when the seller disabled `seller_updates` email.
- **A defect the depth introduced, fixed here.** The preference serialization
  lock (`FOR UPDATE` on the recipient's user row inside `createNotification`)
  deadlocked `resolveDisputeQuery`, which created notifications inside a
  transaction that already held `FOR KEY SHARE` on the same rows through its
  order/payout updates. Dispute notifications now run after the commit.

Gates: full unit (2,413 tests) and browser (687 tests) suites green via the
local podman Postgres; `tsc`, lint, format clean; en/nl parity holds. E2E not
run — same call as every prior phase, per the standing holiday-laptop note.