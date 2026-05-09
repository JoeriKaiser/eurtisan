import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, MapPin, ShieldCheck, Truck } from 'lucide-react'
import { listCategories } from '#/lib/categories'
import { listRecentProducts } from '#/lib/products'
import CategoryCard from '../components/CategoryCard'
import ProductCard from '../components/ProductCard'
import SearchSidebar from '../components/SearchSidebar'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'

function HomeError({ error }: { error: Error }) {
  return (
    <div className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        Failed to load marketplace
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      <pre className='mx-auto max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
        {error.stack}
      </pre>
    </div>
  )
}

export const Route = createFileRoute('/')({
  loader: async () => {
    const [categories, products] = await Promise.all([
      listCategories(),
      listRecentProducts({ data: { limit: 6 } }),
    ])
    return { categories, products }
  },
  component: Home,
  errorComponent: HomeError,
})

function Home() {
  const { categories, products } = Route.useLoaderData()

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

              {categories.length === 0 ? (
                <div className='grid gap-3 sm:grid-cols-2'>
                  {Array.from({ length: 4 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                    <Skeleton key={`cat-skeleton-${i}`} className='h-[88px] rounded-2xl' />
                  ))}
                </div>
              ) : (
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
              )}
            </section>

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
                <div className='island-shell rounded-2xl p-8 text-center'>
                  <p className='text-text-secondary'>
                    No products yet. Be the first to{' '}
                    <Link to='/signin' className='font-medium text-accent-secondary'>
                      open a shop
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      shopId={product.shopId}
                      shopName={product.shopName}
                      price={product.price}
                      description={product.description}
                      categoryName={product.categoryName}
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
