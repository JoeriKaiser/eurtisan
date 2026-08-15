import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import { getCategoryIcon } from '#/lib/category-icons'
import CategoryCard from '../CategoryCard'

export interface HomeCategoryItem {
  id: string
  name: string
  slug: string
  description?: string | null
  parentId?: string | null
}

interface HomeCategoryDiscoveryProps {
  categories: HomeCategoryItem[]
}

export function HomeCategoryDiscovery({ categories }: HomeCategoryDiscoveryProps) {
  if (categories.length === 0) return null

  const [firstCategory, ...otherCategories] = categories

  return (
    <section aria-labelledby='categories-heading' className='py-8'>
      <div className='mb-8 flex items-end justify-between gap-4'>
        <div>
          <h2
            id='categories-heading'
            className='display-title text-3xl sm:text-4xl font-bold tracking-tight text-text-primary'
          >
            {m.home_categories_title()}
          </h2>
          <p className='mt-1 text-xs sm:text-sm text-text-secondary font-sans'>
            {m.home_categories_subtitle()}
          </p>
        </div>
      </div>

      <div className='space-y-6'>
        {/* Spotlight Category */}
        {firstCategory && (
          <Link
            to='/category/$slug'
            params={{ slug: firstCategory.slug }}
            className='group rounded-2xl border border-border-subtle bg-surface-default overflow-hidden shadow-xs hover:border-border-strong hover:shadow-sm transition-all flex flex-col md:flex-row no-underline'
          >
            {/* Left Panel */}
            <div className='flex-1 p-6 sm:p-8 flex flex-col justify-between'>
              <div>
                <div className='flex items-center justify-between gap-4 mb-4'>
                  <div className='flex size-12 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary'>
                    {(() => {
                      const Icon = getCategoryIcon(firstCategory.name)
                      return <Icon size={24} strokeWidth={1.5} />
                    })()}
                  </div>
                  <span className='rounded-full bg-surface-inset px-3 py-1 text-[11px] font-semibold text-text-primary uppercase tracking-wider'>
                    Spotlight
                  </span>
                </div>

                <h3 className='display-title text-2xl sm:text-3xl font-bold text-text-primary mb-2'>
                  {firstCategory.name}
                </h3>
                <p className='text-xs sm:text-sm text-text-secondary max-w-lg font-sans leading-relaxed'>
                  {firstCategory.description || m.home_categories_subtitle()}
                </p>
              </div>

              <div className='mt-6 flex items-center gap-2 text-xs font-semibold text-accent-primary group-hover:text-accent-primary-hover transition-colors'>
                <span>{m.home_explore_collections()}</span>
                <span className='transition-transform duration-300 group-hover:translate-x-1'>
                  &rarr;
                </span>
              </div>
            </div>

            {/* Right Visual Panel */}
            <div className='relative order-first h-48 w-full overflow-hidden bg-surface-inset md:order-none md:h-auto md:w-[42%] md:border-l md:border-border-subtle'>
              <img
                src='/images/spotlight_ceramics.png'
                alt={m.home_category_spotlight_image_alt()}
                className='h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]'
              />
            </div>
          </Link>
        )}

        {/* Remaining Categories Grid */}
        {otherCategories.length > 0 && (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {otherCategories.slice(0, 6).map((category) => (
              <div key={category.id}>
                <CategoryCard id={category.id} name={category.name} slug={category.slug} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
