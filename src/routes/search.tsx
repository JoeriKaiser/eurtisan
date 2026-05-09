import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import ProductGrid from '#/components/ProductGrid'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { searchProducts } from '#/lib/products'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/search')({
  loader: async ({ search }) => {
    const query = typeof search.q === 'string' ? search.q.trim() : ''
    const page = typeof search.page === 'string' ? Number.parseInt(search.page, 10) || 1 : 1

    if (query.length === 0) {
      return { query: '', products: null, page }
    }

    const result = await searchProducts({
      data: { query, page, pageSize: 12 },
    })

    return { query, products: result, page }
  },
  head: ({ loaderData }) => {
    const query = loaderData?.query ?? ''
    return {
      meta: [
        {
          title: query ? m.search_meta_title({ query }) : m.meta_title_default(),
        },
        {
          name: 'description',
          content: query ? m.search_meta_description({ query }) : m.meta_title_default(),
        },
      ],
    }
  },
  component: SearchPage,
  errorComponent: SearchError,
  pendingComponent: SearchPending,
})

function SearchPage() {
  const { query, products, page } = Route.useLoaderData()
  const router = useRouter()
  const [localQuery, setLocalQuery] = useState(query)

  const handleSearch = useCallback(() => {
    const trimmed = localQuery.trim()
    router.navigate({
      to: '/search',
      search: trimmed ? { q: trimmed } : {},
      replace: true,
    })
  }, [router, localQuery])

  const handlePageChange = useCallback(
    (newPage: number) => {
      const trimmed = query.trim()
      router.navigate({
        to: '/search',
        search: trimmed ? { q: trimmed, page: newPage } : { page: newPage },
        replace: true,
      })
    },
    [router, query],
  )

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <p className='island-kicker mb-3'>{m.search_kicker()}</p>
        <h1 className='display-title mb-6 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl'>
          {m.search_title()}
        </h1>

        <div className='flex gap-2'>
          <div className='relative flex-1 sm:max-w-md'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted' />
            <Input
              type='search'
              placeholder={m.search_input_placeholder()}
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              className='pl-9'
              aria-label={m.search_input_placeholder()}
            />
          </div>
          <Button onClick={handleSearch} variant='secondary'>
            {m.search_button()}
          </Button>
        </div>
      </section>

      <section className='mt-8'>
        {query.length === 0 ? (
          <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
            <Search size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-xl font-semibold text-text-primary'>
              {m.search_prompt_title()}
            </h2>
            <p className='text-text-secondary'>{m.search_prompt_description()}</p>
          </div>
        ) : products && products.products.length === 0 ? (
          <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
            <h2 className='mb-2 text-xl font-semibold text-text-primary'>
              {m.search_no_results_title()}
            </h2>
            <p className='mb-6 text-text-secondary'>{m.search_no_results_description({ query })}</p>
            <Link
              to='/category/all'
              className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-medium text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover'
            >
              {m.search_browse_categories()}
            </Link>
          </div>
        ) : products ? (
          <ProductGrid
            products={products.products}
            page={page}
            totalPages={products.totalPages}
            onPageChange={handlePageChange}
          />
        ) : null}
      </section>
    </main>
  )
}

function SearchError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        {m.error_unexpected()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
    </main>
  )
}

function SearchPending() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 h-4 w-20 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-6 h-10 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
        <div className='flex gap-2'>
          <div className='h-10 flex-1 animate-pulse rounded bg-[var(--sand)] sm:max-w-md' />
          <div className='h-10 w-20 animate-pulse rounded bg-[var(--sand)]' />
        </div>
      </section>
      <div className='mt-8'>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3' role='status' aria-live='polite'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={`skeleton-${n}`}
              className='island-shell flex flex-col overflow-hidden rounded-2xl'
            >
              <div className='aspect-[4/3] w-full animate-pulse bg-[var(--sand)]' />
              <div className='flex flex-1 flex-col gap-2 p-4'>
                <div className='h-5 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
                <div className='h-4 w-full animate-pulse rounded bg-[var(--sand)]' />
                <div className='mt-auto h-6 w-1/3 animate-pulse rounded bg-[var(--sand)]' />
              </div>
            </div>
          ))}
          <span className='sr-only'>{m.product_grid_loading()}</span>
        </div>
      </div>
    </main>
  )
}
