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
        className='rounded-2xl border border-border-subtle bg-surface-default p-12 text-center'
        aria-labelledby='shops-empty-heading'
      >
        <div className='size-12 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary mb-4 mx-auto'>
          <Store size={24} strokeWidth={1.5} aria-hidden='true' />
        </div>
        <h3
          id='shops-empty-heading'
          className='display-title text-xl font-bold text-text-primary mb-1'
        >
          {m.home_shops_empty_title()}
        </h3>
        <p className='text-xs sm:text-sm text-text-secondary font-sans max-w-md mx-auto mb-6 leading-relaxed'>
          {m.home_shops_empty_desc()}
        </p>
        <Link
          to='/sell'
          className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-2.5 text-xs font-semibold text-text-on-primary hover:bg-accent-primary-hover transition-colors no-underline'
        >
          <span>{m.home_open_shop()}</span>
        </Link>
      </section>
    )
  }

  return (
    <section aria-labelledby='shops-heading' className='py-8'>
      <div className='mb-8 flex items-end justify-between gap-4'>
        <div>
          <h2
            id='shops-heading'
            className='display-title text-3xl sm:text-4xl font-bold tracking-tight text-text-primary'
          >
            {m.home_shops_title_recent()}
          </h2>
          <p className='mt-1 text-xs sm:text-sm text-text-secondary font-sans'>
            {m.home_shops_subtitle()}
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
        {shops.map((shop) => (
          <Link
            key={shop.id}
            to='/shops/$shopSlug'
            params={{ shopSlug: shop.slug }}
            className='group rounded-xl border border-border-subtle bg-surface-default p-4 shadow-xs hover:border-border-strong hover:shadow-sm transition-all no-underline flex items-start gap-4'
          >
            <div
              className='relative flex size-14 shrink-0 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary overflow-hidden border border-border-subtle'
              style={{ viewTransitionName: getShopImageTransitionName(shop.id) }}
            >
              <Store size={22} strokeWidth={1.5} aria-hidden='true' />
              {shop.image && (
                <img
                  src={getImageUrl(shop.image, { width: 160, format: 'webp' })}
                  alt=''
                  className='absolute inset-0 h-full w-full object-cover'
                  onError={({ currentTarget }) => {
                    currentTarget.style.display = 'none'
                  }}
                />
              )}
            </div>

            <div className='min-w-0 flex-1'>
              {shop.category && (
                <span className='inline-block mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-primary'>
                  {shop.category}
                </span>
              )}
              <h3 className='text-sm font-bold text-text-primary truncate font-sans group-hover:text-accent-primary transition-colors'>
                Shop {shop.name.startsWith('Shop ') ? shop.name.substring(5) : shop.name}
              </h3>
              {shop.tagline && (
                <p className='text-xs text-text-secondary truncate mt-0.5 font-sans'>
                  {shop.tagline}
                </p>
              )}
              <p className='text-[11px] text-text-muted font-sans mt-2 font-medium'>
                {shop.productCount === 1
                  ? m.home_hero_featured_maker_product_single()
                  : m.home_hero_featured_maker_products({
                      count: String(shop.productCount),
                    })}
              </p>
            </div>

            <ArrowUpRight
              size={15}
              className='text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-primary self-start shrink-0'
              aria-hidden='true'
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
