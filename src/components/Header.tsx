import { Link, useRouter, getRouteApi } from '@tanstack/react-router'
import { Bell, ChevronDown, Search, ShoppingCart, Menu, X } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useCart } from '#/components/CartProvider'
import { useAuth } from '#/lib/auth-hooks'
import { useUnreadNotificationCount } from '#/lib/notifications-hooks'
import { m } from '#/paraglide/messages'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import LocaleDropdown from './LocaleDropdown'
import MobileNavDrawer from './MobileNavDrawer'
import { cn } from '#/lib/cn'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from './ui/primitives'

const rootRoute = getRouteApi('__root__')

export default function Header() {
  const router = useRouter()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const { cart } = useCart()
  const { isAuthenticated } = useAuth()
  const { data: unreadData } = useUnreadNotificationCount(isAuthenticated)
  const unreadCount = unreadData?.count ?? 0

  const { categories = [] } = rootRoute.useLoaderData()
  console.log('CATEGORIES IN HEADER:', categories)

  // Search query state
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Scroll state to add border shadow on scroll
  const [isScrolled, setIsScrolled] = useState(false)
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [])

  // Global keyboard shortcut: / to focus desktop search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTypingInField =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (isTypingInField) return

      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (!trimmed) return

    void router.navigate({
      to: '/search',
      search: { q: trimmed },
    })
  }

  const distinctItems = cart?.shops.reduce((sum, shop) => sum + shop.items.length, 0) ?? 0

  return (
    <header
      className={cn(
        'sticky top-0 z-sticky border-b bg-surface-default/80 backdrop-blur-lg transition-all duration-base ease-out',
        isScrolled ? 'border-border-strong shadow-md' : 'border-border-default',
      )}
    >
      <nav className='page-wrap flex items-center gap-x-4 px-4 py-2.5' aria-label={m.nav_main()}>
        {/* Mobile Hamburger Trigger */}
        <button
          type='button'
          onClick={() => setMobileDrawerOpen(true)}
          className='inline-flex items-center justify-center rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-inset hover:text-text-primary focus-visible:bg-bg-inset md:hidden outline-none'
          aria-label='Open menu'
          aria-expanded={mobileDrawerOpen}
          aria-haspopup='dialog'
        >
          <Menu size={20} aria-hidden='true' />
        </button>

        {/* Logo */}
        <Link
          to='/'
          className='flex-shrink-0 flex items-center gap-2 text-xl font-semibold tracking-tight text-text-primary no-underline transition-all duration-fast ease-out hover:scale-102'
        >
          <svg
            className='h-5 w-5 text-accent-primary transition-transform duration-fast ease-out hover:scale-110'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
          >
            <path d='M12 2L2 7l10 5 10-5-10-5z' />
            <path d='M2 17l10 5 10-5' />
            <path d='M2 12l10 5 10-5' />
          </svg>
          <span className='bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent'>
            {m.nav_logo()}
          </span>
        </Link>

        {/* Nav links */}
        <div className='hidden items-center gap-x-4 text-sm font-medium md:flex'>
          <Link to='/' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_home()}
          </Link>
          <Link to='/about' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_about()}
          </Link>
          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className='nav-link inline-flex cursor-pointer items-center gap-0.5 bg-transparent outline-none group'
                aria-haspopup='menu'
              >
                {m.nav_categories()}
                <ChevronDown
                  size={14}
                  className='transition-transform duration-fast ease-out group-data-[state=open]:rotate-180'
                  aria-hidden='true'
                />
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuPopup className='max-h-80 w-56 overflow-y-auto'>
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => {
                        void router.navigate({
                          to: '/category/$slug',
                          params: { slug: category.slug },
                        })
                      }}
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuPopup>
              </DropdownMenuPortal>
            </DropdownMenu>
          )}
        </div>

        {/* Real Desktop Search Bar */}
        <search className='mx-4 hidden flex-1 items-center md:flex md:max-w-xs lg:max-w-sm'>
          <form onSubmit={handleSearchSubmit} className='w-full'>
            <label htmlFor='header-search-input' className='sr-only'>
              {m.search_header_placeholder()}
            </label>
            <div className='relative w-full'>
              <span className='absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'>
                <Search size={16} aria-hidden='true' />
              </span>
              <input
                ref={searchInputRef}
                id='header-search-input'
                type='search'
                placeholder={m.search_header_placeholder()}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full h-10 pl-[36px] pr-[36px] rounded-lg border border-border-default hover:border-border-strong bg-surface-default text-sm text-text-primary placeholder:text-text-muted transition-all duration-fast focus-visible:border-accent-primary focus-visible:ring-1 focus-visible:ring-accent-primary outline-none'
                autoComplete='off'
              />
              <div className='absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center'>
                {searchQuery ? (
                  <button
                    type='button'
                    onClick={() => setSearchQuery('')}
                    className='rounded-md p-0.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                    aria-label='Clear search'
                  >
                    <X size={14} aria-hidden='true' />
                  </button>
                ) : (
                  <kbd className='hidden lg:inline-flex items-center justify-center h-5 px-1.5 rounded border border-border-default bg-surface-inset text-[10px] font-medium text-text-muted'>
                    /
                  </kbd>
                )}
              </div>
            </div>
          </form>
        </search>

        {/* User actions */}
        <div className='ml-auto flex items-center gap-1'>
          {/* Mobile Search Button (Opens drawer and focuses search) */}
          <button
            type='button'
            onClick={() => setMobileDrawerOpen(true)}
            className='inline-flex items-center rounded-lg p-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset md:hidden outline-none'
            aria-label='Search products'
          >
            <Search size={18} aria-hidden='true' />
          </button>

          {isAuthenticated && (
            <div className='relative'>
              <Link
                to='/notifications'
                className='inline-flex items-center rounded-lg p-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset'
                aria-label={m.notifications_badge_label()}
              >
                <Bell size={18} aria-hidden='true' />
                {unreadCount > 0 && (
                  <span
                    role='status'
                    className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-text-on-primary'
                    aria-label={m.notifications_badge_unread({ count: String(unreadCount) })}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          )}
          <div className='relative'>
            <Link
              to='/cart'
              className='inline-flex items-center rounded-lg p-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset'
              aria-label={m.cart_badge_label()}
            >
              <ShoppingCart size={18} aria-hidden='true' />
              {distinctItems > 0 && (
                <span
                  role='status'
                  className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-primary px-1 text-[10px] font-bold text-text-on-primary'
                  aria-label={m.cart_badge_items({ count: String(distinctItems) })}
                >
                  {distinctItems}
                </span>
              )}
            </Link>
          </div>
          <UserMenu />
          <div className='hidden md:inline-flex'>
            <LocaleDropdown />
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <MobileNavDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        categories={categories}
      />
    </header>
  )
}
