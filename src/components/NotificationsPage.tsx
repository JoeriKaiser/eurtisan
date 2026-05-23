import { useRouter } from '@tanstack/react-router'
import { AlertTriangle, Banknote, Bell, Package, Star, Truck } from 'lucide-react'
import type { NotificationItem, NotificationType } from '#/lib/notifications.server'
import { useMarkAllNotificationsRead, useMarkNotificationRead } from '#/lib/notifications-hooks'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  order_placed: <Package size={18} aria-hidden='true' />,
  order_shipped: <Truck size={18} aria-hidden='true' />,
  review_received: <Star size={18} aria-hidden='true' />,
  dispute_opened: <AlertTriangle size={18} aria-hidden='true' />,
  dispute_resolved: <Bell size={18} aria-hidden='true' />,
  payout_sent: <Banknote size={18} aria-hidden='true' />,
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
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

function resolveDeepLink(item: NotificationItem): string | null {
  const data = item.data as Record<string, string | undefined>

  switch (item.type) {
    case 'order_placed':
    case 'order_shipped': {
      const orderId = data.orderId ?? data.platformOrderId
      if (orderId) return `/orders/${orderId}`
      break
    }
    case 'review_received': {
      const productSlug = data.productSlug ?? data.productId
      if (productSlug) return `/products/${productSlug}`
      break
    }
    case 'dispute_opened': {
      const orderId = data.orderId ?? data.platformOrderId
      if (orderId) return `/account/orders/${orderId}`
      break
    }
    case 'payout_sent': {
      const shopId = data.shopId
      if (shopId) return `/studio/${shopId}`
      break
    }
  }
  return null
}

function notificationPreview(item: NotificationItem): string {
  const data = item.data as Record<string, string | undefined>

  switch (item.type) {
    case 'order_placed':
      return m.notification_order_placed({ orderId: data.orderId ?? data.platformOrderId ?? '' })
    case 'order_shipped':
      return m.notification_order_shipped({ orderId: data.orderId ?? data.platformOrderId ?? '' })
    case 'review_received':
      return m.notification_review_received({ productName: data.productName ?? '' })
    case 'dispute_opened':
      return m.notification_dispute_opened({ orderId: data.orderId ?? '' })
    case 'payout_sent':
      return m.notification_payout_sent({ amount: data.amount ?? '' })
    default:
      return ''
  }
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

  const handleItemClick = (item: NotificationItem) => {
    if (!item.readAt) {
      void markRead.mutateAsync(item.id)
    }
    const link = resolveDeepLink(item)
    if (link) {
      void router.navigate({ to: link as never })
    }
  }

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    onPageChange(newPage)
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <h1 className='display-title text-3xl font-bold text-text-primary'>
            {m.notifications_title()}
          </h1>
          {notifications.length > 0 && (
            <Button
              variant='secondary'
              size='sm'
              onClick={() => void markAllRead.mutate()}
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

                return (
                  <li key={item.id}>
                    <button
                      type='button'
                      onClick={() => handleItemClick(item)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition no-underline ${
                        isUnread
                          ? 'border-border-strong bg-surface-default hover:bg-bg-inset'
                          : 'border-border-default bg-bg-inset hover:bg-surface-default opacity-75'
                      }`}
                    >
                      <div
                        className={`flex size-9 flex-shrink-0 items-center justify-center rounded-full ${
                          isUnread
                            ? 'bg-accent-primary/10 text-accent-primary'
                            : 'bg-surface-inset text-text-muted'
                        }`}
                      >
                        {TYPE_ICONS[item.type]}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium text-text-primary'>
                          {notificationPreview(item)}
                        </p>
                        <p className='mt-0.5 text-xs text-text-muted'>
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                      {isUnread && (
                        <span
                          className='mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-accent-primary'
                          aria-hidden='true'
                        />
                      )}
                    </button>
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

export function NotificationsLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-6 h-8 w-48' />
        <div className='space-y-3' aria-hidden='true'>
          {
            <>
              <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
                <Skeleton className='size-9 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-24' />
                </div>
              </div>
              <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
                <Skeleton className='size-9 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-24' />
                </div>
              </div>
              <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
                <Skeleton className='size-9 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-24' />
                </div>
              </div>
              <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
                <Skeleton className='size-9 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-24' />
                </div>
              </div>
            </>
          }
        </div>
      </section>
    </main>
  )
}

export function NotificationsError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-bold text-text-primary'>
          {m.notifications_title()}
        </h1>
        <div className='py-12 text-center'>
          <p className='text-text-secondary'>{m.notifications_error()}</p>
          <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
        </div>
      </section>
    </main>
  )
}
