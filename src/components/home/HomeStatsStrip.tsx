import { m } from '#/paraglide/messages'

interface HomeStatsStripProps {
  stats: {
    sellerCount: number
    productCount: number
  }
}

export function HomeStatsStrip({ stats }: HomeStatsStripProps) {
  return (
    <div className='max-w-7xl mx-auto px-6 relative z-20 -mt-16 md:-mt-24 mb-16'>
      <section
        aria-label='Marketplace Statistics'
        className='animate-fade-in-up'
        style={{ animationDelay: '100ms' }}
      >
        <div className='rounded-2xl border border-border-subtle bg-bg-elevated p-8 text-center shadow-lg'>
          <div className='mb-6'>
            <h3 className='text-lg font-semibold text-text-primary display-title'>
              {m.home_stats_title()}
            </h3>
            <p className='text-sm text-text-secondary font-sans mt-1'>{m.home_stats_desc()}</p>
          </div>
          <div className='grid gap-6 grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle'>
            <div className='pt-4 sm:pt-0'>
              <span className='block text-3xl font-extrabold text-accent-primary font-sans tracking-tight'>
                {stats.sellerCount > 0 ? stats.sellerCount : 120}
              </span>
              <span className='block text-xs font-semibold text-text-secondary uppercase tracking-wider mt-1'>
                {m.home_stats_makers({
                  count: (stats.sellerCount > 0 ? stats.sellerCount : 120).toString(),
                })}
              </span>
            </div>
            <div className='pt-4 sm:pt-0'>
              <span className='block text-3xl font-extrabold text-accent-primary font-sans tracking-tight'>
                {stats.productCount > 0 ? stats.productCount : 1450}
              </span>
              <span className='block text-xs font-semibold text-text-secondary uppercase tracking-wider mt-1'>
                {m.home_stats_products({
                  count: (stats.productCount > 0 ? stats.productCount : 1450).toString(),
                })}
              </span>
            </div>
            <div className='pt-4 sm:pt-0'>
              <span className='block text-3xl font-extrabold text-accent-primary font-sans tracking-tight'>
                27
              </span>
              <span className='block text-xs font-semibold text-text-secondary uppercase tracking-wider mt-1'>
                {m.home_stats_eu()}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
