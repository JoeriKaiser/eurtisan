import { Link } from '@tanstack/react-router'
import type { listCategories } from '#/lib/categories'
import { m } from '#/paraglide/messages'
import { getCategoryIcon } from '#/lib/category-icons'
import CategoryCard from '../CategoryCard'

interface HomeCategoryDiscoveryProps {
  categories: Awaited<ReturnType<typeof listCategories>>
}

export function HomeCategoryDiscovery({ categories }: HomeCategoryDiscoveryProps) {
  if (categories.length === 0) return null

  const [firstCategory, ...otherCategories] = categories

  return (
    <section aria-labelledby='categories-heading'>
      <div className='mb-8 flex items-end justify-between gap-4'>
        <div>
          <h2
            id='categories-heading'
            className='display-title text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl'
          >
            {m.home_categories_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary font-sans'>
            {m.home_categories_subtitle()}
          </p>
        </div>
      </div>

      <div className='space-y-4'>
        {/* Spotlight Category */}
        {firstCategory && (
          <Link
            to='/category/$slug'
            params={{ slug: firstCategory.slug }}
            className='group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-surface-default p-6 sm:p-8 shadow-sm transition-all duration-fast ease-out hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-md hover:ring-2 hover:ring-accent-primary/20 no-underline min-h-[180px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
          >
            <div className='pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-20 radial-glow-moss' />

            <div className='flex items-start justify-between gap-4 relative z-10'>
              <div className='flex size-14 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary transition-colors duration-fast group-hover:bg-accent-primary group-hover:text-text-on-primary'>
                {(() => {
                  const Icon = getCategoryIcon(firstCategory.name)
                  return <Icon size={28} strokeWidth={1.5} />
                })()}
              </div>
              <span className='inline-flex items-center gap-1 rounded-full bg-accent-primary-subtle px-2.5 py-0.5 text-[10px] font-semibold text-accent-primary uppercase tracking-wider'>
                Spotlight
              </span>
            </div>
            <div className='mt-6 relative z-10'>
              <h3 className='display-title text-xl sm:text-2xl font-semibold text-text-primary mb-1'>
                {firstCategory.name}
              </h3>
              <p className='text-xs sm:text-sm text-text-secondary max-w-md font-sans'>
                {firstCategory.description || m.home_categories_subtitle()}
              </p>
            </div>
          </Link>
        )}

        {/* Remaining Categories Grid */}
        {otherCategories.length > 0 && (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {otherCategories.slice(0, 6).map((category) => (
              <CategoryCard
                key={category.id}
                id={category.id}
                name={category.name}
                slug={category.slug}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
