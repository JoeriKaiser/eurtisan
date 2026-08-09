import { Link, useLoaderData, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { BrowseFilters, type BrowseFilterChange } from '#/components/browse/BrowseFilters'
import { RankingDisclosure } from '#/components/browse/RankingDisclosure'
import ProductGrid from '#/components/ProductGrid'
import { m } from '#/paraglide/messages'
import CategoryCard from '../../components/CategoryCard'

/** URL params this page owns, so a partial update can clear the rest by name. */
type CategorySearchParams = {
  page?: number
  sort?: 'newest' | 'price_asc' | 'price_desc'
  inStock?: true
  minPrice?: number
  maxPrice?: number
}

export function CategoryPage() {
  const { category, products, page, sort, inStockOnly, minPrice, maxPrice } = useLoaderData({
    from: '/category/$slug',
  })
  const router = useRouter()

  /**
   * Merges into the existing params instead of replacing them, so changing one
   * control never silently drops another — sorting a price-filtered list must
   * not clear the price. Params at their default are omitted so a plain
   * category URL stays clean and canonical.
   */
  const updateSearch = useCallback(
    (overrides: CategorySearchParams) => {
      const reduce = (previous: Record<string, unknown>) => {
        const next: CategorySearchParams = {
          ...(previous as CategorySearchParams),
          ...overrides,
        }
        // Any filter change resets paging: page 3 of an unfiltered list is
        // rarely a valid page of the filtered one.
        if (!('page' in overrides)) next.page = undefined
        if (next.page === 1) next.page = undefined
        if (next.sort === 'newest') next.sort = undefined
        return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined))
      }

      // `push`, not `replace`: paging and filtering are steps a buyer expects
      // the back button to undo. See the category plan §7.
      router.navigate({ to: '.', search: reduce as never })
    },
    [router],
  )

  const handleFilterChange = useCallback(
    (change: BrowseFilterChange) => {
      const toNumber = (value: string | undefined) => {
        if (value === undefined || value.trim() === '') return undefined
        const parsed = Number(value)
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
      }

      updateSearch({
        // `in` rather than a truthiness check throughout: clearing a filter
        // sends the key with `undefined`, which must be forwarded so the
        // reducer drops it, not treated as "no change".
        ...('sort' in change ? { sort: change.sort } : {}),
        ...('inStock' in change ? { inStock: change.inStock } : {}),
        ...('minPrice' in change ? { minPrice: toNumber(change.minPrice) } : {}),
        ...('maxPrice' in change ? { maxPrice: toNumber(change.maxPrice) } : {}),
      })
    },
    [updateSearch],
  )

  const handleClearFilters = useCallback(() => {
    updateSearch({ sort: undefined, inStock: undefined, minPrice: undefined, maxPrice: undefined })
  }, [updateSearch])

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateSearch({ page: newPage })
    },
    [updateSearch],
  )

  const hasActiveFilters = sort !== 'newest' || inStockOnly || minPrice !== '' || maxPrice !== ''

  return (
    <main className='page-wrap px-4 pb-12 pt-8'>
      <section className='island-shell rounded-2xl px-6 py-8 sm:px-8 sm:py-10'>
        <p className='island-kicker mb-2'>{m.category_kicker()}</p>
        <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary sm:text-4xl'>
          {category.name}
        </h1>

        {/* Breadcrumbs */}
        {category.breadcrumbs.length > 0 && (
          <nav aria-label='breadcrumb' className='mb-4'>
            <ol className='flex flex-wrap items-center gap-2 text-sm text-text-secondary'>
              {category.breadcrumbs.map((crumb, index) => (
                <li key={crumb.id} className='flex items-center gap-2'>
                  {index > 0 && <span>/</span>}
                  <Link
                    to='/category/$slug'
                    params={{ slug: crumb.slug }}
                    className='hover:text-text-primary hover:underline'
                  >
                    {crumb.name}
                  </Link>
                </li>
              ))}
              <li className='flex items-center gap-2'>
                <span>/</span>
                <span className='font-medium text-text-primary'>{category.name}</span>
              </li>
            </ol>
          </nav>
        )}

        <p className='m-0 max-w-2xl text-base text-text-secondary'>
          {m.category_description({ name: category.name })}
        </p>
        <p className='mt-3 text-sm font-medium text-text-secondary'>
          {/* Pluralised through the message format, not a ternary: Dutch plural
              rules differ from English and a ternary hardcodes one of them. */}
          {m.category_product_count({ count: category.productCount })}
        </p>
      </section>

      {category.children.length > 0 && (
        <section className='mt-8'>
          <h2 className='mb-3 text-xl font-semibold text-text-primary'>
            {m.category_subcategories()}
          </h2>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {category.children.map((child) => (
              <CategoryCard
                key={child.id}
                id={child.id}
                name={child.name}
                slug={child.slug}
                productCount={child.productCount}
              />
            ))}
          </div>
        </section>
      )}

      <section className='mt-10'>
        <h2 className='mb-3 text-xl font-semibold text-text-primary'>
          {m.category_products_heading()}
        </h2>

        {/* An empty category gets no controls: filtering nothing reads as a
            broken page rather than an unstocked one. */}
        {(category.productCount > 0 || hasActiveFilters) && (
          <BrowseFilters
            price={{ min: minPrice, max: maxPrice }}
            inStockOnly={inStockOnly}
            sort={sort}
            hasActiveFilters={hasActiveFilters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        )}

        <RankingDisclosure variant='category' />

        <ProductGrid
          products={products.products}
          page={page}
          totalPages={products.totalPages}
          onPageChange={handlePageChange}
          emptyMessage={
            hasActiveFilters ? m.category_no_filter_results() : m.category_no_products()
          }
        />
      </section>
    </main>
  )
}
