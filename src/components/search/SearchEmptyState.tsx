import { Link, useRouter } from '@tanstack/react-router'
import { Clock, Sparkles, Tag, TrendingUp, X } from 'lucide-react'
import { useRecentSearches } from '#/hooks/useRecentSearches'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'

const TRENDING_SEARCHES = [
  'Ceramic mugs',
  'Handmade jewelry',
  'Wool scarves',
  'Wooden bowls',
  'Leather wallets',
  'Linen napkins',
]

const FEATURED_COLLECTIONS = [
  {
    title: 'Summer Picks',
    description: 'Bright, seasonal handmade goods',
    href: '/search?q=summer',
    color: 'bg-accent-primary-subtle text-accent-primary',
  },
  {
    title: 'Under €25',
    description: 'Affordable artisan gifts',
    href: '/search?maxPrice=2500',
    color: 'bg-accent-secondary-subtle text-accent-secondary',
  },
]

interface SearchEmptyStateProps {
  onSelectQuery: (query: string) => void
}

export default function SearchEmptyState({ onSelectQuery }: SearchEmptyStateProps) {
  const { searches, removeSearch, clearSearches } = useRecentSearches()
  const router = useRouter()

  return (
    <div className='flex flex-col gap-6 p-4 sm:p-6'>
      {/* Recent searches */}
      <section>
        <div className='mb-3 flex items-center justify-between'>
          <h3 className='flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted'>
            <Clock size={14} aria-hidden='true' />
            {m.search_recent_searches()}
          </h3>
          {searches.length > 0 && (
            <button
              type='button'
              onClick={clearSearches}
              className='text-xs font-medium text-text-secondary hover:text-text-primary'
            >
              {m.search_recent_clear()}
            </button>
          )}
        </div>

        {searches.length === 0 ? (
          <p className='text-sm text-text-muted'>{m.search_no_recent()}</p>
        ) : (
          <ul className='flex flex-wrap gap-2'>
            {searches.map((query) => (
              <li
                key={query}
                className='inline-flex items-center gap-0.5 rounded-full border border-border-default bg-surface-default px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary'
              >
                <button
                  type='button'
                  onClick={() => onSelectQuery(query)}
                  className='text-text-secondary transition-colors hover:text-text-primary'
                >
                  {query}
                </button>
                <button
                  type='button'
                  onClick={() => removeSearch(query)}
                  className='inline-flex rounded-full p-0.5 text-text-muted transition-colors hover:bg-bg-inset hover:text-text-primary'
                  aria-label={`Remove ${query} from recent searches`}
                >
                  <X size={12} aria-hidden='true' />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Trending searches */}
      <section>
        <h3 className='mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted'>
          <TrendingUp size={14} aria-hidden='true' />
          {m.search_trending()}
        </h3>
        <ul className='flex flex-wrap gap-2'>
          {TRENDING_SEARCHES.map((query) => (
            <li key={query}>
              <button
                type='button'
                onClick={() => onSelectQuery(query)}
                className='inline-flex items-center rounded-full bg-surface-inset px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-inset hover:text-text-primary'
              >
                <Tag size={12} className='mr-1.5 text-text-muted' aria-hidden='true' />
                {query}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured collections */}
      <section>
        <h3 className='mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted'>
          <Sparkles size={14} aria-hidden='true' />
          {m.search_featured_collections()}
        </h3>
        <div className='grid gap-3 sm:grid-cols-2'>
          {FEATURED_COLLECTIONS.map((collection) => (
            <Link
              key={collection.title}
              to={collection.href}
              className={cn(
                'group rounded-xl border border-border-default p-4 transition-colors',
                'hover:border-border-strong hover:shadow-sm',
              )}
              onClick={() => router.navigate({ to: collection.href })}
            >
              <span
                className={cn(
                  'inline-block rounded-md px-2 py-0.5 text-xs font-semibold',
                  collection.color,
                )}
              >
                {collection.title}
              </span>
              <p className='mt-2 text-sm text-text-secondary'>{collection.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
