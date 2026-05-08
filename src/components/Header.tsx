import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { listCategories } from '#/lib/categories'
import { m } from '#/paraglide/messages'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'

function CategoryNavLinks() {
  const [categoryList, setCategoryList] = useState<Awaited<ReturnType<typeof listCategories>>>([])

  useEffect(() => {
    listCategories().then(setCategoryList)
  }, [])

  return (
    <>
      {categoryList.map((category) => (
        <Link
          key={category.id}
          to='/category/$slug'
          params={{ slug: category.slug }}
          className='nav-link'
          activeProps={{ className: 'nav-link is-active' }}
        >
          {category.name}
        </Link>
      ))}
    </>
  )
}

export default function Header() {
  return (
    <header className='sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg'>
      <nav className='page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4'>
        <h2 className='m-0 flex-shrink-0 text-base font-semibold tracking-tight'>
          <Link
            to='/'
            className='inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2'
          >
            <span className='h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]' />
            {m.nav_logo()}
          </Link>
        </h2>

        <div className='ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2'>
          <UserMenu />
          <ThemeToggle />
        </div>

        <div className='order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0'>
          <Link to='/' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_home()}
          </Link>
          <Link to='/about' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_about()}
          </Link>
          <a
            href='https://tanstack.com/start/latest/docs/framework/react/overview'
            className='nav-link'
            target='_blank'
            rel='noreferrer'
          >
            {m.nav_docs()}
          </a>
          <CategoryNavLinks />
        </div>
      </nav>
    </header>
  )
}
