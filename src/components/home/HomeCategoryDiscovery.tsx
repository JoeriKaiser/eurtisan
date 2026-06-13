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
    <section aria-labelledby='categories-heading' className='py-8 animate-fade-in-up'>
      <div className='mb-10 flex items-end justify-between gap-4'>
        <div>
          <h2
            id='categories-heading'
            className='display-title text-3xl font-bold tracking-tight text-text-primary sm:text-4xl'
          >
            {m.home_categories_title()}
          </h2>
          <p className='mt-1.5 text-xs sm:text-sm text-text-secondary font-sans'>
            {m.home_categories_subtitle()}
          </p>
        </div>
      </div>

      <div className='space-y-6'>
        {/* Spotlight Category (Editorial Split Bento Card inside Double-Bezel) */}
        {firstCategory && (
          <Link
            to='/category/$slug'
            params={{ slug: firstCategory.slug }}
            className='group relative p-2 rounded-[2.5rem] bg-black/5 dark:bg-white/5 border border-border-subtle shadow-md hover:border-border-strong hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col no-underline'
          >
            <div className='w-full h-full bg-bg-elevated rounded-[calc(2.5rem-0.5rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col md:flex-row min-h-[260px]'>
              {/* Left Panel */}
              <div className='flex-1 p-8 flex flex-col justify-between relative z-10'>
                <div>
                  <div className='flex items-center justify-between gap-4 mb-6'>
                    <div className='flex size-14 items-center justify-center rounded-2xl bg-accent-primary-subtle text-accent-primary border border-accent-primary/10 transition-colors duration-300 group-hover:bg-accent-primary group-hover:text-text-on-primary'>
                      {(() => {
                        const Icon = getCategoryIcon(firstCategory.name)
                        return <Icon size={26} strokeWidth={1.5} />
                      })()}
                    </div>
                    <span className='inline-flex items-center gap-1 rounded-full bg-accent-primary-subtle px-3 py-1 text-[9px] font-bold text-accent-primary uppercase tracking-widest border border-accent-primary/10'>
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

                <div className='mt-8 flex items-center gap-2 text-xs font-bold text-accent-primary group-hover:text-accent-primary-hover transition-colors'>
                  <span>Explore collection</span>
                  <span className='transition-transform duration-300 group-hover:translate-x-1'>
                    &rarr;
                  </span>
                </div>
              </div>

              {/* Right Visual Panel */}
              <div className='hidden md:block w-[40%] relative overflow-hidden bg-bg-inset border-l border-border-subtle/70'>
                <img
                  src='/images/spotlight_ceramics.png'
                  alt='Pottery craft showcase'
                  className='absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]'
                />
                <div className='absolute inset-0 bg-gradient-to-r from-bg-elevated/40 via-transparent to-transparent pointer-events-none' />
              </div>
            </div>
          </Link>
        )}

        {/* Remaining Categories Grid */}
        {otherCategories.length > 0 && (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
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
