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
    },
    {
      value: stats.productCount,
      label: m.home_stats_products_unit(),
      unit: m.home_stats_products_unit(),
    },
    {
      value: stats.countryCount,
      label: m.home_stats_eu_unit(),
      unit: m.home_stats_eu_unit(),
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
            <div key={stat.unit} className='px-2 first:pl-0 last:pr-0'>
              <span className='tabular-nums display-title text-2xl sm:text-3xl font-bold tracking-tight text-text-primary'>
                {stat.value}
              </span>
              <span className='mt-1 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary'>
                {stat.unit}
              </span>
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className='hidden sm:grid sm:grid-cols-3 divide-x divide-border-subtle'>
          {marketplaceStats.map((stat) => (
            <div key={stat.unit} className='px-8 first:pl-0 last:pr-0'>
              <div className='flex items-baseline gap-3'>
                <span className='tabular-nums display-title text-2xl sm:text-3xl font-bold tracking-tight text-text-primary'>
                  {stat.value}
                </span>
                <span className='text-xs font-semibold uppercase tracking-wider text-text-secondary'>
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
