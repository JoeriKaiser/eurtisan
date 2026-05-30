import { Package } from 'lucide-react'
import CategoryCard from '#/components/CategoryCard'
import { useLoaderData } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

export function CategoriesAllPage() {
  const { categories } = useLoaderData({ from: '/category/all' })

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <p className='island-kicker mb-3'>{m.categories_all_kicker()}</p>
        <h1 className='display-title mb-6 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl'>
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
