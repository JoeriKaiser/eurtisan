import { Package, Star } from 'lucide-react'
import type { CreatorActivity } from '#/lib/creator-dashboard'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { formatDateShort } from '#/lib/format-date'

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  if (diffSec < 60) return m.time_just_now()
  if (diffMin < 60) return m.time_minutes_ago({ count: String(diffMin) })
  if (diffHour < 24) return m.time_hours_ago({ count: String(diffHour) })
  if (diffDay < 30) return m.time_days_ago({ count: String(diffDay) })
  return formatDateShort(new Date(date))
}

interface ActivityItemProps {
  item: CreatorActivity
}

export function ActivityItem({ item }: ActivityItemProps) {
  if (item.kind === 'order') {
    return (
      <div className='flex items-start gap-3 rounded-xl border border-border-default bg-surface-default p-4 transition hover:border-border-strong hover:bg-bg-inset'>
        <div className='flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary'>
          <Package size={18} aria-hidden='true' />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium text-text-primary'>
            {m.creator_activity_order_text({
              buyerName: item.buyerName,
              total: formatPriceEUR(item.totalCents),
            })}
          </p>
          <p className='mt-0.5 text-xs text-text-muted'>
            {item.shopName} · {formatRelativeTime(item.createdAt)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex items-start gap-3 rounded-xl border border-border-default bg-surface-default p-4 transition hover:border-border-strong hover:bg-bg-inset'>
      <div className='flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500'>
        <Star size={18} aria-hidden='true' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium text-text-primary'>
          {m.creator_activity_review_text({
            buyerName: item.buyerName,
            productName: item.productName,
            rating: String(item.rating),
          })}
        </p>
        <p className='mt-0.5 text-xs text-text-muted'>
          {item.shopName} · {formatRelativeTime(item.createdAt)}
        </p>
        {item.comment && (
          <p className='mt-1 text-xs italic text-text-secondary'>"{item.comment}"</p>
        )}
      </div>
    </div>
  )
}
