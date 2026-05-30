import { Link } from '@tanstack/react-router'
import { AlertTriangle, Package, Settings, ShoppingBag, Store, TrendingUp } from 'lucide-react'
import type { CreatorActivity, CreatorDashboardStats, CreatorShop } from '#/lib/creator-dashboard'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'
import { StatCard } from './dashboard/StatCard'
import { QuickActionButton } from './dashboard/QuickActionButton'
import { ActivityItem } from './dashboard/ActivityItem'
import { CreatorDashboardLoading } from './CreatorDashboardLoading'
import { CreatorDashboardError } from './CreatorDashboardError'

export { CreatorDashboardLoading, CreatorDashboardError }

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
        <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
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
