import { ScrollText } from 'lucide-react'
import type { NotificationItem } from '#/lib/notifications.server'
import { m } from '#/paraglide/messages'

/** Matches `OrderSuccessPage`; the platform has no contact route. */
const SUPPORT_EMAIL = 'support@eurtisan.eu'

/**
 * The DSA Article 17 statement of reasons, as the affected recipient reads it.
 *
 * Article 17(1) requires the statement be *provided* to the person whose content
 * was restricted — recording it is not providing it. The reviews phase stored
 * all six Article 17(3) elements on the notification and rendered only the
 * one-line preview, so the statement existed and could not be read. This is that
 * fix.
 *
 * Rendered as a `<details>` **beside** the notification button rather than
 * inside it: the redress element is a link, and a link inside a button is
 * invalid and unreachable by keyboard. That constraint is why this is a sibling
 * and not an expansion of the row.
 *
 * The six elements, in the order the article lists them:
 *
 * | Article | Element | Field |
 * |---|---|---|
 * | 17(3)(a) | restriction, territorial scope, duration | `restriction`, `territorialScope`, `duration` |
 * | 17(3)(b) | facts relied on, and whether a notice prompted it | `explanation`, `promptedByNotice` |
 * | 17(3)(c) | whether automated means were used | `automatedMeans` |
 * | 17(3)(d)/(e) | legal or contractual ground | `ground` |
 * | 17(3)(f) | redress available | `redress` |
 *
 * `src/test/statement-of-reasons.test.ts` fails if an element stops being
 * rendered.
 */
export function StatementOfReasons({ item }: { item: NotificationItem }) {
  const data = item.data as Record<string, unknown>

  const restriction = String(data.restriction ?? '')
  const explanation = typeof data.explanation === 'string' ? data.explanation : ''
  const ground = data.ground === 'illegal' ? 'illegal' : 'terms'
  const redress = Array.isArray(data.redress) ? data.redress.map(String) : []

  return (
    <details className='mt-2 rounded-xl border border-border-default bg-surface-default'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20 [&::-webkit-details-marker]:hidden'>
        <ScrollText size={15} aria-hidden='true' />
        {m.statement_of_reasons_title()}
      </summary>

      <div className='border-t border-border-default px-4 py-4 text-sm leading-relaxed text-text-secondary'>
        <dl className='space-y-3'>
          <div>
            <dt className='font-medium text-text-primary'>{m.statement_of_reasons_what_label()}</dt>
            <dd className='m-0'>
              {restriction === 'hidden'
                ? m.statement_of_reasons_what_hidden()
                : m.statement_of_reasons_what_restricted()}{' '}
              {m.statement_of_reasons_scope()}
            </dd>
          </div>

          <div>
            <dt className='font-medium text-text-primary'>{m.statement_of_reasons_why_label()}</dt>
            {/* The moderator's words, shown verbatim — this is 17(3)(b), and
                paraphrasing it here would defeat the point. */}
            <dd className='m-0 whitespace-pre-wrap'>{explanation}</dd>
            <dd className='m-0 mt-1'>
              {ground === 'illegal'
                ? m.statement_of_reasons_ground_illegal()
                : m.statement_of_reasons_ground_terms()}
            </dd>
            <dd className='m-0 mt-1'>
              {data.promptedByNotice === true
                ? m.statement_of_reasons_prompted_by_report()
                : m.statement_of_reasons_prompted_by_review()}
            </dd>
          </div>

          <div>
            <dt className='font-medium text-text-primary'>
              {m.statement_of_reasons_automated_label()}
            </dt>
            <dd className='m-0'>
              {data.automatedMeans === true
                ? m.statement_of_reasons_automated_yes()
                : m.statement_of_reasons_automated_no()}
            </dd>
          </div>

          <div>
            <dt className='font-medium text-text-primary'>
              {m.statement_of_reasons_redress_label()}
            </dt>
            <dd className='m-0'>
              {/* Only the routes that exist are named. Article 21 out-of-court
                  settlement is a Section 3 obligation we are exempt from, so
                  offering it would point at something that is not there. */}
              {/* A mailto rather than a route: there is no contact page, and
                  naming a redress route that does not exist is worse than
                  naming the address that does. */}
              {redress.includes('contact_support') && (
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Review moderation appeal (${item.id})`)}`}
                  className='underline hover:text-text-primary'
                >
                  {m.statement_of_reasons_redress_support({ email: SUPPORT_EMAIL })}
                </a>
              )}
              {redress.includes('judicial_remedy') && (
                <span className='mt-1 block'>{m.statement_of_reasons_redress_judicial()}</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </details>
  )
}
