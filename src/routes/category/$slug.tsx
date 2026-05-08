import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCategoryBySlugQuery } from '#/lib/categories'
import { listProductsByCategorySlugQuery } from '#/lib/products'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const category = await getCategoryBySlugQuery(params.slug)

    if (!category) {
      throw notFound()
    }

    const products = await listProductsByCategorySlugQuery(params.slug)

    return { category, products }
  },
  component: CategoryPage,
})

function CategoryPage() {
  const { category, products } = Route.useLoaderData()

  return (
    <main className='page-wrap px-4 pb-8 pt-14'>
      <div className='grid gap-6 lg:grid-cols-[1fr_280px]'>
        <div>
          <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
            <p className='island-kicker mb-3'>{m.category_kicker()}</p>
            <h1 className='display-title mb-5 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl'>
              {category.name}
            </h1>
            <p className='m-0 max-w-2xl text-base text-[var(--sea-ink-soft)]'>
              {m.category_description({ name: category.name })}
            </p>
          </section>

          <section className='mt-8'>
            <h2 className='mb-4 text-xl font-semibold text-[var(--sea-ink)]'>Products</h2>
            {products.length === 0 ? (
              <p className='text-sm text-[var(--sea-ink-soft)]'>
                No products in this category yet.
              </p>
            ) : (
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {products.map((product) => (
                  <article key={product.id} className='island-shell rounded-2xl p-5'>
                    <h3 className='mb-1 text-base font-semibold text-[var(--sea-ink)]'>
                      {product.name}
                    </h3>
                    <p className='mb-3 text-sm text-[var(--sea-ink-soft)]'>
                      {product.description ?? 'No description'}
                    </p>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-medium text-[var(--sea-ink)]'>
                        {product.price}
                      </span>
                      <span className='rounded-full bg-[var(--chip-bg)] px-2 py-1 text-xs text-[var(--sea-ink-soft)]'>
                        {product.categoryName}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className='lg:pt-0'>{/* Sidebar can be added here if needed */}</div>
      </div>
    </main>
  )
}
