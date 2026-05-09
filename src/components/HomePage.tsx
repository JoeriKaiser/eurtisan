import { Link, useRouter } from '@tanstack/react-router'
import {
  ArrowRight,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'
import { useState } from 'react'
import type { FeaturedShop, RecentProduct } from '#/lib/products'
import { listCategories } from '#/lib/categories'
import CategoryCard from './CategoryCard'
import ProductCard from './ProductCard'
import SearchSidebar from './SearchSidebar'
import { Button } from './ui/button'
import { Input } from './ui/input'

export interface HomePageProps {
  categories: Awaited<ReturnType<typeof listCategories>>
  products: RecentProduct[]
  shops: FeaturedShop[]
}

export default function HomePage({ categories, products, shops }: HomePageProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed.length === 0) {
      setSearchError(true)
      return
    }
    setSearchError(false)
    router.navigate({
      to: '/search',
      search: { q: trimmed },
    })
  }

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════
          HERO — Brand register. Committed warmth. Editorial scale.
          ═══════════════════════════════════════════════════════════ */}
      <section className='relative overflow-hidden border-b border-border-default pt-20'>
        {/* Atmospheric background layers */}
        <div className='pointer-events-none absolute inset-0'>
          <div
            className='absolute -left-20 -top-20 h-[360px] w-[360px] rounded-full opacity-30'
            style={{
              background: 'radial-gradient(circle, oklch(62% 0.09 145 / 0.16), transparent 70%)',
            }}
          />
          <div
            className='absolute -bottom-20 -right-20 h-[400px] w-[400px] rounded-full opacity-25'
            style={{
              background: 'radial-gradient(circle, oklch(65% 0.1 175 / 0.12), transparent 70%)',
            }}
          />
        </div>

        <div className='page-wrap relative px-4 pb-10 pt-4 sm:pb-12 sm:pt-6 lg:pb-14 lg:pt-8'>
          <div className='max-w-3xl'>
            <p className='island-kicker mb-3'>European marketplace for makers</p>
            <h1 className='display-title mb-4 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl'>
              Handmade goods from European artisans
            </h1>
            <p className='mb-8 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg'>
              Discover unique, handcrafted pieces from independent makers across Europe. Every
              purchase supports a creative livelihood.
            </p>

            {/* Hero search */}
            <form onSubmit={handleSearch} className='mb-6 max-w-lg'>
              <div className='relative flex gap-2'>
                <div className='relative flex-1'>
                  <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted' />
                  <Input
                    type='search'
                    placeholder='Search for handmade products...'
                    className={`pl-9 ${searchError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (searchError) setSearchError(false)
                    }}
                    aria-label='Search for handmade products'
                    aria-invalid={searchError}
                    aria-describedby={searchError ? 'search-error' : undefined}
                  />
                </div>
                <Button type='submit' variant='secondary'>
                  Search
                </Button>
              </div>
              {searchError && (
                <p id='search-error' className='mt-1.5 text-sm text-red-500'>
                  Please enter a search term
                </p>
              )}
            </form>

            <div className='flex flex-wrap gap-3'>
              <Link to='/category/$slug' params={{ slug: 'all' }} className='no-underline'>
                <Button size='lg' className='gap-2'>
                  Explore collections
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to='/signin' className='no-underline'>
                <Button variant='secondary' size='lg'>
                  Open your shop
                </Button>
              </Link>
            </div>

            {/* Trust micro-bar */}
            <div className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-text-muted'>
              <span className='inline-flex items-center gap-1.5'>
                <MapPin size={14} className='text-accent-primary' />
                Europe-only shipping
              </span>
              <span className='inline-flex items-center gap-1.5'>
                <ShieldCheck size={14} className='text-accent-primary' />
                Secure payments
              </span>
              <span className='inline-flex items-center gap-1.5'>
                <Truck size={14} className='text-accent-primary' />
                Direct from maker
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT — Product register. Restrained, task-focused.
          ═══════════════════════════════════════════════════════════ */}
      <main className='page-wrap px-4 pb-16 pt-12'>
        <div className='grid gap-8 lg:grid-cols-[1fr_280px]'>
          <div className='space-y-16'>
            {/* Categories */}
            {categories.length > 0 && (
              <section>
                <div className='mb-6 flex items-end justify-between gap-4'>
                  <div>
                    <h2 className='text-2xl font-bold tracking-tight text-text-primary sm:text-3xl'>
                      Browse by category
                    </h2>
                    <p className='mt-1 text-sm text-text-secondary'>
                      Find exactly what you are looking for
                    </p>
                  </div>
                </div>

                <div className='grid gap-3 sm:grid-cols-2'>
                  {categories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      id={category.id}
                      name={category.name}
                      slug={category.slug}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Featured shops */}
            {shops.length > 0 ? (
              <section>
                <div className='mb-6 flex items-end justify-between gap-4'>
                  <div>
                    <h2 className='text-2xl font-bold tracking-tight text-text-primary sm:text-3xl'>
                      Featured shops
                    </h2>
                    <p className='mt-1 text-sm text-text-secondary'>
                      Discover talented makers from across Europe
                    </p>
                  </div>
                </div>

                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  {shops.map((shop) => (
                    <Link
                      key={shop.id}
                      to='/shops/$shopSlug'
                      params={{ shopSlug: shop.slug }}
                      className='island-shell group flex items-center gap-4 rounded-2xl p-5 no-underline transition hover:border-[color-mix(in_oklab,var(--lagoon-deep)_35%,var(--line))]'
                    >
                      <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary transition-colors duration-fast group-hover:bg-accent-primary group-hover:text-text-on-primary'>
                        <Store size={22} strokeWidth={1.5} />
                      </div>
                      <div className='min-w-0'>
                        <h3 className='text-sm font-semibold text-text-primary truncate'>
                          {shop.name}
                        </h3>
                        <p className='text-xs text-text-muted'>
                          {shop.productCount}{' '}
                          {shop.productCount === 1 ? 'product' : 'products'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <section className='island-shell rounded-2xl p-8 text-center sm:p-12'>
                <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
                <h2 className='mb-2 text-xl font-semibold text-text-primary'>
                  Be the first creator
                </h2>
                <p className='mb-6 text-text-secondary'>
                  No shops have opened yet. Start selling your handmade goods today.
                </p>
                <Link to='/signin' className='no-underline'>
                  <Button size='lg' className='gap-2'>
                    Open your shop
                    <ArrowRight size={18} />
                  </Button>
                </Link>
              </section>
            )}

            {/* Featured products */}
            <section>
              <div className='mb-6 flex items-end justify-between gap-4'>
                <div>
                  <h2 className='text-2xl font-bold tracking-tight text-text-primary sm:text-3xl'>
                    Fresh from the studio
                  </h2>
                  <p className='mt-1 text-sm text-text-secondary'>
                    The newest pieces added by makers
                  </p>
                </div>
              </div>

              {products.length === 0 ? (
                <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
                  <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
                  <h2 className='mb-2 text-xl font-semibold text-text-primary'>
                    No products yet
                  </h2>
                  <p className='mb-6 text-text-secondary'>
                    Check back soon or browse our categories to discover handmade goods.
                  </p>
                  <Link
                    to='/category/$slug'
                    params={{ slug: 'all' }}
                    className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-medium text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover'
                  >
                    Browse categories
                  </Link>
                </div>
              ) : (
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      imageUrl={product.image?.url ?? null}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* For makers — brand moment, committed */}
            <section className='relative overflow-hidden rounded-[2rem] border border-border-default bg-bg-inset px-6 py-14 sm:px-12 sm:py-20'>
              <div
                className='pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-30'
                style={{
                  background: 'radial-gradient(circle, oklch(62% 0.09 145 / 0.2), transparent 70%)',
                }}
              />
              <div className='relative max-w-xl'>
                <p className='island-kicker mb-4'>For makers</p>
                <h2 className='display-title mb-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl'>
                  Your craft deserves a European audience
                </h2>
                <p className='mb-8 text-base leading-relaxed text-text-secondary sm:text-lg'>
                  Eurtisan is built for artisans, not algorithms. Set up your shop in minutes, reach
                  buyers who value handmade, and keep more of what you earn.
                </p>
                <Link to='/signin' className='no-underline'>
                  <Button size='lg' className='gap-2'>
                    Start selling
                    <ArrowRight size={18} />
                  </Button>
                </Link>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className='lg:pt-2'>
            <SearchSidebar />
          </aside>
        </div>
      </main>
    </div>
  )
}
