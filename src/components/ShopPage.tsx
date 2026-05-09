import { Link, useRouter } from '@tanstack/react-router'
import { Search, Store } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { PaginatedProducts, ShopSummary } from '#/lib/products.server'
import { m } from '#/paraglide/messages'
import ProductGrid from './ProductGrid'
import { Button } from './ui/button'
import { Input } from './ui/input'

export interface ShopPageProps {
  shop: ShopSummary
  products: PaginatedProducts
  searchQuery: string
}

export default function ShopPage({ shop, products, searchQuery }: ShopPageProps) {
  const router = useRouter()
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const handleSearch = useCallback(() => {
    const trimmed = localSearch.trim()
    router.navigate({
      to: '.',
      search: trimmed ? { search: trimmed } : {},
      replace: true,
    })
  }, [router, localSearch])

  const handlePageChange = useCallback(
    (page: number) => {
      const trimmed = searchQuery.trim()
      router.navigate({
        to: '.',
        search: trimmed ? { page, search: trimmed } : { page },
        replace: true,
      })
    },
    [router, searchQuery],
  )

  const hasProducts = products.products.length > 0
  const showCta = !hasProducts && !searchQuery

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      {/* Shop Header */}
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 flex items-center gap-3'>
          <Store size={24} className='text-accent-primary' aria-hidden='true' />
          <p className='island-kicker'>{m.shop_kicker()}</p>
        </div>
        <h1 className='display-title mb-4 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl'>
          {shop.name}
        </h1>
        {shop.description ? (
          <p className='max-w-2xl text-base leading-relaxed text-text-secondary'>
            {shop.description}
          </p>
        ) : null}
      </section>

      {/* Products */}
      <section className='mt-8'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <h2 className='text-xl font-semibold text-text-primary'>{m.shop_products_title()}</h2>
          <div className='flex gap-2'>
            <div className='relative flex-1 sm:w-64'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted' />
              <Input
                type='search'
                placeholder={m.shop_search_placeholder()}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                className='pl-9'
                aria-label={m.shop_search_placeholder()}
              />
            </div>
            <Button onClick={handleSearch} variant='secondary'>
              {m.shop_search_button()}
            </Button>
          </div>
        </div>

        <ProductGrid
          products={products.products}
          emptyMessage={searchQuery ? m.shop_no_search_results() : m.shop_no_products()}
          page={products.page}
          totalPages={products.totalPages}
          onPageChange={handlePageChange}
        />

        {showCta && (
          <div className='mt-8 flex justify-center'>
            <Link
              to='/'
              className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-medium text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover'
            >
              {m.shop_browse_marketplace()}
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
