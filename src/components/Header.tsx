import { Link, useLocation, useRouter } from '@tanstack/react-router'
import { Bell, ChevronDown, Search, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCart } from '#/components/CartProvider'
import { useAuth } from '#/lib/auth-hooks'
import { listCategories } from '#/lib/categories'
import { useUnreadNotificationCount } from '#/lib/notifications-hooks'
import { m } from '#/paraglide/messages'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from './ui/primitives'

export default function Header() {
  const router = useRouter()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [searchQuery, setSearchQuery] = useState('')
  const { cart } = useCart()
  const { isAuthenticated } = useAuth()
  const { data: unreadData } = useUnreadNotificationCount()
  const unreadCount = unreadData?.count ?? 0

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>(
    [],
  )
  const [categoriesOpen, setCategoriesOpen] = useState(false)

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
  }, [])

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

  const distinctItems = cart?.shops.reduce((sum, shop) => sum + shop.items.length, 0) ?? 0

  return (
    <header className='sticky top-0 z-sticky border-b border-border-default bg-surface-default/80 backdrop-blur-lg'>
      <nav className='page-wrap flex items-center gap-x-4 px-4 py-2.5' aria-label={m.nav_main()}>
        {/* Logo */}
        <Link
          to='/'
          className='flex-shrink-0 text-xl font-semibold tracking-tight text-text-primary no-underline transition-colors duration-fast ease-out hover:text-accent-primary'
        >
          {m.nav_logo()}
        </Link>

        {/* Nav links */}
        <div className='hidden items-center gap-x-4 text-sm font-medium sm:flex'>
          <Link to='/' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_home()}
          </Link>
          <Link to='/about' className='nav-link' activeProps={{ className: 'nav-link is-active' }}>
            {m.nav_about()}
          </Link>
          {categories.length > 0 && (
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
          )}
        </div>

        {/* Search */}
        {!isHome && (
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
                className='h-8 pl-9 text-sm'
                aria-label={m.search_header_placeholder()}
              />
            </div>
            <Button type='submit' variant='secondary' size='sm'>
              {m.search_header_button()}
            </Button>
          </form>
        )}

        {/* User actions */}
        <div className='ml-auto flex items-center gap-1'>
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
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
