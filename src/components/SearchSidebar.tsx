import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listCategories } from '#/lib/categories'
import { m } from '#/paraglide/messages'
import { Input } from './ui/input'
import { Skeleton } from './ui/skeleton'

export default function SearchSidebar() {
  return (
    <aside className='island-shell p-5 sm:p-6'>
      <div className='mb-5'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted' />
          <Input type='search' placeholder={m.sidebar_search_placeholder()} className='pl-9' />
        </div>
      </div>

      <div>
        <h3 className='mb-3 text-sm font-semibold text-text-primary'>
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
          <Skeleton key={`skeleton-${i}`} className='h-6' />
        ))}
      </div>
    )
  }

  if (categoryList.length === 0) {
    return <p className='text-sm text-text-secondary'>{m.sidebar_no_categories()}</p>
  }

  return (
    <ul className='space-y-1'>
      {categoryList.map((category) => (
        <li key={category.id}>
          <Link
            to='/category/$slug'
            params={{ slug: category.slug }}
            className='block rounded-lg px-3 py-2 text-sm text-text-secondary no-underline transition-colors duration-fast ease-out hover:bg-bg-inset hover:text-text-primary'
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
