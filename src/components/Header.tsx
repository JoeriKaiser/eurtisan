import { getRouteApi, Link } from '@tanstack/react-router'
import { Bell, Search, ShoppingCart } from 'lucide-react'
import { lazy, Suspense, useCallback, useState, useSyncExternalStore } from 'react'
import { useCart } from '#/components/CartProvider'
import { useAuth } from '#/lib/auth-hooks'
import type { CategoryTreeNode } from '#/lib/categories'
import { cn } from '#/lib/cn'
import { useUnreadNotificationCount } from '#/lib/notifications-hooks'
import { getCartDistinctItemCount } from '#/lib/cart-ui'
import { m } from '#/paraglide/messages'
import CategoriesMegamenu from './CategoriesMegamenu'
import LocaleDropdown from './LocaleDropdown'
import MobileNavDrawer from './MobileNavDrawer'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import Logo from './Logo'

const rootRoute = getRouteApi('__root__')
const SearchOverlay = lazy(() => import('./search/SearchOverlay'))

export default function Header() {
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)
  const [searchKey, setSearchKey] = useState(0)
  const { cart, isLoading: cartLoading } = useCart()
  const { isAuthenticated } = useAuth()
  const { data: unreadData } = useUnreadNotificationCount(isAuthenticated)
  const unreadCount = unreadData?.count ?? 0

  const loaderData = rootRoute.useLoaderData()
  const categories = (loaderData.categories ?? []) as CategoryTreeNode[]

  const subscribeToScroll = useCallback((callback: () => void) => {
    window.addEventListener('scroll', callback, { passive: true })
    return () => window.removeEventListener('scroll', callback)
  }, [])

  // Scroll state to add border shadow on scroll
  const isScrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 10,
    () => false,
  )

  const keyboardShortcutOwnerRef = useCallback((node: HTMLElement | null) => {
    if (!node) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isTypingInField =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (isTypingInField) return
      if (
        event.key === '/' ||
        (event.metaKey && event.key === 'k') ||
        (event.ctrlKey && event.key === 'k')
      ) {
        event.preventDefault()
        setSearchKey((key) => key + 1)
        setSearchOverlayOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const distinctItems = getCartDistinctItemCount(cart)

  return (
    <header
      ref={keyboardShortcutOwnerRef}
      className={cn(
        'sticky top-0 z-sticky border-b bg-surface-default/80 backdrop-blur-lg transition-all duration-base ease-out',
        isScrolled ? 'border-border-strong shadow-md' : 'border-border-default',
      )}
    >
      <nav
        className='page-wrap flex items-center gap-x-2 md:gap-x-4 px-2 md:px-4 py-2.5'
        aria-label={m.nav_main()}
      >
        <MobileNavDrawer
          categories={categories}
          onOpenSearch={() => {
            setSearchKey((key) => key + 1)
            setSearchOverlayOpen(true)
          }}
        />

        {/* Logo */}
        <Logo textClassName='hidden min-[360px]:inline' />

        {/* Nav links */}
        <div className='hidden items-center gap-x-4 text-sm font-medium md:flex flex-shrink-0'>
          <Link to='/' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_home()}
          </Link>
          <Link to='/about' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_about()}
          </Link>
          {categories.length > 0 && <CategoriesMegamenu categories={categories} />}
        </div>

        {/* Search trigger */}
        <div className='mx-4 hidden flex-1 items-center md:flex md:max-w-xs lg:max-w-sm'>
          <button
            type='button'
            onClick={() => {
              setSearchKey((k) => k + 1)
              setSearchOverlayOpen(true)
            }}
            className='w-full h-10 pl-9 pr-9 relative rounded-lg border border-border-default hover:border-border-strong bg-surface-default text-sm text-text-placeholder text-left transition-all duration-fast outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 cursor-pointer flex items-center'
            aria-label={m.search_header_placeholder()}
          >
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder'>
              <Search size={16} aria-hidden='true' />
            </span>
            <span className='flex-1 text-left whitespace-nowrap truncate'>
              {m.search_header_placeholder()}
            </span>
            <span className='absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center'>
              <kbd className='hidden lg:inline-flex items-center justify-center h-5 px-1.5 rounded border border-border-default bg-surface-inset text-[10px] font-medium text-text-muted'>
                /
              </kbd>
            </span>
          </button>
        </div>

        {/* User actions */}
        <div className='ml-auto flex items-center gap-1 flex-shrink-0'>
          {/* Mobile Search Button (Opens SearchOverlay) */}
          <button
            type='button'
            onClick={() => {
              setSearchKey((k) => k + 1)
              setSearchOverlayOpen(true)
            }}
            className='inline-flex items-center rounded-lg p-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset md:hidden outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 flex-shrink-0'
            aria-label='Search products'
          >
            <Search size={18} aria-hidden='true' />
          </button>

          {isAuthenticated && (
            <div className='relative flex-shrink-0'>
              <Link
                to='/notifications'
                className='inline-flex items-center rounded-lg p-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                aria-label={m.notifications_badge_label()}
              >
                <Bell size={18} aria-hidden='true' />
                {unreadCount > 0 && (
                  <output
                    className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-text-on-primary'
                    aria-label={m.notifications_badge_unread({ count: String(unreadCount) })}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </output>
                )}
              </Link>
            </div>
          )}
          <div className='relative flex-shrink-0'>
            <Link
              to='/cart'
              className='inline-flex items-center rounded-lg p-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              aria-label={m.cart_badge_label()}
            >
              <ShoppingCart size={18} aria-hidden='true' />
              <span className='sr-only'>{m.cart_badge_label()}</span>
              {!cartLoading && distinctItems > 0 && (
                <output
                  className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-primary px-1 text-[10px] font-bold text-text-on-primary'
                  aria-label={m.cart_badge_items({ count: String(distinctItems) })}
                >
                  {distinctItems}
                </output>
              )}
            </Link>
          </div>
          <div className='flex-shrink-0 flex items-center'>
            <UserMenu />
          </div>
          <div className='hidden md:inline-flex flex-shrink-0'>
            <LocaleDropdown />
          </div>
          <div className='hidden md:block'>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {searchOverlayOpen ? (
        <Suspense fallback={null}>
          <SearchOverlay key={searchKey} isOpen onClose={() => setSearchOverlayOpen(false)} />
        </Suspense>
      ) : null}
    </header>
  )
}
