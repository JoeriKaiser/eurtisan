import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

interface HomeStatsStripProps {
  stats: {
    sellerCount: number
    productCount: number
    countryCount: number
  }
}

export function HomeStatsStrip({ stats }: HomeStatsStripProps) {
  const marketplaceStats = [
    {
      value: stats.sellerCount,
      label: m.home_stats_makers_unit(),
      unit: m.home_stats_makers_unit(),
      href: '/search',
    },
    {
      value: stats.productCount,
      label: m.home_stats_products_unit(),
      unit: m.home_stats_products_unit(),
      href: '/search',
    },
    {
      value: stats.countryCount,
      label: m.home_stats_eu_unit(),
      unit: m.home_stats_eu_unit(),
      href: '/search',
    },
  ]

  return (
    <section
      aria-label={m.home_stats_landmark()}
      className='border-b border-border-subtle bg-surface-default/40 py-6 sm:py-8 backdrop-blur-xs'
    >
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Mobile View */}
        <div className='grid grid-cols-3 gap-2 sm:hidden text-center divide-x divide-border-subtle'>
          {marketplaceStats.map((stat) => (
            <Link
              key={stat.unit}
              to={stat.href}
              className='group block px-2 first:pl-0 last:pr-0 no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
            >
              <span className='tabular-nums display-title text-2xl sm:text-3xl font-bold tracking-tight text-text-primary group-hover:text-accent-primary transition-colors'>
                {stat.value}
              </span>
              <span className='mt-1 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors'>
                {stat.unit}
              </span>
            </Link>
          ))}
        </div>

        {/* Desktop View */}
        <div className='hidden sm:grid sm:grid-cols-3 divide-x divide-border-subtle'>
          {marketplaceStats.map((stat) => (
            <div key={stat.unit} className='px-8 first:pl-0 last:pr-0'>
              <Link
                to={stat.href}
                className='group inline-flex items-baseline gap-3 no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
              >
                <span className='tabular-nums display-title text-2xl sm:text-3xl font-bold tracking-tight text-text-primary group-hover:text-accent-primary transition-colors'>
                  {stat.value}
                </span>
                <span className='text-xs font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors'>
                  {stat.label}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
