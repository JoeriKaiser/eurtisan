import { createFileRoute, Link } from '@tanstack/react-router'
import { Package } from 'lucide-react'
import CategoryCard from '#/components/CategoryCard'
import { listCategoriesWithCounts } from '#/lib/categories'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/category/all')({
  loader: async () => {
    const categories = await listCategoriesWithCounts()
    return { categories }
  },
  head: () => ({
    meta: [
      { title: m.categories_all_meta_title() },
      { name: 'description', content: m.categories_all_meta_description() },
    ],
  }),
  component: CategoriesAllPage,
  errorComponent: CategoriesAllError,
  pendingComponent: CategoriesAllPending,
})

function CategoriesAllPage() {
  const { categories } = Route.useLoaderData()

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <p className='island-kicker mb-3'>{m.categories_all_kicker()}</p>
        <h1 className='display-title mb-6 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl'>
          {m.categories_all_title()}
        </h1>
        <p className='max-w-2xl text-base text-text-secondary'>{m.categories_all_description()}</p>
      </section>

      <section className='mt-8'>
        {categories.length === 0 ? (
          <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
            <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-xl font-semibold text-text-primary'>
              {m.categories_all_empty_title()}
            </h2>
            <p className='text-text-secondary'>{m.categories_all_empty_description()}</p>
          </div>
        ) : (
          <ul className='grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3'>
            {categories.map((category) => (
              <li key={category.id}>
                <CategoryCard
                  id={category.id}
                  name={category.name}
                  slug={category.slug}
                  description={category.description}
                  productCount={category.productCount}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function CategoriesAllError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        {m.error_unexpected()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      <Link
        to='/'
        className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-medium text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover'
      >
        {m.forbidden_go_home()}
      </Link>
    </main>
  )
}

function CategoriesAllPending() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 h-4 w-20 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-6 h-10 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
        <div className='h-4 w-1/2 animate-pulse rounded bg-[var(--sand)]' />
      </section>
      <div className='mt-8'>
        <output className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3' aria-live='polite'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={`skeleton-${n}`}
              className='island-shell flex items-center gap-4 rounded-2xl p-5'
            >
              <div className='size-12 animate-pulse rounded-xl bg-[var(--sand)]' />
              <div className='flex-1 space-y-2'>
                <div className='h-5 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
                <div className='h-4 w-1/2 animate-pulse rounded bg-[var(--sand)]' />
              </div>
            </div>
          ))}
          <span className='sr-only'>{m.product_grid_loading()}</span>
        </output>
      </div>
    </main>
  )
}
