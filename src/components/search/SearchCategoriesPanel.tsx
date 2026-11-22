import { Link } from '@tanstack/react-router'
import { Tag } from 'lucide-react'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'
import { isUnmodifiedPrimaryClick } from './click-navigation'

interface SearchCategoriesPanelProps {
  categories: Array<{ id: string; name: string; slug: string; count?: number }>
  isLoading: boolean
  query: string
  onSelectCategory?: () => void
}

export default function SearchCategoriesPanel({
  categories,
  isLoading,
  query,
  onSelectCategory,
}: SearchCategoriesPanelProps) {
  if (isLoading) {
    return (
      <div className='px-4 pb-2 pt-3 sm:px-6'>
        <div className='mb-2 h-3 w-28 animate-pulse rounded bg-surface-inset' />
        <div className='flex flex-wrap gap-2'>
          {['skeleton-a', 'skeleton-b', 'skeleton-c'].map((key) => (
            <div key={key} className='h-8 w-20 animate-pulse rounded-full bg-surface-inset' />
          ))}
        </div>
      </div>
    )
  }

  if (categories.length === 0) {
    return null
  }

  const title = query.trim()
    ? m.search_categories_matching({ query })
    : m.search_browse_categories()

  return (
    <div className='px-4 pb-2 pt-3 sm:px-6'>
      <h3 className='mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted'>
        <Tag size={12} aria-hidden='true' />
        {title}
      </h3>
      <ul className='flex flex-wrap gap-2'>
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              to='/category/$slug'
              params={{ slug: category.slug }}
              onClick={(event) => {
                if (isUnmodifiedPrimaryClick(event)) {
                  onSelectCategory?.()
                }
              }}
              className={cn(
                'inline-flex items-center rounded-full border border-border-default',
                'bg-surface-default px-3 py-1.5 text-sm text-text-secondary',
                'transition-colors hover:border-border-strong hover:bg-bg-inset hover:text-text-primary',
              )}
            >
              {category.name}
              {category.count === undefined ? null : (
                <span className='ml-1.5 text-xs text-text-muted'>{category.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
