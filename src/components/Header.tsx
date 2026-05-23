import { Link, useRouter } from '@tanstack/react-router'
import { Bell, ChevronDown, Search, ShoppingCart, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCart } from '#/components/CartProvider'
import { useAuth } from '#/lib/auth-hooks'
import { listCategories } from '#/lib/categories'
import { useUnreadNotificationCount } from '#/lib/notifications-hooks'
import { m } from '#/paraglide/messages'
import { SearchOverlay } from './search'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import LocaleDropdown from './LocaleDropdown'
import MobileNavDrawer from './MobileNavDrawer'
import { Skeleton } from '#/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from './ui/primitives'

export default function Header() {
  const router = useRouter()
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const { cart } = useCart()
  const { isAuthenticated } = useAuth()
  const { data: unreadData } = useUnreadNotificationCount()
  const unreadCount = unreadData?.count ?? 0

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>(
    [],
  )
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    listCategories()
      .then((cats) => {
        if (cats.length > 0) {
          setCategories(cats)
        }
      })
      .catch(() => {
        // silently fail; categories dropdown will just be empty
      })
      .finally(() => {
        setIsLoadingCategories(false)
      })
  }, [])

  // Global keyboard shortcuts: / and Cmd+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTypingInField =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (isTypingInField) return

      if (e.key === '/' || (e.metaKey && e.key === 'k') || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault()
        setSearchOverlayOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const distinctItems = cart?.shops.reduce((sum, shop) => sum + shop.items.length, 0) ?? 0

  return (
    <header className='sticky top-0 z-sticky border-b border-border-default bg-surface-default/80 backdrop-blur-lg'>
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
          {isLoadingCategories ? (
            <div className='flex items-center py-1' aria-hidden='true'>
              <Skeleton className='h-5 w-20' />
            </div>
          ) : categories.length > 0 ? (
            <DropdownMenu open={categoriesOpen} onOpenChange={setCategoriesOpen}>
              <DropdownMenuTrigger
                className='nav-link inline-flex cursor-pointer items-center gap-0.5 bg-transparent outline-none'
                aria-haspopup='menu'
              >
                {m.nav_categories()}
                <ChevronDown
                  size={14}
                  className='transition-transform duration-fast ease-out'
                  style={{ transform: categoriesOpen ? 'rotate(180deg)' : undefined }}
                  aria-hidden='true'
                />
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuPopup className='max-h-80 w-56 overflow-y-auto'>
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      onClick={() => {
                        router.navigate({ to: '/category/$slug', params: { slug: category.slug } })
                        setCategoriesOpen(false)
                      }}
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuPopup>
              </DropdownMenuPortal>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Search trigger */}
        <button
          type='button'
          onClick={() => setSearchOverlayOpen(true)}
          className='mx-4 hidden flex-1 items-center gap-2 rounded-lg border border-border-default bg-surface-default px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary md:flex md:max-w-xs lg:max-w-sm'
          aria-label={m.search_header_placeholder()}
        >
          <Search className='h-4 w-4' aria-hidden='true' />
          <span className='flex-1 text-left'>{m.search_header_placeholder()}</span>
          <kbd className='hidden rounded border border-border-default bg-surface-inset px-1.5 py-0.5 text-[10px] font-medium lg:inline-block'>
            /
          </kbd>
        </button>

        {/* User actions */}
        <div className='ml-auto flex items-center gap-1'>
          {/* Mobile Search Button */}
          <button
            type='button'
            onClick={() => setSearchOverlayOpen(true)}
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

      <SearchOverlay isOpen={searchOverlayOpen} onClose={() => setSearchOverlayOpen(false)} />
      <MobileNavDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        categories={categories}
        isLoadingCategories={isLoadingCategories}
      />
    </header>
  )
}
