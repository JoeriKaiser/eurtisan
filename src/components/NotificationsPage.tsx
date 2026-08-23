import { useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  Banknote,
  Bell,
  ChevronDown,
  Flag,
  Package,
  MessageSquare,
  PackageMinus,
  Star,
  Truck,
  ShieldAlert,
  Undo2,
  Store,
} from 'lucide-react'
import { useState } from 'react'
import { StatementOfReasons } from '#/components/notifications/StatementOfReasons'
import { ShopModerationNotice } from '#/components/notifications/ShopModerationNotice'
import { formatDateShort } from '#/lib/format-date'
import type { NotificationItem, NotificationType } from '#/lib/notifications.server'
import { useMarkAllNotificationsRead, useMarkNotificationsRead } from '#/lib/notifications-hooks'
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
  seller_reply_received: <MessageSquare size={18} aria-hidden='true' />,
  seller_reply_moderated: <ShieldAlert size={18} aria-hidden='true' />,
  seller_reply_report_resolved: <Flag size={18} aria-hidden='true' />,
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

function productDeepLink(data: Record<string, string | undefined>): string | null {
  const shopSlug = data.shopSlug
  const productSlug = data.productSlug ?? data.productId

  if (!shopSlug || !productSlug) return null

  return `/shops/${encodeURIComponent(shopSlug)}/products/${encodeURIComponent(productSlug)}`
}

function resolveDeepLink(item: NotificationItem): string | null {
  const data = item.data as Record<string, string | undefined>
  // Seller-reply links must always resolve from their stable product context;
  // never let an optional caller-supplied path bypass segment encoding.
  if (
    !item.type.startsWith('seller_reply_') &&
    data.targetPath?.startsWith('/') &&
    !data.targetPath.startsWith('//')
  ) {
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
    case 'seller_reply_received': {
      return productDeepLink(data)
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
    // Seller-reply payload data is always encoded as path segments; unlike the
    // legacy review links it never constructs a route from unescaped values.
    case 'seller_reply_moderated':
    case 'seller_reply_report_resolved': {
      return productDeepLink(data)
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
    case 'seller_reply_received':
      return m.notification_seller_reply_received({ productName: data.productName ?? '' })
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
        // A suspension is a legal decision, not a routine status flip: it gets
        // its own line, with the full statement rendered beside the row by
        // `ShopModerationNotice`.
        case 'suspended':
          return m.sor_notification_suspended_title({ shopName })
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
    case 'seller_reply_moderated':
      return data.restriction === 'hidden'
        ? m.notification_seller_reply_hidden()
        : data.restriction === 'flagged'
          ? m.notification_seller_reply_flagged()
          : m.notification_seller_reply_restored()
    case 'seller_reply_report_resolved':
      return data.outcome === 'upheld'
        ? m.notification_seller_reply_report_upheld()
        : m.notification_seller_reply_report_dismissed()
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
      : item.type === 'review_moderated' || item.type === 'seller_reply_moderated'
        ? data.explanation
        : // Any future type can opt in by setting `detail`, rather than by
          // adding a branch here.
          data.detail

  const trimmed = prose?.trim()
  return trimmed ? trimmed : null
}

export interface NotificationGroup {
  key: string
  type: NotificationType
  items: NotificationItem[]
  count: number
  unreadCount: number
  createdAt: Date
}

export interface NotificationsPageProps {
  groups: NotificationGroup[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  isNavigating: boolean
}

function groupPreview(group: NotificationGroup): string {
  if (group.items.length === 1 || group.count === 1) {
    return notificationPreview(group.items[0])
  }
  if (group.type === 'low_stock') {
    return m.notification_group_low_stock({ count: String(group.count) })
  }
  if (group.type === 'review_received') {
    return m.notification_group_review_received({ count: String(group.count) })
  }
  return notificationPreview(group.items[0])
}

export function NotificationsPage({
  groups,
  page,
  totalPages,
  onPageChange,
  isNavigating,
}: NotificationsPageProps) {
  const router = useRouter()
  const markRead = useMarkNotificationsRead()
  const markAllRead = useMarkAllNotificationsRead()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const effectiveGroups = groups
  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync()
    await router.invalidate()
  }

  const markItemsReadAndRefresh = async (notificationIds: string[]) => {
    await markRead.mutateAsync(notificationIds)
    await router.invalidate()
  }

  const handleSingleItemClick = (item: NotificationItem) => {
    if (!item.readAt) {
      void markItemsReadAndRefresh([item.id])
    }
    const link = resolveDeepLink(item)
    if (link) {
      void router.navigate({ to: link as never })
    }
  }

  const handleGroupToggle = (group: NotificationGroup) => {
    const isCurrentlyExpanded = Boolean(expandedGroups[group.key])
    const nextExpanded = !isCurrentlyExpanded

    setExpandedGroups((prev) => ({ ...prev, [group.key]: nextExpanded }))

    if (nextExpanded && group.unreadCount > 0) {
      const unreadIds = group.items.filter((item) => !item.readAt).map((item) => item.id)
      if (unreadIds.length > 0) {
        void markItemsReadAndRefresh(unreadIds)
      }
    }
  }

  const hasUnread = effectiveGroups.some((group) => group.unreadCount > 0)

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
          {effectiveGroups.length > 0 && hasUnread && (
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

        {effectiveGroups.length === 0 ? (
          <div className='py-12 text-center'>
            <Bell size={40} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>{m.notifications_empty()}</p>
          </div>
        ) : (
          <>
            <ul className='space-y-3' aria-label={m.notifications_title()}>
              {effectiveGroups.map((group) => {
                const isMultiItem = group.items.length > 1 || group.count > 1
                if (!isMultiItem) {
                  const item = group.items[0]
                  const isUnread = !item.readAt
                  const detail = notificationDetail(item)
                  const describedBy = [
                    detail ? `notif-detail-${item.id}` : null,
                    isUnread ? `notif-status-${item.id}` : null,
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <li key={group.key}>
                      <button
                        type='button'
                        onClick={() => handleSingleItemClick(item)}
                        aria-labelledby={`notif-preview-${item.id} notif-time-${item.id}`}
                        aria-describedby={describedBy || undefined}
                        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition no-underline ${
                          isUnread
                            ? 'border-border-strong bg-surface-default shadow-sm hover:bg-bg-inset hover:shadow-md'
                            : 'border-border-default bg-bg-inset hover:bg-surface-default'
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

                      {(item.type === 'review_moderated' ||
                        item.type === 'seller_reply_moderated') && (
                        <StatementOfReasons item={item} />
                      )}
                      {item.type === 'shop_moderation_update' && (
                        <ShopModerationNotice item={item} />
                      )}
                    </li>
                  )
                }

                // Multi-item group
                const isExpanded = Boolean(expandedGroups[group.key])
                const isGroupUnread = group.unreadCount > 0

                return (
                  <li
                    key={group.key}
                    className='rounded-xl border border-border-default bg-bg-inset p-1.5'
                  >
                    <button
                      type='button'
                      aria-expanded={isExpanded}
                      aria-controls={`group-items-${group.key}`}
                      onClick={() => handleGroupToggle(group)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                        isGroupUnread
                          ? 'border-border-strong bg-surface-default shadow-sm hover:bg-bg-inset'
                          : 'border-border-default bg-bg-inset hover:bg-surface-default'
                      }`}
                    >
                      <div
                        className={`flex size-9 flex-shrink-0 items-center justify-center rounded-full ${
                          isGroupUnread
                            ? 'bg-accent-primary/10 text-accent-primary'
                            : 'bg-surface-inset text-text-muted'
                        }`}
                      >
                        {TYPE_ICONS[group.type] ?? FALLBACK_ICON}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2'>
                          <p
                            className={`text-sm font-medium ${
                              isGroupUnread
                                ? 'text-text-primary font-semibold'
                                : 'text-text-secondary'
                            }`}
                          >
                            {groupPreview(group)}
                          </p>
                          {isGroupUnread && (
                            <span className='inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2 py-0.5 text-xs font-semibold text-accent-primary'>
                              <span
                                className='size-1.5 rounded-full bg-accent-primary'
                                aria-hidden='true'
                              />
                              {m.notifications_group_unread_badge({
                                count: String(group.unreadCount),
                              })}
                            </span>
                          )}
                        </div>
                        <p className='mt-0.5 text-xs text-text-muted'>
                          {formatRelativeTime(group.createdAt)}
                        </p>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`flex-shrink-0 text-text-muted transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden='true'
                      />
                    </button>

                    {isExpanded && (
                      <div
                        id={`group-items-${group.key}`}
                        className='mt-2 space-y-2 border-t border-border-default pt-2 px-2 pb-1'
                      >
                        <ul className='space-y-2' aria-label={groupPreview(group)}>
                          {group.items.map((item) => {
                            const isChildUnread = !item.readAt
                            const detail = notificationDetail(item)
                            return (
                              <li key={item.id}>
                                <button
                                  type='button'
                                  onClick={() => handleSingleItemClick(item)}
                                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                                    isChildUnread
                                      ? 'border-border-strong bg-surface-default'
                                      : 'border-border-default bg-surface-inset hover:bg-surface-default'
                                  }`}
                                >
                                  <div className='min-w-0 flex-1'>
                                    <p
                                      className={`text-sm font-medium ${
                                        isChildUnread ? 'text-text-primary' : 'text-text-secondary'
                                      }`}
                                    >
                                      {notificationPreview(item)}
                                    </p>
                                    {detail && (
                                      <p className='mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary'>
                                        {detail}
                                      </p>
                                    )}
                                    <p className='mt-1 text-xs text-text-muted'>
                                      {formatRelativeTime(item.createdAt)}
                                    </p>
                                  </div>
                                  {isChildUnread && (
                                    <span
                                      className='mt-1.5 size-2 flex-shrink-0 rounded-full bg-accent-primary'
                                      aria-hidden='true'
                                    />
                                  )}
                                </button>

                                {(item.type === 'review_moderated' ||
                                  item.type === 'seller_reply_moderated') && (
                                  <StatementOfReasons item={item} />
                                )}
                                {item.type === 'shop_moderation_update' && (
                                  <ShopModerationNotice item={item} />
                                )}
                              </li>
                            )
                          })}
                        </ul>
                        {group.count > group.items.length && (
                          <p className='px-1 pb-1 text-xs text-text-muted'>
                            {m.notifications_group_items_capped({
                              shown: String(group.items.length),
                              count: String(group.count),
                            })}
                          </p>
                        )}
                      </div>
                    )}
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
