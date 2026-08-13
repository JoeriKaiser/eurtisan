import { Info } from 'lucide-react'
import { m } from '#/paraglide/messages'

export interface RankingDisclosureProps {
  /**
   * `search` describes text-relevance ranking; `category` describes a plain
   * sorted list. They differ because the surfaces genuinely rank differently —
   * one disclosure covering both would have to be vague enough to be useless.
   */
  variant: 'search' | 'category'
}

/**
 * Discloses the main parameters determining how listings are ordered.
 *
 * Required by CRD Article 6a(1)(a) (Omnibus) and French Code de la consommation
 * **L.111-7**, which carries penalties up to €75,000 for individuals and
 * €375,000 for legal entities. Unlike DSA Article 30 — which the shop-storefront
 * work established does not apply to a micro-enterprise operator — **there is no
 * micro or small enterprise exemption here.**
 *
 * The wording is deliberately in plain language rather than naming the ranking
 * rules verbatim: the obligation is that a consumer can understand the main
 * parameters and their relative importance, not that the implementation is
 * reproduced. The order below mirrors `rankingRules` in
 * `src/lib/products/meilisearch.server.ts` exactly — **if that array changes,
 * this text must change with it.** `src/test/ranking-disclosure-accuracy.test.ts`
 * enforces that; a drifted disclosure is an inaccurate ranking statement, which
 * is precisely what L.111-7 penalises.
 *
 * Rendered as a `<details>` so it is reachable by keyboard and screen reader
 * without JavaScript, and does not push the results down the page when closed.
 */
export function RankingDisclosure({ variant }: RankingDisclosureProps) {
  const searchSteps = [
    m.ranking_disclosure_search_1(),
    m.ranking_disclosure_search_2(),
    m.ranking_disclosure_search_3(),
    m.ranking_disclosure_search_4(),
    m.ranking_disclosure_search_5(),
    m.ranking_disclosure_search_6(),
    m.ranking_disclosure_search_7(),
    m.ranking_disclosure_search_8(),
  ]

  return (
    <details className='group mt-4 rounded-xl border border-border-default bg-surface-default'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20 [&::-webkit-details-marker]:hidden'>
        <Info size={15} aria-hidden='true' />
        {m.ranking_disclosure_title()}
      </summary>

      <div className='border-t border-border-default px-4 py-4 text-sm leading-relaxed text-text-secondary'>
        {variant === 'category' ? (
          <p className='m-0'>{m.ranking_disclosure_category_body()}</p>
        ) : (
          <>
            <p className='m-0'>{m.ranking_disclosure_search_body()}</p>
            <ol className='mt-2 list-decimal space-y-1 pl-5'>
              {searchSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className='mt-3'>{m.ranking_disclosure_search_note()}</p>
          </>
        )}

        {/* Stated on every surface, not just search: "no seller pays for
            position" is the claim a buyer most needs, and burying it under one
            surface would leave the other implying the opposite by silence. */}
        <p className='mt-3 font-medium text-text-primary'>{m.ranking_disclosure_no_payment()}</p>
      </div>
    </details>
  )
}
