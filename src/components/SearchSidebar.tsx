import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listCategories } from '#/lib/categories'
import { m } from '#/paraglide/messages'

export default function SearchSidebar() {
  return (
    <aside className='island-shell rounded-2xl p-5 sm:p-6'>
      <div className='mb-5'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sea-ink-soft)]' />
          <input
            type='search'
            placeholder={m.sidebar_search_placeholder()}
            className='w-full rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none'
          />
        </div>
      </div>

      <div>
        <h3 className='mb-3 text-sm font-semibold text-[var(--sea-ink)]'>
          {m.sidebar_categories_title()}
        </h3>
        <CategoryLinks />
      </div>
    </aside>
  )
}

function CategoryLinks() {
  const [categoryList, setCategoryList] = useState<Awaited<ReturnType<typeof listCategories>>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    listCategories()
      .then(setCategoryList)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className='space-y-2'>
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <div key={`skeleton-${i}`} className='h-6 animate-pulse rounded bg-[var(--chip-bg)]' />
        ))}
      </div>
    )
  }

  if (categoryList.length === 0) {
    return <p className='text-sm text-[var(--sea-ink-soft)]'>{m.sidebar_no_categories()}</p>
  }

  return (
    <ul className='space-y-1'>
      {categoryList.map((category) => (
        <li key={category.id}>
          <Link
            to='/category/$slug'
            params={{ slug: category.slug }}
            className='block rounded-lg px-3 py-2 text-sm text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]'
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
