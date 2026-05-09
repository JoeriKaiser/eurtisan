import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getCategoryBySlug } from '#/lib/categories'
import { listProductsByCategorySlug } from '#/lib/products'
import { m } from '#/paraglide/messages'
import CategoryCard from '../../components/CategoryCard'
import ProductCard from '../../components/ProductCard'

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

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
            <h1 className='display-title mb-5 text-4xl font-bold text-text-primary sm:text-5xl'>
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
            <p className='mt-2 text-sm text-text-secondary'>
              {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
            </p>
          </section>

          {/* Subcategories */}
          {category.children.length > 0 && (
            <section className='mt-8'>
              <h2 className='mb-4 text-xl font-semibold text-text-primary'>Subcategories</h2>
              <div className='grid gap-3 sm:grid-cols-2'>
                {category.children.map((child) => (
                  <CategoryCard key={child.id} id={child.id} name={child.name} slug={child.slug} />
                ))}
              </div>
            </section>
          )}

          <section className='mt-8'>
            <h2 className='mb-4 text-xl font-semibold text-text-primary'>Products</h2>
            {products.length === 0 ? (
              <div className='island-shell rounded-2xl p-8 text-center'>
                <p className='text-text-secondary'>
                  No products in this category yet. Check back soon.
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
                    price={formatPrice(product.priceCents)}
                    description={product.description}
                    categoryName={product.categoryName}
                  />
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
