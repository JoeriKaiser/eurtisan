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
      label: m.home_stats_makers({ count: stats.sellerCount.toString() }),
      unit: m.home_stats_makers_unit(),
    },
    {
      value: stats.productCount,
      label: m.home_stats_products({ count: stats.productCount.toString() }),
      unit: m.home_stats_products_unit(),
    },
    {
      value: stats.countryCount,
      label: m.home_stats_eu({ count: stats.countryCount.toString() }),
      unit: m.home_stats_eu_unit(),
    },
  ]

  return (
    <div className='relative z-20 md:mx-auto md:max-w-7xl md:px-6'>
      <section
        aria-label='Marketplace Statistics'
        className='animate-fade-in-up md:-mt-24 md:mb-16'
        style={{ animationDelay: '100ms' }}
      >
        <div className='grid grid-cols-3 gap-2 bg-accent-primary px-3 py-5 text-text-on-primary md:hidden'>
          {marketplaceStats.map((stat) => (
            <div key={stat.label} className='min-w-0 px-2 text-center'>
              <strong className='block text-2xl font-extrabold leading-none tabular-nums'>
                {stat.value}
              </strong>
              <span className='mt-2 block text-[9px] font-bold uppercase leading-tight tracking-wide opacity-90'>
                {stat.unit}
              </span>
            </div>
          ))}
        </div>

        <div className='hidden rounded-[2.5rem] border border-border-subtle bg-scrim-subtle p-2 shadow-xl md:block'>
          <div className='rounded-[calc(2.5rem-0.5rem)] bg-bg-elevated p-8 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] sm:p-10'>
            <div className='mx-auto mb-8 max-w-md'>
              <h3 className='display-title text-lg font-bold tracking-tight text-text-primary'>
                {m.home_stats_title()}
              </h3>
              <p className='mt-1 text-xs leading-relaxed text-text-secondary sm:text-sm'>
                {m.home_stats_desc()}
              </p>
            </div>

            <div className='grid grid-cols-3 divide-x divide-border-subtle/80'>
              {marketplaceStats.map((stat) => (
                <div key={stat.label} className='px-4 first:pl-0 last:pr-0'>
                  <span className='block text-4xl font-extrabold leading-none tracking-tight text-accent-primary tabular-nums sm:text-5xl'>
                    {stat.value}
                  </span>
                  <span className='mt-2.5 block text-[10px] font-bold uppercase tracking-widest text-text-secondary'>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
