import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import ProductGrid from '#/components/ProductGrid'
import { getCategoryBySlug } from '#/lib/categories'
import { listProductsByCategorySlug } from '#/lib/products'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const category = await getCategoryBySlug({ data: { slug: params.slug } })

    if (!category) {
      throw notFound()
    }

    const products = await listProductsByCategorySlug({ data: { slug: params.slug } })

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

            {/* Breadcrumbs */}
            {category.breadcrumbs.length > 0 && (
              <nav aria-label='breadcrumb' className='mb-4'>
                <ol className='flex flex-wrap items-center gap-2 text-sm text-[var(--sea-ink-soft)]'>
                  {category.breadcrumbs.map((crumb, index) => (
                    <li key={crumb.id} className='flex items-center gap-2'>
                      {index > 0 && <span>/</span>}
                      <Link
                        to='/category/$slug'
                        params={{ slug: crumb.slug }}
                        className='hover:text-[var(--sea-ink)] hover:underline'
                      >
                        {crumb.name}
                      </Link>
                    </li>
                  ))}
                  <li className='flex items-center gap-2'>
                    <span>/</span>
                    <span className='font-medium text-[var(--sea-ink)]'>{category.name}</span>
                  </li>
                </ol>
              </nav>
            )}

            <p className='m-0 max-w-2xl text-base text-[var(--sea-ink-soft)]'>
              {m.category_description({ name: category.name })}
            </p>
            <p className='mt-2 text-sm text-[var(--sea-ink-soft)]'>
              {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
            </p>
          </section>

          {/* Subcategories */}
          {category.children.length > 0 && (
            <section className='mt-8'>
              <h2 className='mb-4 text-xl font-semibold text-[var(--sea-ink)]'>Subcategories</h2>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {category.children.map((child) => (
                  <Link
                    key={child.id}
                    to='/category/$slug'
                    params={{ slug: child.slug }}
                    className='island-shell rounded-2xl p-5 transition hover:opacity-80'
                  >
                    <h3 className='text-base font-semibold text-[var(--sea-ink)]'>{child.name}</h3>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className='mt-8'>
            <h2 className='mb-4 text-xl font-semibold text-[var(--sea-ink)]'>Products</h2>
            <ProductGrid
              products={products}
              emptyMessage='No products in this category yet.'
            />
          </section>
        </div>

        <div className='lg:pt-0'>{/* Sidebar can be added here if needed */}</div>
      </div>
    </main>
  )
}
