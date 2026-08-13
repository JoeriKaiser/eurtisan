import { BadgeCheck } from 'lucide-react'
import { m } from '#/paraglide/messages'

/**
 * Discloses how reviews are collected, checked, ordered and kept.
 *
 * Two obligations meet here, and both are satisfied by stating what the code
 * already does rather than by changing it:
 *
 * **CRD Article 6a(1)(c)** obliges a trader giving access to consumer reviews to
 * state whether and how it ensures they come from consumers who actually bought
 * or used the product. **UCPD Annex I point 23b** makes it a *blacklisted*
 * practice — banned outright, with no balancing test — to imply reviews are from
 * real purchasers without taking reasonable and proportionate steps to check.
 * Eurtisan takes those steps and simply never said so.
 *
 * **C. consom. L.111-7-2** obliges anyone publishing consumer reviews to state,
 * near the reviews: whether they are checked and how, the publication date and
 * the date of the experience, the ordering criteria, whether payment was given,
 * the retention period, and how to report a doubt about authenticity.
 *
 * Every claim below is enforced against the implementation by
 * `src/test/review-disclosure-accuracy.test.ts`. A disclosure that has drifted
 * from the code is an inaccurate statement about reviews, which is the failure
 * these articles actually penalise.
 *
 * Rendered as a `<details>` so it is reachable by keyboard and screen reader
 * without JavaScript and does not push the reviews down the page when closed.
 */
export function ReviewDisclosure() {
  const checks = [
    m.review_disclosure_check_purchase(),
    m.review_disclosure_check_delivered(),
    m.review_disclosure_check_once(),
    m.review_disclosure_check_own(),
  ]

  return (
    <details className='group mt-4 rounded-xl border border-border-default bg-surface-default'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20 [&::-webkit-details-marker]:hidden'>
        <BadgeCheck size={15} aria-hidden='true' />
        {m.review_disclosure_title()}
      </summary>

      <div className='border-t border-border-default px-4 py-4 text-sm leading-relaxed text-text-secondary'>
        <p className='m-0'>{m.review_disclosure_verified_body()}</p>
        <ul className='mt-2 list-disc space-y-1 pl-5'>
          {checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>

        <p className='mt-3'>{m.review_disclosure_order()}</p>
        <p className='mt-3'>{m.review_disclosure_dates()}</p>
        <p className='mt-3'>{m.review_disclosure_moderation()}</p>
        <p className='mt-3'>{m.review_disclosure_retention()}</p>

        <p className='mt-3 font-medium text-text-primary'>{m.review_disclosure_no_payment()}</p>
      </div>
    </details>
  )
}
