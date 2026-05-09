import { Link, useRouter } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { m } from '#/paraglide/messages'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import { Button } from './ui/button'
import { Input } from './ui/input'

export default function Header() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed) {
      router.navigate({
        to: '/search',
        search: { q: trimmed },
      })
    }
  }

  return (
    <header className='sticky top-0 z-sticky border-b border-border-default bg-surface-default/80 backdrop-blur-lg'>
      <nav className='page-wrap flex items-center gap-x-4 px-4 py-2.5'>
        {/* Logo */}
        <h2 className='m-0 flex-shrink-0 text-sm font-semibold tracking-tight'>
          <Link
            to='/'
            className='inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-default px-2.5 py-1 text-sm text-text-primary no-underline shadow-sm transition-all duration-fast ease-out hover:shadow-md'
          >
            <span className='h-2 w-2 rounded-full bg-accent-primary' />
            {m.nav_logo()}
          </Link>
        </h2>

        {/* Nav links */}
        <div className='hidden items-center gap-x-4 text-sm font-medium sm:flex'>
          <Link to='/' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_home()}
          </Link>
          <Link to='/about' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_about()}
          </Link>
        </div>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className='mx-4 hidden flex-1 items-center gap-2 md:flex md:max-w-xs lg:max-w-sm'
        >
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted' />
            <Input
              type='search'
              placeholder={m.search_header_placeholder()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='h-9 pl-9 text-sm'
              aria-label={m.search_header_placeholder()}
            />
          </div>
          <Button type='submit' variant='secondary' size='sm' className='h-9'>
            {m.search_header_button()}
          </Button>
        </form>

        {/* User actions */}
        <div className='ml-auto flex items-center gap-0.5'>
          <UserMenu />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
