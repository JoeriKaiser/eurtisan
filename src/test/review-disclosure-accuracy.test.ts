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
const queries = readSource('src/lib/reviews/queries.server.ts')
const lifecycle = readSource('src/lib/reviews/lifecycle.ts')
const component = readSource('src/components/reviews/ReviewDisclosure.tsx')
const visibility = readSource('src/lib/reviews/visibility.server.ts')
const reviewRpc = readSource('src/lib/reviews.ts')
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

/**
 * The phrases that carry each claim's legal weight, per locale. Non-empty alone
 * proves nothing — "checked sometimes" would pass a length check — so every
 * disclosed string must keep the words that make its claim true. Compared
 * lower-cased so capitalisation alone cannot mask a loss.
 */
const REQUIRED_PHRASES: Record<
  (typeof DISCLOSED_MESSAGES)[number],
  Record<(typeof LOCALES)[number], string[]>
> = {
  review_disclosure_title: {
    en: ['handle reviews'],
    nl: ['met beoordelingen omgaan'],
  },
  review_disclosure_verified_body: {
    en: ['comes from someone who bought the product here', 'we check this automatically'],
    nl: ['komt van iemand die het product hier heeft gekocht', 'controleren we automatisch'],
  },
  review_disclosure_check_purchase: {
    en: ["the reviewer's account placed the order"],
    nl: ['heeft de bestelling met dit product geplaatst'],
  },
  review_disclosure_check_delivered: {
    en: ['marked delivered'],
    nl: ['als bezorgd gemarkeerd'],
  },
  review_disclosure_check_once: {
    en: ['one review per product per order', 'cannot be reviewed twice'],
    nl: ['per product per bestelling', 'niet twee keer beoordeeld'],
  },
  review_disclosure_check_own: {
    en: ['own shop'],
    nl: ['eigen winkel'],
  },
  review_disclosure_order: {
    en: ['newest first'],
    nl: ['nieuw naar oud'],
  },
  review_disclosure_dates: {
    en: ['the date it was published', 'the date the buyer received the product'],
    nl: ['de datum van publicatie', 'de datum waarop de koper het product ontving'],
  },
  review_disclosure_moderation: {
    en: ['reporting alone changes nothing'],
    nl: ['melden alleen verandert niets'],
  },
  review_disclosure_retention: {
    en: ['as long as the product is listed'],
    nl: ['zolang het product te koop staat'],
  },
  review_disclosure_no_payment: {
    en: ['paid or rewarded'],
    nl: ['betaald of beloond'],
  },
}

describe('review disclosure', () => {
  it('renders every claim, with its legal substance, in both locales', () => {
    for (const key of DISCLOSED_MESSAGES) {
      expect(component).toContain(key)
      for (const locale of LOCALES) {
        const text = messages[locale][key]?.toLowerCase()
        expect(text, `${locale}:${key} must exist`).toBeTruthy()
        for (const phrase of REQUIRED_PHRASES[key][locale]) {
          expect(text).toContain(phrase)
        }
      }
    }
  })

  it('states the waiting period the code actually enforces', () => {
    // The disclosure names "14 days". If the constant moves, the sentence lies.
    const match = lifecycle.match(/const ELIGIBILITY_DAYS = (\d+)/)
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

  it('describes every order the public review query supports', () => {
    // The default and each selectable criterion must stay in lockstep with the
    // public RPC. This deliberately pins the complete set, not just recency.
    expect(reviewRpc).toContain("z.enum(['newest', 'highest', 'lowest', 'helpful'])")
    expect(queries).toContain("case 'newest':")
    expect(queries).toContain("case 'highest':")
    expect(queries).toContain("case 'lowest':")
    expect(queries).toContain("case 'helpful':")
    expect(queries).toContain('desc(review.createdAt), desc(review.id)')

    expect(messages.en.review_disclosure_order.toLowerCase()).toMatch(
      /newest first.*highest rating.*lowest rating.*helpful/,
    )
    expect(messages.nl.review_disclosure_order.toLowerCase()).toMatch(
      /nieuw naar oud.*hoogste beoordeling.*laagste beoordeling.*nuttige stemmen/,
    )
  })

  it('only claims both dates while both are returned', () => {
    expect(queries).toContain('experiencedAt: shopOrder.deliveredAt')
  })

  it('describes moderation as it now works, not as it did', () => {
    // Two claims: reporting alone changes nothing, and the author is told. Both
    // were false before this phase, which is exactly why they are pinned.
    expect(operations).toContain("createNotification(reviewRecord.buyerUserId, 'review_moderated'")
    expect(messages.en.review_disclosure_moderation.toLowerCase()).toContain(
      'reporting alone changes nothing',
    )
    expect(messages.en.review_disclosure_moderation.toLowerCase()).toContain('always told')
    expect(messages.nl.review_disclosure_moderation.toLowerCase()).toContain(
      'melden alleen verandert niets',
    )
    expect(messages.nl.review_disclosure_moderation.toLowerCase()).toContain('hoort altijd')

    // A report must not write `moderationStatus`. Scoped to the report function
    // so the admin path's legitimate write does not trip it.
    const reportFn = operations.slice(
      operations.indexOf('export async function reportReviewQuery'),
      operations.indexOf('export async function updateReviewModerationStatusQuery'),
    )
    expect(reportFn.length).toBeGreaterThan(0)
    expect(reportFn).not.toContain('moderationStatus')
  })

  it('claims no paid or rewarded reviews only while none exist', () => {
    const incentive = /\b(reviewReward|reviewIncentive|sponsoredReview|paidReview)\b/i
    expect(incentive.test(schema)).toBe(false)
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
