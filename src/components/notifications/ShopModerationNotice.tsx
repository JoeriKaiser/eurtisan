import { CheckCircle2, ScrollText } from 'lucide-react'
import type { NotificationItem } from '#/lib/notifications.server'
import { readShopModerationNotice } from '#/lib/shops/moderation-notice'
import { m } from '#/paraglide/messages'

/**
 * The DSA Article 17(3) statement of reasons for a shop suspension, and the
 * success note when a suspension is lifted, as the seller reads them in their
 * notifications.
 *
 * Article 17 requires the statement be *provided* to the affected person, so it
 * renders from the payload the moderation decision already carries instead of
 * sending the seller hunting through their seller hub. Field resolution is
 * shared with the email template via `readShopModerationNotice`, so both
 * surfaces present the same elements.
 *
 * Rendered as a sibling **beside** the row button rather than inside it — same
 * constraint as `StatementOfReasons`: the redress element is a link, and a link
 * inside a button is invalid and unreachable by keyboard.
 */
export function ShopModerationNotice({ item }: { item: NotificationItem }) {
  const notice = readShopModerationNotice(item.data as Record<string, unknown>)
  if (!notice) return null

  if (notice.kind === 'reinstatement') {
    // Also matches a first-time activation: both events say the shop is live,
    // and both are good news worth stating plainly.
    return (
      <div
        role='status'
        className='mt-2 flex items-start gap-2 rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success'
      >
        <CheckCircle2 size={16} className='mt-0.5 shrink-0' aria-hidden='true' />
        <span>{m.sor_notification_active_body()}</span>
      </div>
    )
  }

  const { sor } = notice
  const data = item.data as Record<string, unknown>
  const rawTargetPath = typeof data.targetPath === 'string' ? data.targetPath : ''
  const statusHref =
    rawTargetPath.startsWith('/') && !rawTargetPath.startsWith('//')
      ? rawTargetPath
      : typeof data.shopId === 'string' && data.shopId
        ? `/sell/status/${data.shopId}`
        : ''
  const measure =
    sor.measureKey === 'shop_suspended_listings_delisted'
      ? m.sor_notification_measure_suspended_delisted()
      : ''

  return (
    <details className='mt-2 rounded-xl border border-border-default bg-surface-default'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20 [&::-webkit-details-marker]:hidden'>
        <ScrollText size={15} aria-hidden='true' />
        {m.sor_notification_summary()}
      </summary>

      <div className='border-t border-border-default px-4 py-4 text-sm leading-relaxed text-text-secondary'>
        <dl className='space-y-3'>
          {measure && (
            <div>
              <dt className='font-medium text-text-primary'>
                {m.statement_of_reasons_what_label()}
              </dt>
              <dd className='m-0'>{measure}</dd>
            </div>
          )}

          {sor.grounds && (
            <div>
              <dt className='font-medium text-text-primary'>
                {m.statement_of_reasons_why_label()}
              </dt>
              {/* The moderator's words, verbatim — this is 17(3)(b), and
                  paraphrasing it here would defeat the point. */}
              <dd className='m-0 whitespace-pre-wrap'>{sor.grounds}</dd>
            </div>
          )}

          <div>
            <dt className='font-medium text-text-primary'>
              {m.statement_of_reasons_automated_label()}
            </dt>
            <dd className='m-0'>
              {sor.automatedMeans
                ? m.statement_of_reasons_automated_yes()
                : m.statement_of_reasons_automated_no()}
            </dd>
          </div>

          {(sor.supportEmail || sor.judicialRemedyAvailable) && (
            <div>
              <dt className='font-medium text-text-primary'>
                {m.statement_of_reasons_redress_label()}
              </dt>
              <dd className='m-0'>
                {/* A mailto rather than a route: there is no contact page, and
                    naming a redress route that does not exist is worse than
                    naming the address that does. */}
                {sor.supportEmail && (
                  <a
                    href={`mailto:${sor.supportEmail}?subject=${encodeURIComponent(
                      `Shop suspension appeal (${item.id})`,
                    )}`}
                    className='underline hover:text-text-primary'
                  >
                    {m.statement_of_reasons_redress_support({ email: sor.supportEmail })}
                  </a>
                )}
                {sor.judicialRemedyAvailable && (
                  <span className='mt-1 block'>{m.statement_of_reasons_redress_judicial()}</span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {statusHref && (
          <a
            href={statusHref}
            className='mt-4 inline-block font-medium text-accent-primary underline hover:text-text-primary'
          >
            {m.sor_notification_status_link()}
          </a>
        )}
      </div>
    </details>
  )
}
