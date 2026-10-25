import { Link } from '@tanstack/react-router'
import { getCategoryIcon } from '#/lib/category-icons'
import { m } from '#/paraglide/messages'

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
    <section aria-labelledby='categories-heading'>
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
            className='group block rounded-3xl border border-border-subtle bg-surface-default overflow-hidden transition-all duration-fast hover:border-border-strong hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 no-underline'
          >
            <div className='grid grid-cols-1 md:grid-cols-12 items-stretch'>
              {/* Left Panel - Content on solid semantic surface */}
              <div className='md:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-surface-default'>
                <div>
                  <div className='flex items-center justify-between gap-4 mb-6'>
                    <div className='flex size-12 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary'>
                      {(() => {
                        const Icon = getCategoryIcon(firstCategory.name)
                        return <Icon size={24} strokeWidth={1.5} aria-hidden='true' />
                      })()}
                    </div>
                    <span className='rounded-full bg-surface-inset border border-border-subtle px-3 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider'>
                      {m.home_category_spotlight_badge()}
                    </span>
                  </div>

                  <h3 className='display-title text-2xl sm:text-3xl lg:text-4xl font-bold text-text-primary mb-3'>
                    {firstCategory.name}
                  </h3>
                  <p className='text-sm text-text-secondary max-w-lg font-sans leading-relaxed'>
                    {firstCategory.description || m.home_categories_subtitle()}
                  </p>
                </div>

                <div className='mt-8 flex items-center gap-2 text-sm font-semibold text-accent-primary group-hover:text-accent-primary-hover transition-colors'>
                  <span>{m.home_explore_collections()}</span>
                  <span
                    className='transition-transform duration-300 group-hover:translate-x-1'
                    aria-hidden='true'
                  >
                    &rarr;
                  </span>
                </div>
              </div>

              {/* Right Visual Panel - Image in rounded frame */}
              <div className='md:col-span-5 p-4 sm:p-6 lg:p-8 flex items-center justify-center bg-surface-inset/40 md:border-l md:border-border-subtle'>
                <div className='relative w-full aspect-[4/3] md:aspect-square overflow-hidden rounded-2xl border border-border-subtle bg-surface-inset'>
                  <img
                    src='/images/spotlight_ceramics.webp'
                    alt={m.home_category_spotlight_image_alt()}
                    className='h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]'
                    loading='lazy'
                  />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Supporting Category Cards */}
        {otherCategories.length > 0 && (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {otherCategories.slice(0, 6).map((category) => {
              const Icon = getCategoryIcon(category.name)
              return (
                <Link
                  key={category.id}
                  to='/category/$slug'
                  params={{ slug: category.slug }}
                  className='group flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface-default p-4 sm:p-5 no-underline transition-all duration-fast hover:border-border-strong hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary transition-colors duration-fast group-hover:bg-accent-primary group-hover:text-text-on-primary'>
                    <Icon size={20} strokeWidth={1.5} aria-hidden='true' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <h3 className='text-sm font-semibold text-text-primary group-hover:text-accent-primary transition-colors truncate'>
                      {category.name}
                    </h3>
                    <p className='text-xs text-text-secondary truncate mt-0.5 flex items-center gap-1.5'>
                      <span>{m.home_explore_collections()}</span>
                      <span
                        className='transition-transform duration-200 group-hover:translate-x-1'
                        aria-hidden='true'
                      >
                        &rarr;
                      </span>
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
