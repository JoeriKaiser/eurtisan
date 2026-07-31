import { useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  Banknote,
  Bell,
  Flag,
  Package,
  PackageMinus,
  Star,
  Truck,
  ShieldAlert,
  Undo2,
  Store,
} from 'lucide-react'
import { StatementOfReasons } from '#/components/notifications/StatementOfReasons'
import { formatDateShort } from '#/lib/format-date'
import type { NotificationItem, NotificationType } from '#/lib/notifications.server'
import { useMarkAllNotificationsRead, useMarkNotificationRead } from '#/lib/notifications-hooks'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'

/**
 * Shown for a type this build does not know — a row written before a type was
 * retired, or by a newer deploy during a rollout. Without it the icon slot
 * renders `undefined` and the row becomes a button with no icon and no text,
 * announced as a bare timestamp.
 */
const FALLBACK_ICON = <Bell size={18} aria-hidden='true' />

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  order_placed: <Package size={18} aria-hidden='true' />,
  order_shipped: <Truck size={18} aria-hidden='true' />,
  order_refunded: <Undo2 size={18} aria-hidden='true' />,
  review_received: <Star size={18} aria-hidden='true' />,
  dispute_opened: <AlertTriangle size={18} aria-hidden='true' />,
  dispute_resolved: <Bell size={18} aria-hidden='true' />,
  payout_sent: <Banknote size={18} aria-hidden='true' />,
  order_chargeback: <AlertTriangle size={18} aria-hidden='true' />,
  dac7_warning_limit: <AlertTriangle size={18} aria-hidden='true' />,
  low_stock: <PackageMinus size={18} aria-hidden='true' />,
  shop_moderation_update: <Store size={18} aria-hidden='true' />,
  review_moderated: <ShieldAlert size={18} aria-hidden='true' />,
  review_report_resolved: <Flag size={18} aria-hidden='true' />,
}

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

function resolveDeepLink(item: NotificationItem): string | null {
  const data = item.data as Record<string, string | undefined>
  if (data.targetPath?.startsWith('/') && !data.targetPath.startsWith('//')) {
    return data.targetPath
  }

  switch (item.type) {
    case 'order_placed':
    case 'order_shipped':
    case 'order_refunded':
    case 'order_chargeback': {
      const orderNumber = data.orderNumber ?? data.orderId ?? data.platformOrderId
      if (orderNumber) return `/orders/${orderNumber}`
      break
    }
    case 'review_received': {
      const productSlug = data.productSlug ?? data.productId
      if (productSlug) return `/shops/${data.shopSlug ?? 'unknown'}/products/${productSlug}`
      break
    }
    case 'dispute_opened':
    case 'dispute_resolved': {
      const disputeId = data.disputeId
      if (disputeId) return `/disputes/${disputeId}`
      const orderNumber = data.orderNumber ?? data.orderId ?? data.platformOrderId
      if (orderNumber) return `/account/orders/${orderNumber}`
      break
    }
    case 'payout_sent': {
      const shopId = data.shopId
      if (shopId) return `/studio/${shopId}`
      break
    }
    case 'dac7_warning_limit': {
      const shopId = data.shopId
      if (shopId) return `/studio/${shopId}/settings`
      break
    }
    case 'low_stock': {
      const productId = data.productId
      if (productId) return `/creator/products/${productId}/edit`
      break
    }
    case 'shop_moderation_update': {
      const shopId = data.shopId
      if (shopId) return `/sell/status/${shopId}`
      break
    }
    // Both review notifications deep-link to the review's product, which is
    // where the recipient can see the outcome for themselves.
    case 'review_moderated':
    case 'review_report_resolved': {
      const productSlug = data.productSlug ?? data.productId
      if (productSlug) return `/shops/${data.shopSlug ?? 'unknown'}/products/${productSlug}`
      break
    }
  }
  return null
}

function notificationPreview(item: NotificationItem): string {
  const data = item.data as Record<string, string | undefined>

  switch (item.type) {
    case 'order_placed':
      return m.notification_order_placed({
        orderNumber: data.orderNumber ?? data.orderId ?? data.platformOrderId ?? '',
      })
    case 'order_shipped':
      return m.notification_order_shipped({
        orderNumber: data.orderNumber ?? data.orderId ?? data.platformOrderId ?? '',
      })
    case 'order_refunded':
      return m.notification_order_refunded({
        orderNumber: data.orderNumber ?? data.orderId ?? data.platformOrderId ?? '',
      })
    case 'order_chargeback':
      return m.notification_order_chargeback({
        orderNumber: data.orderNumber ?? data.orderId ?? data.platformOrderId ?? '',
      })
    case 'review_received':
      return m.notification_review_received({ productName: data.productName ?? '' })
    case 'dispute_opened':
      return m.notification_dispute_opened({
        orderNumber: data.orderNumber ?? data.orderId ?? data.platformOrderId ?? '',
      })
    case 'dispute_resolved':
      return m.notification_dispute_resolved({
        orderNumber: data.orderNumber ?? data.orderId ?? data.platformOrderId ?? '',
      })
    case 'payout_sent':
      return m.notification_payout_sent({ amount: data.amount ?? '' })
    case 'dac7_warning_limit':
      return m.notification_dac7_warning({
        shopName: data.shopName ?? '',
        limitType: data.limitType ?? '',
      })
    case 'low_stock':
      return m.notification_low_stock({ productName: data.productName ?? '' })
    case 'shop_moderation_update': {
      const shopName = data.shopName ?? ''
      switch (data.status) {
        case 'changes_requested':
          return m.notification_shop_changes_requested({ shopName })
        case 'approved':
          return m.notification_shop_approved({ shopName })
        case 'active':
          return m.notification_shop_active({ shopName })
        case 'rejected':
          return m.notification_shop_rejected({ shopName })
        default:
          return m.notification_shop_moderation({
            shopName,
            status: data.statusLabel ?? data.status ?? '',
          })
      }
    }
    case 'review_moderated':
      // The preview names the decision so the row is recognisable in the list;
      // the full Article 17(3) statement is rendered beside it by
      // `StatementOfReasons`.
      return data.restriction === 'hidden'
        ? m.notification_review_hidden()
        : data.restriction === 'flagged'
          ? m.notification_review_flagged()
          : m.notification_review_restored()
    case 'review_report_resolved':
      return data.outcome === 'upheld'
        ? m.notification_review_report_upheld()
        : m.notification_review_report_dismissed()
    default:
      // Not silently empty: an unknown type still has to say something, or the
      // row is a button a screen reader announces as a relative time and
      // nothing else.
      return m.notification_generic()
  }
}

/**
 * The human-written prose a notification carries, if any.
 *
 * Two types carry an explanation someone typed, under different keys — the key
 * names differ because the things differ, and flattening them to one would lose
 * that. What was wrong before was not the two keys but that the mapping lived
 * inline in the JSX for exactly one of them, so the other rendered nothing.
 */
function notificationDetail(item: NotificationItem): string | null {
  const data = item.data as Record<string, string | undefined>

  const prose =
    item.type === 'shop_moderation_update'
      ? data.note
      : item.type === 'review_moderated'
        ? data.explanation
        : // Any future type can opt in by setting `detail`, rather than by
          // adding a branch here.
          data.detail

  const trimmed = prose?.trim()
  return trimmed ? trimmed : null
}

export interface NotificationsPageProps {
  notifications: NotificationItem[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  isNavigating: boolean
}

export function NotificationsPage({
  notifications,
  page,
  totalPages,
  onPageChange,
  isNavigating,
}: NotificationsPageProps) {
  const router = useRouter()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync()
    // Loader-backed route data is not subscribed to the notifications query key,
    // so reload the route loader to reflect the updated read state.
    await router.invalidate()
  }

  const handleItemClick = (item: NotificationItem) => {
    if (!item.readAt) {
      void markRead.mutateAsync(item.id)
    }
    const link = resolveDeepLink(item)
    if (link) {
      void router.navigate({ to: link as never })
    }
  }

  const hasUnread = notifications.some((item) => !item.readAt)

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    onPageChange(newPage)
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <h1 className='display-title text-3xl font-semibold text-text-primary'>
            {m.notifications_title()}
          </h1>
          {notifications.length > 0 && hasUnread && (
            <Button
              variant='secondary'
              size='sm'
              onClick={() => void handleMarkAllRead()}
              disabled={markAllRead.isPending}
            >
              {m.notifications_mark_all_read()}
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className='py-12 text-center'>
            <Bell size={40} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>{m.notifications_empty()}</p>
          </div>
        ) : (
          <>
            <ul className='space-y-3' aria-label={m.notifications_title()}>
              {notifications.map((item) => {
                const isUnread = !item.readAt
                const detail = notificationDetail(item)
                const describedBy = [
                  detail ? `notif-detail-${item.id}` : null,
                  isUnread ? `notif-status-${item.id}` : null,
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <li key={item.id}>
                    <button
                      type='button'
                      onClick={() => handleItemClick(item)}
                      aria-labelledby={`notif-preview-${item.id} notif-time-${item.id}`}
                      aria-describedby={describedBy || undefined}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition no-underline ${
                        isUnread
                          ? 'border-border-strong border-l-4 border-l-accent-primary bg-surface-default shadow-sm hover:bg-bg-inset hover:shadow-md'
                          : 'border-border-default border-l-4 border-l-transparent bg-bg-inset hover:bg-surface-default'
                      }`}
                    >
                      <div
                        className={`flex size-9 flex-shrink-0 items-center justify-center rounded-full ${
                          isUnread
                            ? 'bg-accent-primary/10 text-accent-primary'
                            : 'bg-surface-inset text-text-muted'
                        }`}
                      >
                        {TYPE_ICONS[item.type] ?? FALLBACK_ICON}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p
                          id={`notif-preview-${item.id}`}
                          className={`text-sm font-medium ${
                            isUnread ? 'text-text-primary' : 'text-text-secondary'
                          }`}
                        >
                          {notificationPreview(item)}
                        </p>
                        {detail && (
                          <p
                            id={`notif-detail-${item.id}`}
                            className='mt-1 line-clamp-2 text-sm leading-relaxed text-text-secondary'
                          >
                            {detail}
                          </p>
                        )}
                        <p id={`notif-time-${item.id}`} className='mt-1 text-xs text-text-muted'>
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                      {isUnread && (
                        <>
                          <span id={`notif-status-${item.id}`} className='sr-only'>
                            {m.notifications_status_unread()}
                          </span>
                          <span
                            className='mt-2 size-2 flex-shrink-0 rounded-full bg-accent-primary'
                            aria-hidden='true'
                          />
                        </>
                      )}
                    </button>

                    {/* Beside the button, never inside it: the statement carries
                        a redress link, and a link nested in a button is invalid
                        and unreachable by keyboard. */}
                    {item.type === 'review_moderated' && <StatementOfReasons item={item} />}
                  </li>
                )
              })}
            </ul>

            {totalPages > 1 && (
              <nav
                className='mt-6 flex items-center justify-between'
                aria-label={m.pagination_page_of({
                  page: String(page),
                  totalPages: String(totalPages),
                })}
              >
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || isNavigating}
                >
                  {m.pagination_previous()}
                </Button>
                <span className='text-sm text-text-secondary'>
                  {m.pagination_page_of({
                    page: String(page),
                    totalPages: String(totalPages),
                  })}
                </span>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || isNavigating}
                >
                  {m.pagination_next()}
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  )
}
