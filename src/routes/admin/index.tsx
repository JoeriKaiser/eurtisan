import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Banknote, Gavel, ShoppingBag, Store, Users } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { getAdminDashboardStats, getRecentOrders, getRecentSignups } from '#/lib/admin-dashboard'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => guardRole('admin'),
  loader: async () => {
    const [stats, signups, orders] = await Promise.all([
      getAdminDashboardStats(),
      getRecentSignups(),
      getRecentOrders(),
    ])
    return { stats, signups, orders }
  },
  component: AdminDashboard,
  pendingComponent: AdminDashboardPending,
  errorComponent: AdminDashboardError,
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
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
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
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
  const { stats, signups, orders } = Route.useLoaderData()

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl space-y-8'>
        {/* Header */}
        <div>
          <h1 className='display-title text-3xl font-bold text-text-primary'>{m.admin_title()}</h1>
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

          {/* Navigation Links */}
          <div className='lg:col-span-1'>
            <Card variant='elevated'>
              <CardHeader>
                <CardTitle>{m.admin_nav_section()}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                <Link
                  to='/admin/disputes'
                  className='flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-bg-inset'
                >
                  <Gavel
                    size={18}
                    className='mt-0.5 shrink-0 text-text-secondary'
                    aria-hidden='true'
                  />
                  <div>
                    <p className='text-sm font-medium text-text-primary'>
                      {m.admin_nav_disputes()}
                    </p>
                    <p className='text-xs text-text-muted'>{m.admin_nav_disputes_desc()}</p>
                  </div>
                </Link>
                <Link
                  to='/admin/payouts'
                  className='flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-bg-inset'
                >
                  <Banknote
                    size={18}
                    className='mt-0.5 shrink-0 text-text-secondary'
                    aria-hidden='true'
                  />
                  <div>
                    <p className='text-sm font-medium text-text-primary'>{m.admin_nav_payouts()}</p>
                    <p className='text-xs text-text-muted'>{m.admin_nav_payouts_desc()}</p>
                  </div>
                </Link>
                <Link
                  to='/admin/shops'
                  className='flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-bg-inset'
                >
                  <Store
                    size={18}
                    className='mt-0.5 shrink-0 text-text-secondary'
                    aria-hidden='true'
                  />
                  <div>
                    <p className='text-sm font-medium text-text-primary'>{m.admin_nav_shops()}</p>
                    <p className='text-xs text-text-muted'>{m.admin_nav_shops_desc()}</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

function AdminDashboardPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl space-y-8'>
        {/* Header skeleton */}
        <div>
          <Skeleton className='mb-2 h-9 w-64' />
          <Skeleton className='h-5 w-48' />
        </div>

        {/* Stat card skeletons */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className='island-shell rounded-xl p-5'>
              <div className='flex items-start gap-4'>
                <Skeleton className='h-10 w-10 rounded-lg' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-8 w-16' />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent activity + nav skeletons */}
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
          {[1, 2, 3].map((n) => (
            <div key={n} className='island-shell rounded-xl p-5'>
              <Skeleton className='mb-4 h-6 w-32' />
              <div className='space-y-3'>
                {[1, 2, 3].map((m) => (
                  <Skeleton key={m} className='h-16 w-full' />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Error State                                 */
/* -------------------------------------------------------------------------- */

function AdminDashboardError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl text-center'>
        <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
        <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
          {m.admin_error_load()}
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
        {reset && (
          <Button variant='secondary' onClick={reset}>
            {m.admin_error_retry()}
          </Button>
        )}
      </div>
    </main>
  )
}
