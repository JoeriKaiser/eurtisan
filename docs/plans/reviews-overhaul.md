# Reviews overhaul

**Opened:** 2026-07-31
**Register entry:** #3 in [`feature-depth-backlog.md`](./feature-depth-backlog.md)
**Reference standard:** the search overhaul in `6fac0a6` (PR #15)
**Status:** approved 2026-07-31; §1–§6 built

> Untracked by convention, like the other plan docs — kept on disk as a working
> record, not committed.

---

## Summary

The backlog framed this as a depth gap: no seller reply, no helpfulness vote, no
sort by rating. Reading the code found something more urgent underneath, so the
proposed scope is different from the backlog's rough shape and the reasoning is
below rather than assumed.

**Two defects and three legal gaps, ranked by what I would fix first:**

| | Finding | Why first |
|---|---|---|
| 1 | A single report by any signed-in user silently changes search ranking | Manipulable in one click; makes the ranking disclosure shipped last phase inaccurate |
| 2 | Hiding a review notifies nobody | DSA Art. 17 applies to hosting providers with **no** micro-enterprise exemption |
| 3 | No review-verification disclosure | CRD 6a(1)(c); UCPD Annex I 23b makes the undisclosed claim a *banned* practice |
| 4 | No French review-modalities disclosure | C. consom. **L.111-7-2** |
| 5 | Two aggregation conventions disagree | Known and documented since the storefront phase; still unresolved |

The backlog's own list — seller replies, helpfulness voting, sort/filter by
rating — is real but is depth on top of a surface with a live integrity hole. I
recommend deferring all three to a follow-up and spending this phase on 1–5.

---

## 1. One report demotes a product's ranking — **fixed**

`reportReviewQuery` (`src/lib/reviews/operations.server.ts:346`):

```ts
if (reviewRecord.moderationStatus === 'approved') {
  await db.update(review).set({ moderationStatus: 'flagged' }).where(eq(review.id, reviewId))
  await enqueueSearchReindex(reviewRecord.productId)
}
```

Any authenticated user, one click, no threshold, no human in the loop. The rate
limit is 10 per 15 minutes per user — roughly 960 a day from one account, and
account creation is not the bottleneck.

The consequence is not what it looks like. `flagged` does **not** hide the review:
the product page and the shop aggregate both filter `ne(moderationStatus,
'hidden')`, so a flagged review still displays. But search counts **approved
only** (`meilisearch.server.ts:36`), so flagging removes the review from
`popularityScore`. So the effect of a report is invisible on the page and real in
the ranking.

That gives two exploits, both cheap:

- **Report your own one-star reviews.** They vanish from the Bayesian average
  while still being displayed, so the product's ranking rises and the page looks
  untouched.
- **Report a competitor's five-star reviews.** Their `popularityScore` falls.

It also makes the disclosure shipped in the category phase inaccurate. It tells
buyers ranking uses "the product's review score, weighted by how many reviews
back it up". It does not say a single anonymous report removes a review from that
score. Under L.111-7 an inaccurate ranking statement is the penalised failure, so
this is not merely a product bug.

**Proposed fix.** Reporting records a report and does not change moderation
state. A new `review_report` table (`reviewId`, `reporterUserId`, `reason`,
`createdAt`, unique on `(reviewId, reporterUserId)`) gives the audit trail that
does not exist today — admin currently sees `flagged` with no record of who
reported or why. `flagged` becomes a state only an admin sets. This also removes
the silent-ranking-change class entirely rather than tuning a threshold.

The unique index does the de-duplication that the current code fakes by checking
`=== 'approved'`.

---

## 2. Moderation notifies nobody — DSA Art. 17 — **fixed**

**Verified, because the storefront phase established a micro-enterprise exemption
for a different article and I did not want to carry that assumption across.**

DSA Art. 19 exempts micro and small enterprises from **Section 3 only** —
Articles 20 to 28, except 24(3). Articles 16, 17 and 18 are Section 2 and apply
to every hosting provider regardless of size. Hosting user-submitted reviews is a
hosting service.

**Art. 17(1)** — a provider must give a clear and specific statement of reasons to
the affected recipient for "any restrictions of the visibility of specific items
of information provided by the recipient of the service, including removal of
content, disabling access to content, or **demoting content**". Hiding a review is
squarely inside this.

**Art. 17(3)** requires six elements: the type and scope of the restriction; the
facts and circumstances relied on, including whether a notice prompted it;
whether automated means were used; the legal ground if illegal content; the
contractual ground if a terms breach; and the redress available.

Today `updateReviewModerationStatusQuery` writes the new status and returns. The
author is told nothing.

**Proposed fix.** The notification system already does in-app plus email through
the outbox — `createNotification` with a new `review_moderated` type, carrying the
six Art. 17(3) elements, called from the admin moderation path. An admin action
already requires a reason field in the UI or it cannot satisfy 17(3)(b), so the
admin screen gains a required reason.

**Art. 16** is the neighbouring obligation: a notice mechanism must confirm receipt
and later notify the decision with redress information. Once §1 makes reporting a
recorded notice rather than a state change, both fall out of the same table.

---

## 3. The verification is real but undisclosed — CRD 6a(1)(c) / UCPD Annex I — **fixed**

Eurtisan verifies reviews properly, and this is the cheapest gap to close because
the work is already done. `createReviewQuery` requires the reviewer to own the
platform order, the shop order to be `delivered`, the product to be in that order,
the reviewer not to own the shop, and one review per `(shopOrderId, productId)` —
enforced by a unique index, not just a check.

CRD Art. 6a(1)(c) obliges a trader providing access to consumer reviews to state
**whether and how** it ensures reviews come from consumers who actually bought or
used the product. UCPD Annex I point 23b makes it a *blacklisted* practice — banned
outright, no balancing test — to state or imply reviews are from real purchasers
without taking reasonable and proportionate steps to check. Eurtisan takes the
steps and says nothing, which is the reverse of the usual failure and is fixed by
a paragraph.

---

## 4. French review modalities — C. consom. L.111-7-2 — **fixed**

Applies to anyone collecting, moderating or publishing consumer reviews online.
The implementing articles (D111-16 ff.) require, near the reviews:

| Required | Today |
|---|---|
| Whether reviews are checked, and the main characteristics of the check | Absent |
| Date of publication **and date of the consumer's experience** | Publication date only |
| Criteria for ordering reviews | Absent — order is `createdAt desc`, undisclosed |
| Whether payment was given for reviews | Absent (none is) |
| Retention period | Absent — reviews are currently kept indefinitely |
| A free feature to report doubts about authenticity | **Present** (the flag button) |
| Reasons a review may be rejected | Absent |

The date-of-experience item needs data, not just copy: `shopOrder.deliveredAt`
already exists and is the natural "date of the experience". Everything else is a
disclosure component and a retention decision.

**Proposed fix.** A `ReviewDisclosure` component in the same shape as
`RankingDisclosure`, with the same enforced-accuracy treatment — the eligibility
constants (`ELIGIBILITY_DAYS`, delivered-only, one-per-order-item) are what the
text describes, so a test should pin them together. That pattern is now proven and
caught three mutations last phase.

---

## 5. Two aggregation conventions — decide, then enforce — **converged**

- Product page and shop aggregate: `ne(moderationStatus, 'hidden')` — counts flagged.
- Search `popularityScore`: `eq(moderationStatus, 'approved')` — excludes flagged.

Documented in `public-profile.server.ts:63-71` last phase and deliberately not
made worse; still unreconciled.

§1 changes the stakes: once `flagged` is only ever set by an admin, it means "an
admin looked at this and had doubts", and the defensible reading is that such a
review should not count towards *either* display or ranking. That collapses the
two conventions into one — `approved` only — rather than picking a winner.

**Firm recommendation: converge on `approved`.** The displayed average and the
ranking score then answer the same question, and the shop storefront's trust
signal stops disagreeing with search. One shared predicate, one comment saying
why, and a test that fails if a fourth call site invents a fifth convention.

---

## 6. Smaller findings, same file — **resolved**

- **Plural bug.** `ProductReviews.tsx:138` — `data.total === 1 ? m.reviews_count_single()
  : m.reviews_count(...)`. Exactly the ternary the category phase replaced; Dutch
  plural rules differ. One message-format plural replaces two keys.
- **Full names are published.** Reviews render `user.name` — the name from
  sign-up, not a chosen public identity. Buyers never opted into publishing it.
  Worth a decision (first name + initial is the common pattern); flagged here
  rather than silently changed, since it alters existing displayed content.
- **The 14-day wait.** `ELIGIBILITY_DAYS = 14` blocks reviewing until 14 days
  *after* delivery. That is a product decision, presumably aligned to the
  withdrawal window, but it suppresses review volume and needs disclosing under
  §4 ("deadline for publishing"). Not a defect — flagging it because the
  disclosure has to state it either way.

---

## 7. Proposed scope

**In:** §1 report/flag separation with the report table; §2 Art. 17 statement of
reasons plus Art. 16 acknowledgement; §3 verification disclosure; §4 L.111-7-2
disclosure including date of experience; §5 convergence on `approved`; §6 plural
fix.

**Out, proposed for a follow-up entry:** seller replies, helpfulness voting,
sort/filter by rating. All three are real depth; none is load-bearing while a
one-click ranking hole is open. Seller replies in particular are their own
moderation surface and would double this phase.

**Open for the user:** the display-name decision in §6, and the retention period
§4 requires us to state.

**Gates:** unit tests for the report path, the moderation notification, and the
converged aggregate; component tests plus axe for the disclosure; en/nl parity;
`make test-accessibility`; a matrix row if the review flow lacks one.

---

## 8. What was built

### 8.1 Reporting no longer moderates

`review_report` (migration `0079`) records `reviewId`, `reporterUserId`, a
required `reason`, optional `details`, and a `status` closing the Article 16(5)
loop. Unique on `(reviewId, reporterUserId)`, which is the de-duplication the old
code faked by checking the review was still `approved` — a check that stopped
counting reports the moment the first one landed.

`reportReviewQuery` writes a row and touches nothing else. Authors cannot report
their own reviews. A repeat notice returns `alreadyReported` rather than an
error: it is already on record, and telling the person otherwise invites a retry.

The report button became a dialog, because DSA Article 16(2) wants a
substantiated explanation and one click expresses none. Authenticity leads the
grounds — it is what L.111-7-2 obliges a free route for. `other` requires the
free-text field, since the label alone substantiates nothing.

**Legacy rows.** Pre-existing `flagged` reviews were set by strangers, not
moderators, and §5 makes `flagged` restrict visibility — so leaving them would
retroactively restrict content whose author never received a statement of
reasons. The migration returns them to `approved`, *except* those with a
`review.moderate` audit-log entry, which are real admin decisions. The audit
trail is what makes the two distinguishable at all.

### 8.2 Moderation states its reasons

`updateReviewModerationStatusQuery` now takes a `ModerationDecision` (ground,
explanation, actor) and sends `review_moderated` to the author carrying all six
Article 17(3) elements, plus `review_report_resolved` to each reporter. Open
reports are resolved `upheld` or `dismissed` in the same call, so a notice cannot
be left dangling after the thing it was about has been decided.

Two deliberate choices worth keeping:

- The explanation is **required at the type level**, so a decision cannot be
  applied without something to justify it. The admin dialog says the text goes to
  the author verbatim, since a moderator writing internal shorthand would
  otherwise be publishing it to the person they are moderating.
- Out-of-court dispute settlement (Article 21) is **not** offered in the redress
  list. It is a Section 3 obligation we are exempt from, and listing a route that
  does not exist would be worse than listing none.

Notification failures are logged rather than swallowed: a missing statement of
reasons is a compliance failure, not a cosmetic one.

### 8.3 and 8.4 The disclosure

`components/reviews/ReviewDisclosure.tsx`, rendered above the review list *and*
on the empty state — the verification claim is about how reviews get here, which
a buyer may want before there are any. It covers the CRD 6a(1)(c) verification
question and six of the seven L.111-7-2 items; the seventh, the reporting route,
already existed.

The date of the experience needed data, not copy: `getProductReviewsQuery` now
joins `shopOrder` for `deliveredAt` and the card shows both dates.

`src/test/review-disclosure-accuracy.test.ts` pins every claim to the code
behind it — the eligibility constant, the four purchase checks, the `orderBy`,
the presence of both dates, the absence of any moderation write in the report
path, and the absence of a time-based retention promise no job enforces.
Mutation-tested: changing `ELIGIBILITY_DAYS` to 7 and reintroducing the auto-flag
each failed exactly one test and no others.

### 8.5 One visibility rule

`PUBLIC_REVIEW_FILTER` in `reviews/visibility.server.ts`, shared by the product
page, the shop aggregate, and the search index. Converged on `approved`, which is
now defensible in a way it was not before: `flagged` means a human looked and had
doubts, and such a review should not prop up an average it is not trusted enough
to rank with.

`src/test/review-visibility.test.ts` fails on any moderation predicate written
outside the file that owns it, in Drizzle or raw SQL. Mutation-tested by
restoring the old `ne(…, 'hidden')` in the shop aggregate — caught, with the file
and line.

### 8.6 Smaller findings

- The `reviews_count` ternary is now a message-format plural.
- **Reviewer names are shortened server-side** to "Joeri K." (`formatReviewerName`),
  so the full sign-up name never reaches the browser at all. Buyers never opted
  into publishing it. Astral initials survive intact; an unusable name falls back
  to a localized label rather than a stray dot.
- **Retention decided:** kept while the product is listed, which is exactly what
  the cascading foreign keys already do. No purge job, no promise we do not keep,
  and no silent drift in old ratings.
- The 14-day wait is disclosed rather than changed.

### 8.7 A defect found on the way

`createReviewQuery`'s duplicate-review catch read `err.code` directly. Drizzle
wraps the driver error, so the property is on `cause` and **the check never
matched** — a genuine race would have surfaced as a 500 rather than a 409. The
pre-check above it hid this in tests. Both sites now use the repo's existing
`isPostgresUniqueViolation`, which unwraps.

---

## 9. Gates

- **244 test files, 2,986 tests, all passing.** `tsc`, lint, format clean.
- en/nl parity **2235/2235, drift 0**.
- `make test-accessibility` passes; a **Reviews row** was added to the assurance
  matrix.
- Verified end to end against seeded data: report recorded with the review
  untouched, decision applied, report resolved `upheld`, author and reporter both
  notified, the statement carrying all six elements, the hidden review dropping
  out of the public count, and the display name rendering as `Kerstin H.` with the
  experience date present.
- E2E **not run** — same call as the category phase.

---

## 10. Deferred

Seller replies, helpfulness voting, and sort/filter by rating, as proposed in §7
and approved. Seller replies are their own moderation surface: a reply is
user-generated content by a trader, so it inherits the Article 16/17 machinery
built here rather than reusing it for free.
