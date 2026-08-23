import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Keeps the ranking disclosure honest about the ranking that actually runs.
 *
 * CRD Article 6a(1)(a) and French Code de la consommation **L.111-7** require
 * the main parameters determining ranking, and their relative importance, to be
 * disclosed. A disclosure that has drifted from the implementation is worse than
 * none: it is an inaccurate statement about ranking, which is the specific thing
 * those articles penalise (up to €75,000 for individuals, €375,000 for legal
 * entities). There is no micro or small enterprise exemption.
 *
 * Nothing else couples the two. `rankingRules` lives in a server-only module
 * configured against Meilisearch at deploy time, and the disclosure is eight
 * translated strings — a change to one cannot fail the other's tests. So this
 * pins the mapping explicitly: every ranking rule names the message that
 * discloses it, in precedence order, and each step keeps a distinctive phrase
 * proving it still describes its rule.
 *
 * **If this test fails, the fix is not to update the expectation.** It is to
 * change the disclosure text — in both locales — to describe the new ranking,
 * and only then re-pin the mapping here.
 *
 * A source scan rather than an import: `meilisearch.server.ts` constructs a
 * client at module scope, and this assertion is about the literal that ships.
 */

const REPO_ROOT = join(import.meta.dirname, '../..')

/**
 * Ranking rules in precedence order, each mapped to the message disclosing it.
 * The message numbering follows the rule order, which is why the component can
 * render them as a plain ordered list.
 */
const DISCLOSED_RANKING_RULES: {
  rule: string
  message: string
  /** Distinctive phrase each locale's step must keep — proof the step still describes this rule. */
  phrases: { en: string; nl: string }
}[] = [
  {
    rule: 'words',
    message: 'ranking_disclosure_search_1',
    phrases: { en: 'your search words', nl: 'je zoekwoorden' },
  },
  {
    rule: 'typo',
    message: 'ranking_disclosure_search_2',
    phrases: { en: 'typos', nl: 'typefouten' },
  },
  {
    rule: 'proximity',
    message: 'ranking_disclosure_search_3',
    phrases: { en: 'close your words', nl: 'bij elkaar' },
  },
  {
    rule: 'attribute',
    message: 'ranking_disclosure_search_4',
    phrases: { en: 'product name', nl: 'productnaam' },
  },
  {
    rule: 'sort',
    message: 'ranking_disclosure_search_5',
    phrases: { en: 'sort you chose', nl: 'sortering die je koos' },
  },
  {
    rule: 'exactness',
    message: 'ranking_disclosure_search_6',
    phrases: { en: 'exact rather than partial', nl: 'gedeeltelijk' },
  },
  {
    rule: 'inStockRank:desc',
    message: 'ranking_disclosure_search_7',
    phrases: { en: 'in stock', nl: 'voorraad' },
  },
  {
    rule: 'popularityScore:desc',
    message: 'ranking_disclosure_search_8',
    phrases: { en: 'review score', nl: 'beoordelingsscore' },
  },
]

/**
 * `searchableAttributes` order is itself a ranking parameter — it is what the
 * `attribute` rule weights by — so the disclosure names the four fields in
 * order. These are the phrases each locale uses for them.
 */
const DISCLOSED_ATTRIBUTES: { attribute: string; en: string; nl: string }[] = [
  { attribute: 'name', en: 'product name', nl: 'productnaam' },
  { attribute: 'shopName', en: 'shop name', nl: 'winkelnaam' },
  { attribute: 'categoryName', en: 'category', nl: 'categorie' },
  { attribute: 'description', en: 'description', nl: 'beschrijving' },
]

function readSource(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

/** Pulls a string-array literal out of the index settings by its key. */
function extractArrayLiteral(source: string, key: string): string[] {
  const match = source.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))
  if (!match) throw new Error(`Could not find "${key}" in meilisearch.server.ts`)
  return Array.from(match[1].matchAll(/'([^']+)'/g), (entry) => entry[1])
}

function readMessages(locale: 'en' | 'nl'): Record<string, string> {
  return JSON.parse(readSource(`messages/${locale}.json`)) as Record<string, string>
}

const meilisearchSource = readSource('src/lib/products/meilisearch.server.ts')
const componentSource = readSource('src/components/browse/RankingDisclosure.tsx')
const messages = { en: readMessages('en'), nl: readMessages('nl') }

describe('ranking disclosure', () => {
  it('describes the ranking rules that are actually configured, in order', () => {
    expect(extractArrayLiteral(meilisearchSource, 'rankingRules')).toEqual(
      DISCLOSED_RANKING_RULES.map((entry) => entry.rule),
    )
  })

  it('has a disclosed step for every ranking rule and no orphans', () => {
    // An orphaned step is as much a defect as a missing one: it tells a buyer
    // a parameter applies when it no longer does.
    for (const locale of ['en', 'nl'] as const) {
      const present = Object.keys(messages[locale]).filter((key) =>
        /^ranking_disclosure_search_\d+$/.test(key),
      )
      expect(present.sort()).toEqual(DISCLOSED_RANKING_RULES.map((e) => e.message).sort())
    }
  })

  it('renders every disclosed step', () => {
    // The component lists the steps by hand, so a ninth rule would otherwise be
    // translated, pinned here, and still never shown.
    const rendered = new Set(
      Array.from(componentSource.matchAll(/ranking_disclosure_search_\d+/g), (m) => m[0]),
    )
    expect([...rendered].sort()).toEqual(DISCLOSED_RANKING_RULES.map((e) => e.message).sort())
  })

  it('says what each rule actually does, in both locales', () => {
    // Key parity alone would let "step 7" silently stop describing stock status,
    // or "step 8" stop naming the review score. Each step must keep the phrase
    // that carries its rule's meaning.
    for (const entry of DISCLOSED_RANKING_RULES) {
      for (const locale of ['en', 'nl'] as const) {
        const text = messages[locale][entry.message]?.toLowerCase()
        expect(text, `${locale}:${entry.message} must exist`).toBeTruthy()
        expect(text).toContain(entry.phrases[locale])
      }
    }
  })

  it('names the searchable attributes in the order they are weighted', () => {
    expect(extractArrayLiteral(meilisearchSource, 'searchableAttributes')).toEqual(
      DISCLOSED_ATTRIBUTES.map((entry) => entry.attribute),
    )

    for (const locale of ['en', 'nl'] as const) {
      const text = messages[locale].ranking_disclosure_search_4.toLowerCase()
      const positions = DISCLOSED_ATTRIBUTES.map((entry) => text.indexOf(entry[locale]))

      expect(positions.some((position) => position === -1)).toBe(false)
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    }
  })

  it('states in both locales that ranking cannot be bought', () => {
    // Verified against the schema and lib: no sponsored, promoted, or boosted
    // placement mechanism exists. If one is ever added, this claim becomes false
    // and the disclosure must change before the feature ships.
    expect(messages.en.ranking_disclosure_no_payment.toLowerCase()).toContain(
      'cannot pay to rank higher',
    )
    expect(messages.en.ranking_disclosure_no_payment.toLowerCase()).toContain(
      'sponsored or promoted',
    )
    expect(messages.nl.ranking_disclosure_no_payment.toLowerCase()).toContain(
      'niet betalen voor een hogere positie',
    )
    expect(messages.nl.ranking_disclosure_no_payment.toLowerCase()).toContain(
      'gesponsord of gepromoot',
    )

    const paidPlacement = /\b(sponsored|promoted|boostAmount|isSponsored|isPromoted)\b/i
    expect(paidPlacement.test(readSource('src/db/schema.ts'))).toBe(false)
  })
})
