import { Link, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
} from 'lucide-react'
import type { CreatorActivity, CreatorDashboardStats, CreatorShop } from '#/lib/creator-dashboard'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'

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

function getFirstShop(shops: CreatorShop[]): CreatorShop | undefined {
  return shops[0]
}

export interface CreatorDashboardPageProps {
  stats: CreatorDashboardStats
  activity: CreatorActivity[]
  shops: CreatorShop[]
}

export function CreatorDashboardPage({ stats, activity, shops }: CreatorDashboardPageProps) {
  const firstShop = getFirstShop(shops)

  if (stats.totalShopCount === 0) {
    return (
      <main className='page-wrap px-4 py-12'>
        <section className='island-shell rounded-2xl p-6 sm:p-8'>
          <div className='py-12 text-center'>
            <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-xl font-semibold text-text-primary'>
              {m.creator_no_shops_title()}
            </h2>
            <p className='mx-auto max-w-md text-text-secondary'>
              {m.creator_no_shops_description()}
            </p>
            <div className='mt-6'>
              <Link to='/sell' className='no-underline'>
                <Button variant='primary'>{m.creator_no_shops_cta()}</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-2 text-3xl font-bold text-text-primary'>
          {m.creator_title()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.creator_description()}</p>

        {/* Stat Cards */}
        <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard
            title={m.creator_revenue_this_month()}
            value={formatPriceEUR(stats.revenueThisMonthCents)}
            icon={<TrendingUp size={20} aria-hidden='true' />}
            href={firstShop ? `/studio/${firstShop.id}/orders` : '/studio'}
          />
          <StatCard
            title={m.creator_pending_orders()}
            value={String(stats.pendingOrdersCount)}
            icon={<ShoppingBag size={20} aria-hidden='true' />}
            href={firstShop ? `/studio/${firstShop.id}/orders` : '/studio'}
          />
          <StatCard
            title={m.creator_low_stock_products()}
            value={String(stats.lowStockProductCount)}
            icon={<AlertTriangle size={20} aria-hidden='true' />}
            href={firstShop ? `/studio/${firstShop.id}` : '/studio'}
          />
          <StatCard
            title={m.creator_total_shops()}
            value={String(stats.totalShopCount)}
            icon={<Store size={20} aria-hidden='true' />}
            href='/studio'
          />
        </div>

        {/* Quick Actions */}
        <div className='mb-8'>
          <h2 className='mb-4 text-lg font-semibold text-text-primary'>
            {m.creator_quick_actions()}
          </h2>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            <QuickActionButton
              label={m.creator_quick_products()}
              icon={<Package size={18} aria-hidden='true' />}
              to={firstShop ? `/studio/${firstShop.id}` : '/studio'}
            />
            <QuickActionButton
              label={m.creator_quick_orders()}
              icon={<ShoppingBag size={18} aria-hidden='true' />}
              to={firstShop ? `/studio/${firstShop.id}/orders` : '/studio'}
            />
            <QuickActionButton
              label={m.creator_quick_settings()}
              icon={<Settings size={18} aria-hidden='true' />}
              to={firstShop ? `/studio/${firstShop.id}` : '/studio'}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className='mb-4 text-lg font-semibold text-text-primary'>
            {m.creator_recent_activity()}
          </h2>

          {activity.length === 0 ? (
            <div className='rounded-xl border border-border-default bg-surface-default p-8 text-center'>
              <Package size={32} className='mx-auto mb-3 text-text-muted' aria-hidden='true' />
              <p className='text-text-secondary'>{m.creator_activity_empty()}</p>
              <p className='mt-1 text-sm text-text-muted'>
                {m.creator_activity_empty_description()}
              </p>
            </div>
          ) : (
            <ul className='space-y-3' aria-label={m.creator_recent_activity()}>
              {activity.map((item) => (
                <li key={item.id}>
                  <ActivityItem item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string
  value: string
  icon: React.ReactNode
  href: string
}) {
  return (
    <Link to={href} className='no-underline'>
      <Card className='h-full transition hover:border-border-strong hover:bg-bg-inset'>
        <CardHeader className='pb-2'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-sm font-medium text-text-secondary'>{title}</CardTitle>
            <div className='flex size-6 items-center justify-center rounded-full bg-surface-inset text-text-muted'>
              {icon}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className='text-2xl font-bold text-text-primary'>{value}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function QuickActionButton({
  label,
  icon,
  to,
}: {
  label: string
  icon: React.ReactNode
  to: string
}) {
  return (
    <Link
      to={to}
      className='flex flex-col items-center gap-2 rounded-xl border border-border-default bg-surface-default p-4 text-center transition hover:border-border-strong hover:bg-bg-inset no-underline'
    >
      <div className='flex size-10 items-center justify-center rounded-full bg-surface-inset text-text-muted'>
        {icon}
      </div>
      <span className='text-sm font-medium text-text-primary'>{label}</span>
    </Link>
  )
}

function ActivityItem({ item }: { item: CreatorActivity }) {
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

export function CreatorDashboardLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 h-9 w-64' />
        <Skeleton className='mb-8 h-4 w-48' />

        {/* Stat skeletons */}
        <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-20' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-20' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-20' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-20' />
            </CardContent>
          </Card>
        </div>

        {/* Quick actions skeleton */}
        <Skeleton className='mb-4 h-6 w-32' />
        <div className='mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3'>
          <div className='flex flex-col items-center gap-2 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-10 rounded-full' />
            <Skeleton className='h-4 w-16' />
          </div>
          <div className='flex flex-col items-center gap-2 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-10 rounded-full' />
            <Skeleton className='h-4 w-16' />
          </div>
          <div className='flex flex-col items-center gap-2 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-10 rounded-full' />
            <Skeleton className='h-4 w-16' />
          </div>
        </div>

        {/* Activity skeleton */}
        <Skeleton className='mb-4 h-6 w-32' />
        <div className='space-y-3' aria-hidden='true'>
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
        </div>
      </section>
    </main>
  )
}

export function CreatorDashboardError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-bold text-text-primary'>
          {m.creator_title()}
        </h1>
        <div className='py-12 text-center'>
          <p className='text-text-secondary'>{m.creator_error_load()}</p>
          <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
          <div className='mt-6'>
            <Button variant='secondary' onClick={() => void router.invalidate()}>
              {m.creator_error_retry()}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
