import { m } from '#/paraglide/messages'

interface HomeStatsStripProps {
  stats: {
    sellerCount: number
    productCount: number
    countryCount: number
  }
}

export function HomeStatsStrip({ stats }: HomeStatsStripProps) {
  return (
    <div className='max-w-7xl mx-auto px-6 relative z-20'>
      <section
        aria-label='Marketplace Statistics'
        className='animate-fade-in-up -mt-16 md:-mt-24 mb-16'
        style={{ animationDelay: '100ms' }}
      >
        {/* Double-Bezel outer shell */}
        <div className='p-2 rounded-[2.5rem] bg-scrim-subtle border border-border-subtle shadow-xl'>
          {/* Inner core */}
          <div className='bg-bg-elevated rounded-[calc(2.5rem-0.5rem)] p-8 sm:p-10 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'>
            <div className='mb-8 max-w-md mx-auto'>
              <h3 className='text-lg font-bold text-text-primary display-title tracking-tight'>
                {m.home_stats_title()}
              </h3>
              <p className='text-xs sm:text-sm text-text-secondary font-sans mt-1 leading-relaxed'>
                {m.home_stats_desc()}
              </p>
            </div>

            <div className='grid gap-6 grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle/80'>
              <div className='pt-6 first:pt-0 sm:pt-0'>
                <span className='block text-4xl sm:text-5xl font-extrabold text-accent-primary font-sans tracking-tight leading-none'>
                  {stats.sellerCount}
                </span>
                <span className='block text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-2.5'>
                  {m.home_stats_makers({
                    count: stats.sellerCount.toString(),
                  })}
                </span>
              </div>

              <div className='pt-6 first:pt-0 sm:pt-0 sm:px-4'>
                <span className='block text-4xl sm:text-5xl font-extrabold text-accent-primary font-sans tracking-tight leading-none'>
                  {stats.productCount}
                </span>
                <span className='block text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-2.5'>
                  {m.home_stats_products({
                    count: stats.productCount.toString(),
                  })}
                </span>
              </div>

              <div className='pt-6 first:pt-0 sm:pt-0'>
                <span className='block text-4xl sm:text-5xl font-extrabold text-accent-primary font-sans tracking-tight leading-none'>
                  {stats.countryCount}
                </span>
                <span className='block text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-2.5'>
                  {m.home_stats_eu({
                    count: stats.countryCount.toString(),
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
