import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Keeps the review disclosure honest about how reviews are actually handled.
 *
 * CRD Article 6a(1)(c) obliges us to say whether and how we ensure reviews come
 * from real purchasers. UCPD Annex I point 23b makes the *unfounded* version of
 * that claim a blacklisted practice — banned outright, no balancing test. French
 * C. consom. L.111-7-2 adds the ordering criteria, the dates, the retention
 * period and the moderation process.
 *
 * All of it is prose describing code that lives elsewhere, so it can rot without
 * anything failing. **If this test fails, the fix is not to update the
 * expectation** — it is to change the disclosure in both locales to describe
 * what the code now does, and only then re-pin it here.
 *
 * A source scan rather than behavioural tests: the claims are about constants
 * and guard clauses, and what ships is the literal in the file.
 */

const REPO_ROOT = join(import.meta.dirname, '../..')

function readSource(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

function readMessages(locale: 'en' | 'nl'): Record<string, string> {
  return JSON.parse(readSource(`messages/${locale}.json`)) as Record<string, string>
}

const operations = readSource('src/lib/reviews/operations.server.ts')
const component = readSource('src/components/reviews/ReviewDisclosure.tsx')
const visibility = readSource('src/lib/reviews/visibility.server.ts')
const schema = readSource('src/db/schema.ts')
const messages = { en: readMessages('en'), nl: readMessages('nl') }
const LOCALES = ['en', 'nl'] as const

/** Every claim the component makes, so an unrendered one cannot go stale unseen. */
const DISCLOSED_MESSAGES = [
  'review_disclosure_title',
  'review_disclosure_verified_body',
  'review_disclosure_check_purchase',
  'review_disclosure_check_delivered',
  'review_disclosure_check_once',
  'review_disclosure_check_own',
  'review_disclosure_order',
  'review_disclosure_dates',
  'review_disclosure_moderation',
  'review_disclosure_retention',
  'review_disclosure_no_payment',
]

describe('review disclosure', () => {
  it('renders every claim, in both locales', () => {
    for (const key of DISCLOSED_MESSAGES) {
      expect(component).toContain(key)
      for (const locale of LOCALES) {
        expect(messages[locale][key]?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })

  it('states the waiting period the code actually enforces', () => {
    // The disclosure names "14 days". If the constant moves, the sentence lies.
    const match = operations.match(/const ELIGIBILITY_DAYS = (\d+)/)
    expect(match).not.toBeNull()
    const days = match?.[1]

    expect(messages.en.review_disclosure_check_delivered).toContain(`${days} days`)
    expect(messages.nl.review_disclosure_check_delivered).toContain(`${days} dagen`)
  })

  it('only claims a purchase check while the checks are in place', () => {
    // Claiming verified reviews without these is the Annex I 23b breach, so the
    // claim and the guards have to fall together.
    expect(operations).toContain('platformOrderRecord.userId !== buyerUserId')
    expect(operations).toContain("shopOrderRecord.status !== 'delivered'")
    expect(operations).toContain('shopRecord?.ownerId === buyerUserId')
    expect(schema).toContain('review_shop_order_product_unique')
  })

  it('describes the order reviews are actually returned in', () => {
    // The disclosure says newest first and nothing else. `orderBy` on the public
    // query has to agree.
    expect(operations).toContain('.orderBy(desc(review.createdAt))')
    expect(messages.en.review_disclosure_order.toLowerCase()).toContain('newest first')
  })

  it('only claims both dates while both are returned', () => {
    expect(operations).toContain('experiencedAt: shopOrder.deliveredAt')
  })

  it('describes moderation as it now works, not as it did', () => {
    // Two claims: reporting alone changes nothing, and the author is told. Both
    // were false before this phase, which is exactly why they are pinned.
    expect(operations).toContain("createNotification(reviewRecord.buyerUserId, 'review_moderated'")
    expect(messages.en.review_disclosure_moderation.toLowerCase()).toContain(
      'reporting alone changes nothing',
    )

    // A report must not write `moderationStatus`. Scoped to the report function
    // so the admin path's legitimate write does not trip it.
    const reportFn = operations.slice(
      operations.indexOf('export async function reportReviewQuery'),
      operations.indexOf('export async function getReviewReportsQuery'),
    )
    expect(reportFn.length).toBeGreaterThan(0)
    expect(reportFn).not.toContain('moderationStatus')
  })

  it('claims no paid or rewarded reviews only while none exist', () => {
    const incentive = /\b(reviewReward|reviewIncentive|sponsoredReview|paidReview)\b/i
    expect(incentive.test(schema)).toBe(false)
    for (const locale of LOCALES) {
      expect(messages[locale].review_disclosure_no_payment.length).toBeGreaterThan(0)
    }
  })

  it('does not promise a retention period no job enforces', () => {
    // The stated rule is "kept while the product is listed", which is what the
    // cascading foreign keys already do. A time-based promise would need a purge
    // job, so this fails if the text starts naming a duration.
    expect(schema).toContain(".references(() => product.id, { onDelete: 'cascade' })")
    expect(messages.en.review_disclosure_retention).not.toMatch(/\b\d+\s+(years?|months?|days?)\b/i)
    expect(messages.nl.review_disclosure_retention).not.toMatch(
      /\b\d+\s+(jaar|jaren|maanden|dagen)\b/i,
    )
  })

  it('keeps the visibility rule the moderation claim depends on', () => {
    expect(visibility).toContain("eq(review.moderationStatus, 'approved')")
  })
})
