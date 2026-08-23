import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the single predicate deciding whether a review counts publicly.
 *
 * Three call sites used to disagree about this. The product page and the shop
 * rating aggregate counted everything not `hidden`; search's `popularityScore`
 * counted `approved` only. The result was a review that raised the displayed
 * average while contributing nothing to ranking — and a storefront trust signal
 * that could contradict search on the same shop.
 *
 * They now share `PUBLIC_REVIEW_FILTER`. Nothing stops a fourth reader writing
 * its own `eq(review.moderationStatus, …)`, and the failure would again be
 * silent — the numbers just disagree. So this fails on any moderation predicate
 * written outside the file that owns it.
 */

/** `eq(review.moderationStatus, 'approved')`, `ne(review.moderationStatus, …)`. */
const INLINE_PREDICATE = /\b(eq|ne|inArray|notInArray)\(\s*review\.moderationStatus/g

/** The SQL equivalent, which the regex above would miss. */
const SQL_PREDICATE = /moderation_status\s*(=|!=|<>|IN|NOT IN)/gi

/**
 * Files allowed to name the column directly.
 *
 * `visibility.server.ts` defines the filter. `operations.server.ts` is the
 * moderation path itself — it reads and writes the column by definition.
 * `queries.server.ts` holds the public reads (through the shared filter) and
 * the admin queue, which filters by status because that is its whole purpose.
 * Anything else added here needs a reason.
 */
const ALLOWED = new Set([
  'src/lib/reviews/visibility.server.ts',
  'src/lib/reviews/operations.server.ts',
  'src/lib/reviews/queries.server.ts',
  'src/db/schema.ts',
  'src/db/seed.ts',
  'src/test/review-visibility.test.ts',
])

const REPO_ROOT = join(import.meta.dirname, '../..')

function sourceFiles(directory = join(REPO_ROOT, 'src')): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'paraglide') continue
      found.push(...sourceFiles(absolute))
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(absolute)
    }
  }
  return found
}

function scanFor(pattern: RegExp): string[] {
  const offenders: string[] = []
  for (const absolute of sourceFiles()) {
    const path = relative(REPO_ROOT, absolute)
    if (ALLOWED.has(path)) continue
    const contents = readFileSync(absolute, 'utf8')
    for (const match of contents.matchAll(pattern)) {
      const line = contents.slice(0, match.index).split('\n').length
      offenders.push(`${path}:${line} — ${match[0].trim()}`)
    }
  }
  return offenders
}

describe('review visibility', () => {
  it('is decided in one place, not re-derived per reader', () => {
    expect(scanFor(INLINE_PREDICATE)).toEqual([])
  })

  it('is not re-derived in raw SQL either', () => {
    expect(scanFor(SQL_PREDICATE)).toEqual([])
  })
})
