import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Store } from 'lucide-react'
import type { FeaturedShop } from '#/lib/products'
import { m } from '#/paraglide/messages'

interface HomeFeaturedShopsProps {
  shops: FeaturedShop[]
}

export function HomeFeaturedShops({ shops }: HomeFeaturedShopsProps) {
  if (shops.length === 0) {
    return (
      <section
        className='island-shell rounded-2xl p-8 text-center sm:p-12'
        aria-labelledby='shops-empty-heading'
      >
        <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
        <h3
          id='shops-empty-heading'
          className='mb-2 text-lg font-semibold text-text-primary display-title'
        >
          {m.home_shops_empty_title()}
        </h3>
        <p className='mb-6 text-text-secondary font-sans text-sm max-w-md mx-auto'>
          {m.home_shops_empty_desc()}
        </p>
        <Link
          to='/sell'
          className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-semibold text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
        >
          {m.home_open_shop()}
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby='shops-heading'>
      <div className='mb-8 flex items-end justify-between gap-4'>
        <div>
          <h2
            id='shops-heading'
            className='display-title text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl'
          >
            {m.home_shops_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary font-sans'>{m.home_shops_subtitle()}</p>
        </div>
      </div>
      <div className='grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
        {shops.map((shop) => (
          <Link
            key={shop.id}
            to='/shops/$shopSlug'
            params={{ shopSlug: shop.slug }}
            className='island-shell group flex items-start gap-4 rounded-2xl p-5 no-underline transition-all duration-fast ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
          >
            <div className='flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary transition-colors duration-fast group-hover:bg-accent-primary group-hover:text-text-on-primary overflow-hidden'>
              {shop.image ? (
                <img src={shop.image} alt='' className='h-full w-full object-cover' />
              ) : (
                <Store size={24} strokeWidth={1.5} />
              )}
            </div>
            <div className='min-w-0 flex-1'>
              {shop.category && (
                <span className='inline-block mb-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-primary'>
                  {shop.category}
                </span>
              )}
              <h3 className='text-sm font-semibold text-text-primary truncate font-sans group-hover:text-accent-primary transition-colors'>
                Shop {shop.name.startsWith('Shop ') ? shop.name.substring(5) : shop.name}
              </h3>
              {shop.tagline && (
                <p className='text-xs text-text-secondary truncate mt-0.5 font-sans italic'>
                  "{shop.tagline}"
                </p>
              )}
              <p className='text-xs text-text-muted font-sans mt-1.5 font-medium'>
                {shop.productCount} {shop.productCount === 1 ? 'product' : 'products'}
              </p>
            </div>
            <ArrowUpRight
              size={16}
              className='text-text-muted transition-colors transition-transform duration-fast group-hover:translate-x-0.5 group-hover:translate-y--0.5 group-hover:text-accent-primary self-start mt-1 shrink-0'
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
