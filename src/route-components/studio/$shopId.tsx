import { Link, useLoaderData, useParams } from '@tanstack/react-router'
import { Banknote, Package, Settings, Tags, Users } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { formatPriceEUR } from '#/lib/pricing'

interface MetricCardProps {
  label: string
  value: string | number
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className='island-shell rounded-xl p-4'>
      <p className='mb-1 text-sm text-text-secondary'>{label}</p>
      <p className='text-2xl font-semibold text-text-primary'>{value}</p>
    </div>
  )
}

export function ShopDashboard() {
  const { shopId } = useParams({ from: '/studio/$shopId' })
  const { stats } = useLoaderData({ from: '/studio/$shopId' })

  const NAV_ITEMS = [
    {
      icon: Package,
      title: m.studio_nav_orders(),
      description: m.studio_nav_orders_desc(),
      to: '/studio/$shopId/orders' as const,
      params: { shopId },
    },
    {
      icon: Users,
      title: m.studio_nav_customers(),
      description: m.studio_nav_customers_desc(),
      to: '/studio/$shopId/customers' as const,
      params: { shopId },
    },
    {
      icon: Tags,
      title: m.studio_nav_products(),
      description: m.studio_nav_products_desc(),
      to: '/creator/products' as const,
      search: { shopId },
    },
    {
      icon: Banknote,
      title: m.studio_nav_payouts(),
      description: m.studio_nav_payouts_desc(),
      to: '/creator/payouts' as const,
      search: { shopId },
    },
    {
      icon: Settings,
      title: m.studio_nav_settings(),
      description: m.studio_nav_settings_desc(),
      to: '/creator/shop' as const,
      search: { shopId },
    },
  ]

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
          {m.studio_dashboard_title()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.studio_dashboard_description()}</p>

        {/* Metrics */}
        <div className='mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard label={m.studio_metric_pending_orders()} value={stats.pendingOrdersCount} />
          <MetricCard label={m.studio_metric_low_stock()} value={stats.lowStockProductCount} />
          <MetricCard
            label={m.studio_metric_net_revenue_this_month()}
            value={formatPriceEUR(stats.netRevenueThisMonthCents)}
          />
          <MetricCard label={m.studio_metric_active_products()} value={stats.totalActiveProducts} />
        </div>

        {/* Navigation */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              params={item.params}
              search={item.search}
              className='island-shell flex flex-col gap-3 rounded-xl p-5 transition hover:bg-bg-inset'
            >
              <div className='flex size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800'>
                <item.icon size={20} aria-hidden='true' />
              </div>
              <div>
                <h2 className='text-base font-semibold text-text-primary'>{item.title}</h2>
                <p className='text-sm text-text-secondary'>{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
