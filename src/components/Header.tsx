import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'

export default function Header() {
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

        {/* User actions */}
        <div className='ml-auto flex items-center gap-0.5'>
          <UserMenu />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
