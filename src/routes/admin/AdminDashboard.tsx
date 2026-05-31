import { getRouteApi, Link } from '@tanstack/react-router'
import { AlertTriangle, Gavel, ShoppingBag, Users } from 'lucide-react'
import { Suspense } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { TrendChart } from '#/components/admin/TrendChart'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { formatDateMediumTime } from '#/lib/format-date'

const route = getRouteApi('/admin/')

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function formatDate(date: Date | string): string {
  return formatDateMediumTime(new Date(date))
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

/* -------------------------------------------------------------------------- */
/*                              Chart Skeleton                                */
/* -------------------------------------------------------------------------- */

function ChartSkeleton() {
  return (
    <div className='flex h-64 items-center justify-center rounded-xl border border-border-default bg-surface-default'>
      <Skeleton className='h-48 w-full mx-4' />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Stat Card Component                           */
/* -------------------------------------------------------------------------- */

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  iconBgClass: string
  iconColorClass: string
}

export function StatCard({ icon, label, value, iconBgClass, iconColorClass }: StatCardProps) {
  return (
    <Card variant='elevated' className='flex items-start gap-4'>
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
      >
        <span className={iconColorClass}>{icon}</span>
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-sm text-text-secondary'>{label}</p>
        <p className='text-2xl font-bold text-text-primary tabular-nums'>{value}</p>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminDashboard() {
  const loaderData = route.useLoaderData()
  const { stats, signups, orders } = loaderData

  return (
    <div className='space-y-8'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_description()}</p>
      </div>

      {/* Stat Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard
          icon={<Users size={20} aria-hidden='true' />}
          label={m.admin_stats_total_users()}
          value={stats.totalUsers}
          iconBgClass='bg-accent-primary-subtle'
          iconColorClass='text-accent-primary'
        />
        <StatCard
          icon={<ShoppingBag size={20} aria-hidden='true' />}
          label={m.admin_stats_active_shops()}
          value={stats.activeShops}
          iconBgClass='bg-success-subtle'
          iconColorClass='text-success'
        />
        <StatCard
          icon={<AlertTriangle size={20} aria-hidden='true' />}
          label={m.admin_stats_open_disputes()}
          value={stats.openDisputes}
          iconBgClass='bg-warning-subtle'
          iconColorClass='text-warning'
        />
        <StatCard
          icon={<Gavel size={20} aria-hidden='true' />}
          label={m.admin_stats_pending_payouts()}
          value={stats.pendingPayouts}
          iconBgClass='bg-accent-secondary-subtle'
          iconColorClass='text-accent-secondary'
        />
      </div>

      {/* Trend Charts */}
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
        <Card variant='elevated'>
          <CardHeader>
            <CardTitle>{m.admin_trends_signups_title()}</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartSkeleton />}>
              <TrendChart
                data={loaderData.trends.signups}
                color='var(--ds-accent-primary)'
                fillColor='var(--ds-accent-primary)'
                ariaLabel={m.admin_trends_signups_title()}
              />
            </Suspense>
          </CardContent>
        </Card>
        <Card variant='elevated'>
          <CardHeader>
            <CardTitle>{m.admin_trends_revenue_title()}</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartSkeleton />}>
              <TrendChart
                data={loaderData.trends.revenue}
                color='var(--ds-success)'
                fillColor='var(--ds-success)'
                valueFormatter={(v) => formatPriceEUR(v)}
                ariaLabel={m.admin_trends_revenue_title()}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Navigation */}
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
        {/* Recent Signups */}
        <div className='lg:col-span-1'>
          <Card variant='elevated'>
            <CardHeader>
              <CardTitle>{m.admin_recent_signups_title()}</CardTitle>
            </CardHeader>
            <CardContent>
              {signups.length === 0 ? (
                <p className='py-8 text-center text-sm text-text-muted'>
                  {m.admin_recent_signups_empty()}
                </p>
              ) : (
                <ul className='space-y-3'>
                  {signups.map((signup, i) => (
                    <li key={signup.id}>
                      {i > 0 && <Separator className='mb-3' />}
                      <div>
                        <p className='text-sm font-medium text-text-primary'>{signup.name}</p>
                        <p className='text-xs text-text-muted'>{signup.email}</p>
                        <p className='mt-0.5 text-xs text-text-muted'>
                          {formatDate(signup.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <div className='lg:col-span-1'>
          <Card variant='elevated'>
            <CardHeader>
              <CardTitle>{m.admin_recent_orders_title()}</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className='py-8 text-center text-sm text-text-muted'>
                  {m.admin_recent_orders_empty()}
                </p>
              ) : (
                <ul className='space-y-3'>
                  {orders.map((order, i) => (
                    <li key={order.id}>
                      {i > 0 && <Separator className='mb-3' />}
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0 flex-1'>
                          <p className='font-mono text-sm text-text-primary'>
                            {order.id.slice(0, 8)}…
                          </p>
                          <p className='mt-0.5 text-xs text-text-muted'>
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className='flex shrink-0 flex-col items-end gap-1'>
                          <Badge variant={statusBadgeVariant(order.status)}>
                            {statusLabel(order.status)}
                          </Badge>
                          <span className='text-sm font-semibold text-text-primary tabular-nums'>
                            {formatPriceEUR(order.totalCents)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Audit Activity */}
        <div className='lg:col-span-1'>
          <Card variant='elevated'>
            <CardHeader className='flex flex-row items-center justify-between'>
              <CardTitle>{m.admin_recent_audit_title()}</CardTitle>
              <Link
                to='/admin/audit-log'
                className='text-xs font-medium text-accent-primary hover:text-accent-primary-hover'
              >
                {m.admin_recent_audit_view_all()}
              </Link>
            </CardHeader>
            <CardContent>
              {loaderData.auditEntries.length === 0 ? (
                <p className='py-8 text-center text-sm text-text-muted'>
                  {m.admin_recent_audit_empty()}
                </p>
              ) : (
                <ul className='space-y-3'>
                  {loaderData.auditEntries.map((entry, i) => (
                    <li key={entry.id}>
                      {i > 0 && <Separator className='mb-3' />}
                      <div>
                        <p className='text-sm font-medium text-text-primary'>
                          <span className='text-text-secondary'>{entry.actorName}</span>{' '}
                          {entry.action}
                        </p>
                        <p className='mt-0.5 text-xs text-text-muted'>
                          {entry.resourceType}
                          {entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ''}
                        </p>
                        <p className='mt-0.5 text-xs text-text-muted'>
                          {formatDate(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

export function AdminDashboardPending() {
  return (
    <div className='space-y-8'>
      <div>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='size-5' />
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className='island-shell rounded-xl p-5'>
            <div className='flex items-start gap-4'>
              <Skeleton className='size-10 rounded-lg' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='size-4' />
                <Skeleton className='size-8' />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
        {[1, 2].map((n) => (
          <div key={n} className='island-shell rounded-xl p-5'>
            <Skeleton className='mb-4 size-6' />
            <Skeleton className='h-48 w-full' />
          </div>
        ))}
      </div>
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
        {[1, 2, 3].map((n) => (
          <div key={n} className='island-shell rounded-xl p-5'>
            <Skeleton className='mb-4 size-6' />
            <div className='space-y-3'>
              {[1, 2, 3].map((m) => (
                <Skeleton key={m} className='h-16 w-full' />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Error State                                 */
/* -------------------------------------------------------------------------- */

export function AdminDashboardError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className='text-center py-12'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
        {m.admin_error_load()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      {reset && (
        <Button variant='secondary' onClick={reset}>
          {m.admin_error_retry()}
        </Button>
      )}
    </div>
  )
}
