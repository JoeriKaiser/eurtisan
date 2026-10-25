import { Link } from '@tanstack/react-router'
import { ArrowUpRight, MapPin, Store } from 'lucide-react'
import { getImageUrl } from '#/lib/image-url'
import type { FeaturedShop } from '#/lib/products'
import { getShopImageTransitionName } from '#/lib/view-transitions'
import { m } from '#/paraglide/messages'

interface HomeFeaturedShopsProps {
  shops: FeaturedShop[]
}
let regionNames: Intl.DisplayNames | null = null

function getCountryName(code?: string | null): string | null {
  if (!code) return null
  try {
    if (!regionNames) {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    }
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
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
          className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-2.5 text-xs font-semibold text-text-on-primary hover:bg-accent-primary-hover transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
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
        {shops.map((shop) => {
          const countryName = getCountryName(shop.country)
          const bio = shop.tagline ?? shop.description

          return (
            <Link
              key={shop.id}
              to='/shops/$shopSlug'
              params={{ shopSlug: shop.slug }}
              className='group block rounded-2xl border border-border-subtle bg-surface-default p-5 hover:border-accent-primary/40 transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
            >
              <div className='flex items-start gap-3.5'>
                <div
                  className='relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-accent-primary overflow-hidden border border-border-subtle'
                  style={{ viewTransitionName: getShopImageTransitionName(shop.id) }}
                >
                  <Store size={22} strokeWidth={1.5} aria-hidden='true' />
                  {shop.image && (
                    <img
                      src={getImageUrl(shop.image, { width: 160, format: 'webp' })}
                      alt=''
                      className='absolute inset-0 size-12 rounded-xl object-cover bg-surface-elevated'
                      onError={({ currentTarget }) => {
                        currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </div>

                <div className='min-w-0 flex-1'>
                  <h3 className='font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors truncate font-sans'>
                    {m.home_shop_prefix({
                      name: shop.name.startsWith('Shop ') ? shop.name.substring(5) : shop.name,
                    })}
                  </h3>
                  <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                    {shop.category && (
                      <span className='inline-block text-[10px] font-semibold uppercase tracking-wider text-accent-primary'>
                        {shop.category}
                      </span>
                    )}
                    {countryName && (
                      <span className='inline-flex items-center gap-1 rounded-full bg-surface-inset border border-border-subtle px-2 py-0.5 text-[10px] font-medium text-text-secondary'>
                        <MapPin
                          size={10}
                          className='text-accent-primary shrink-0'
                          aria-hidden='true'
                        />
                        <span>{countryName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {bio && (
                <p className='mt-3 line-clamp-2 text-xs text-text-secondary font-sans leading-relaxed'>
                  {bio}
                </p>
              )}

              <div className='mt-4 flex items-center justify-between pt-3 border-t border-border-subtle text-xs text-text-secondary'>
                <span className='font-medium'>
                  {shop.productCount === 1
                    ? m.home_hero_featured_maker_product_single()
                    : m.home_hero_featured_maker_products({
                        count: String(shop.productCount),
                      })}
                </span>
                <ArrowUpRight
                  size={14}
                  className='text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-primary shrink-0'
                  aria-hidden='true'
                />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
