import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Store } from 'lucide-react'
import { getImageUrl } from '#/lib/image-url'
import type { FeaturedShop } from '#/lib/products'
import { getShopImageTransitionName } from '#/lib/view-transitions'
import { m } from '#/paraglide/messages'

interface HomeFeaturedShopsProps {
  shops: FeaturedShop[]
}

export function HomeFeaturedShops({ shops }: HomeFeaturedShopsProps) {
  if (shops.length === 0) {
    return (
      <section
        className='p-2 rounded-[2rem] bg-scrim-subtle border border-border-subtle shadow-md text-center'
        aria-labelledby='shops-empty-heading'
      >
        <div className='bg-bg-elevated rounded-[calc(2rem-0.5rem)] p-8 sm:p-12 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col items-center justify-center'>
          <div className='size-14 rounded-full bg-accent-primary-subtle flex items-center justify-center text-accent-primary mb-5 border border-accent-primary/10'>
            <Store size={26} strokeWidth={1.5} aria-hidden='true' />
          </div>
          <h3
            id='shops-empty-heading'
            className='mb-2 text-xl font-bold text-text-primary display-title'
          >
            {m.home_shops_empty_title()}
          </h3>
          <p className='mb-8 text-text-secondary font-sans text-xs sm:text-sm max-w-md mx-auto leading-relaxed'>
            {m.home_shops_empty_desc()}
          </p>
          <Link
            to='/sell'
            className='group inline-flex items-center justify-between gap-3 h-12 pl-6 pr-2 bg-accent-primary text-text-on-primary rounded-full font-semibold shadow-md active:scale-[0.98] transition-all no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
          >
            <span>{m.home_open_shop()}</span>
            <span className='flex size-6 rounded-full bg-scrim-subtle group-hover:bg-scrim items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]'>
              <ArrowUpRight size={14} />
            </span>
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby='shops-heading' className='py-8 animate-fade-in-up'>
      <div className='mb-10 flex items-end justify-between gap-4'>
        <div>
          <h2
            id='shops-heading'
            className='display-title text-3xl font-bold tracking-tight text-text-primary sm:text-4xl'
          >
            {m.home_shops_title()}
          </h2>
          <p className='mt-1.5 text-xs sm:text-sm text-text-secondary font-sans'>
            {m.home_shops_subtitle()}
          </p>
        </div>
      </div>
      <div className='flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-3'>
        {shops.map((shop) => (
          <div key={shop.id} className='min-w-[78vw] snap-start sm:min-w-0'>
            <Link
              to='/shops/$shopSlug'
              params={{ shopSlug: shop.slug }}
              className='group relative p-1.5 rounded-[20px] bg-scrim-subtle border border-border-subtle transition-all duration-300 hover:shadow-md hover:border-border-strong hover:-translate-y-0.5 flex no-underline'
            >
              <div className='w-full h-full bg-bg-elevated rounded-[calc(20px-6px)] p-5 flex items-start gap-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'>
                <div
                  className='flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary overflow-hidden border border-accent-primary/10'
                  style={{ viewTransitionName: getShopImageTransitionName(shop.id) }}
                >
                  {shop.image ? (
                    <img
                      src={getImageUrl(shop.image, { width: 160, format: 'webp' })}
                      alt=''
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <Store size={24} strokeWidth={1.5} />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  {shop.category && (
                    <span className='inline-block mb-1 text-[9px] font-bold uppercase tracking-widest text-accent-primary'>
                      {shop.category}
                    </span>
                  )}
                  <h3 className='text-sm font-bold text-text-primary truncate font-sans group-hover:text-accent-primary transition-colors'>
                    Shop {shop.name.startsWith('Shop ') ? shop.name.substring(5) : shop.name}
                  </h3>
                  {shop.tagline && (
                    <p className='text-xs text-text-secondary truncate mt-1 font-sans italic opacity-95'>
                      "{shop.tagline}"
                    </p>
                  )}
                  <p className='text-xs text-text-muted font-sans mt-2 font-semibold'>
                    {shop.productCount} {shop.productCount === 1 ? 'product' : 'products'}
                  </p>
                </div>
                <ArrowUpRight
                  size={15}
                  className='text-text-muted transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-primary self-start mt-1 shrink-0'
                />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
