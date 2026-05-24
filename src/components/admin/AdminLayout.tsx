import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router'
import {
  Banknote,
  ChevronRight,
  FileText,
  FolderTree,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Shield,
  ShoppingBag,
  Store,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { useAuth } from '#/lib/auth-hooks'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
} from '../ui/primitives/dialog'

/* -------------------------------------------------------------------------- */
/*                              Navigation Config                             */
/* -------------------------------------------------------------------------- */

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavSection {
  title: string
  items: NavItem[]
}

function useNavSections(): NavSection[] {
  return useMemo(
    () => [
      {
        title: m.admin_layout_nav_overview(),
        items: [
          {
            label: m.admin_layout_nav_dashboard(),
            href: '/admin',
            icon: <LayoutDashboard size={18} aria-hidden='true' />,
          },
        ],
      },
      {
        title: m.admin_layout_nav_commerce(),
        items: [
          {
            label: m.admin_layout_nav_orders(),
            href: '/admin/orders',
            icon: <ShoppingBag size={18} aria-hidden='true' />,
          },
          {
            label: m.admin_layout_nav_payouts(),
            href: '/admin/payouts',
            icon: <Banknote size={18} aria-hidden='true' />,
          },
        ],
      },
      {
        title: m.admin_layout_nav_content(),
        items: [
          {
            label: m.admin_layout_nav_shops(),
            href: '/admin/shops',
            icon: <Store size={18} aria-hidden='true' />,
          },
          {
            label: m.admin_layout_nav_products(),
            href: '/admin/products',
            icon: <Package size={18} aria-hidden='true' />,
          },
          {
            label: m.admin_layout_nav_categories(),
            href: '/admin/categories',
            icon: <FolderTree size={18} aria-hidden='true' />,
          },
        ],
      },
      {
        title: m.admin_layout_nav_community(),
        items: [
          {
            label: m.admin_layout_nav_users(),
            href: '/admin/users',
            icon: <Users size={18} aria-hidden='true' />,
          },
          {
            label: m.admin_layout_nav_disputes(),
            href: '/admin/disputes',
            icon: <Gavel size={18} aria-hidden='true' />,
          },
        ],
      },
      {
        title: m.admin_layout_nav_system(),
        items: [
          {
            label: m.admin_layout_nav_audit_log(),
            href: '/admin/audit-log',
            icon: <FileText size={18} aria-hidden='true' />,
          },
        ],
      },
    ],
    [],
  )
}

/* -------------------------------------------------------------------------- */
/*                                Breadcrumbs                                 */
/* -------------------------------------------------------------------------- */

function useBreadcrumbs(): Array<{ label: string; href?: string }> {
  const location = useLocation()
  return useMemo(() => {
    const crumbs: Array<{ label: string; href?: string }> = [
      { label: m.admin_layout_breadcrumb_dashboard(), href: '/admin' },
    ]
    const path = location.pathname.replace(/^\//, '').split('/')
    // path = ['admin', 'shops', ...]
    if (path[1] === 'shops') crumbs.push({ label: m.admin_layout_nav_shops() })
    if (path[1] === 'orders') {
      if (path[2]) {
        crumbs.push({ label: m.admin_layout_nav_orders(), href: '/admin/orders' })
        crumbs.push({ label: m.admin_order_detail_title() })
      } else {
        crumbs.push({ label: m.admin_layout_nav_orders() })
      }
    }
    if (path[1] === 'payouts') crumbs.push({ label: m.admin_layout_nav_payouts() })
    if (path[1] === 'disputes') {
      if (path[2]) {
        crumbs.push({ label: m.admin_layout_nav_disputes(), href: '/admin/disputes' })
        crumbs.push({ label: m.dispute_title() })
      } else {
        crumbs.push({ label: m.admin_layout_nav_disputes() })
      }
    }
    if (path[1] === 'users') crumbs.push({ label: m.admin_layout_breadcrumb_users() })
    if (path[1] === 'categories') crumbs.push({ label: m.admin_layout_breadcrumb_categories() })
    if (path[1] === 'products') crumbs.push({ label: m.admin_layout_breadcrumb_products() })
    if (path[1] === 'audit-log') crumbs.push({ label: m.admin_audit_log_title() })
    return crumbs
  }, [location.pathname])
}

/* -------------------------------------------------------------------------- */
/*                          Keyboard Shortcuts Modal                          */
/* -------------------------------------------------------------------------- */

function ShortcutsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const shortcuts = [
    { keys: 'Cmd + Shift + K', action: m.admin_shortcuts_search() },
    { keys: '?', action: m.admin_shortcuts_shortcuts() },
    { keys: 'Esc', action: m.admin_shortcuts_close() },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-sm p-0 overflow-hidden'>
          <div className='border-b border-border-default px-4 py-3'>
            <h2 className='text-sm font-semibold text-text-primary'>{m.admin_shortcuts_title()}</h2>
          </div>
          <div className='py-2'>
            <ul>
              {shortcuts.map((s) => (
                <li key={s.keys} className='flex items-center justify-between px-4 py-2 text-sm'>
                  <span className='text-text-secondary'>{s.action}</span>
                  <span className='rounded border border-border-default bg-surface-inset px-1.5 py-0.5 text-xs font-mono text-text-muted'>
                    {s.keys}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*                            Admin Search Modal                              */
/* -------------------------------------------------------------------------- */

function AdminSearchModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const navSections = useNavSections()

  const allItems = useMemo(
    () => navSections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title }))),
    [navSections],
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase()
    return allItems.filter(
      (i) => i.label.toLowerCase().includes(q) || i.section.toLowerCase().includes(q),
    )
  }, [allItems, query])

  const handleSelect = useCallback(
    (href: string) => {
      onOpenChange(false)
      router.navigate({ to: href })
    },
    [onOpenChange, router],
  )

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md p-0 overflow-hidden'>
          <div className='border-b border-border-default px-4 py-3'>
            <div className='flex items-center gap-3'>
              <Search size={18} className='text-text-muted' aria-hidden='true' />
              <input
                ref={inputRef}
                type='text'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={m.admin_layout_search_placeholder()}
                aria-label={m.admin_layout_search_placeholder()}
                className='flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none'
              />
              <DialogClose className='rounded border border-border-default px-1.5 py-0.5 text-xs text-text-muted hover:text-text-primary transition-colors'>
                Esc
              </DialogClose>
            </div>
          </div>
          <div className='max-h-80 overflow-y-auto py-2'>
            {filtered.length === 0 ? (
              <p className='px-4 py-3 text-sm text-text-muted'>No results found.</p>
            ) : (
              <ul>
                {filtered.map((item) => (
                  <li key={item.href}>
                    <button
                      type='button'
                      onClick={() => handleSelect(item.href)}
                      className='flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-inset transition-colors'
                      role='option'
                      aria-selected={false}
                    >
                      <span className='text-text-muted'>{item.icon}</span>
                      <span>{item.label}</span>
                      <span className='ml-auto text-xs text-text-muted'>{item.section}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*                                AdminLayout                                 */
/* -------------------------------------------------------------------------- */

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchKey, setSearchKey] = useState(0)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const navSections = useNavSections()
  const breadcrumbs = useBreadcrumbs()

  const currentPath = location.pathname

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        setSearchKey((k) => k + 1)
        setSearchOpen(true)
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
        e.preventDefault()
        setShortcutsOpen(true)
      }
      if (e.key === 'Escape') {
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isActive = (href: string) => {
    if (href === '/admin') return currentPath === '/admin'
    return currentPath.startsWith(href)
  }

  const initials = user?.name?.charAt(0).toUpperCase() || 'A'

  const handleSignOut = () => {
    void authClient.signOut()
  }

  const sidebarContent = (
    <>
      <div className='flex h-16 items-center gap-2 border-b border-border-default px-4'>
        <Shield size={20} className='text-accent-primary' aria-hidden='true' />
        <span className='font-display text-lg font-bold text-text-primary'>
          {m.admin_layout_title()}
        </span>
      </div>

      <nav className='flex-1 overflow-y-auto px-3 py-4' aria-label={m.admin_layout_title()}>
        {navSections.map((section) => (
          <div key={section.title} className='mb-6'>
            <p className='mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted'>
              {section.title}
            </p>
            <ul className='space-y-0.5'>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-secondary hover:bg-bg-inset hover:text-text-primary',
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span
                      className={isActive(item.href) ? 'text-accent-primary' : 'text-text-muted'}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className='border-t border-border-default p-3'>
        <div className='flex items-center gap-3 rounded-lg px-3 py-2'>
          {user?.image ? (
            <img src={user.image} alt='' className='size-6 rounded-full object-cover' />
          ) : (
            <div className='flex size-6 items-center justify-center rounded-full bg-surface-inset border border-border-subtle'>
              <span className='text-xs font-medium text-text-secondary'>{initials}</span>
            </div>
          )}
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium text-text-primary'>
              {user?.name || 'Admin'}
            </p>
            <p className='truncate text-xs text-text-muted'>{user?.email || ''}</p>
          </div>
          <button
            type='button'
            onClick={handleSignOut}
            className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
            aria-label={m.admin_layout_logout()}
            title={m.admin_layout_logout()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className='flex min-h-[calc(100vh-65px)] flex-col md:flex-row'>
      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className='fixed inset-0 z-40 bg-black/45 backdrop-blur-sm md:hidden'
          onClick={() => setMobileOpen(false)}
          aria-hidden='true'
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-default border-r border-border-default transition-transform duration-fast ease-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!mobileOpen}
      >
        <div className='flex h-16 items-center justify-between border-b border-border-default px-4'>
          <span className='font-display text-lg font-bold text-text-primary'>
            {m.admin_layout_title()}
          </span>
          <button
            type='button'
            onClick={() => setMobileOpen(false)}
            className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
            aria-label={m.admin_layout_close_menu()}
          >
            <X size={20} />
          </button>
        </div>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <aside className='hidden md:flex w-64 shrink-0 flex-col border-r border-border-default bg-surface-default'>
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div className='flex flex-1 flex-col min-w-0'>
        {/* Top bar */}
        <header className='flex items-center justify-between gap-4 border-b border-border-default px-4 py-3 md:px-6'>
          <div className='flex items-center gap-3 min-w-0'>
            <button
              type='button'
              onClick={() => setMobileOpen(true)}
              className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors md:hidden'
              aria-label={m.admin_layout_mobile_menu()}
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumbs */}
            <nav aria-label='Breadcrumb' className='hidden sm:block'>
              <ol className='flex items-center gap-1 text-sm'>
                {breadcrumbs.map((crumb, i) => {
                  const isLast = i === breadcrumbs.length - 1
                  return (
                    <li key={`breadcrumb-${crumb.label}`} className='flex items-center gap-1'>
                      {i > 0 && (
                        <ChevronRight size={14} className='text-text-muted' aria-hidden='true' />
                      )}
                      {crumb.href && !isLast ? (
                        <Link
                          to={crumb.href}
                          className='text-text-secondary hover:text-text-primary transition-colors'
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span
                          className={
                            isLast ? 'font-medium text-text-primary' : 'text-text-secondary'
                          }
                        >
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
          </div>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => {
                setSearchKey((k) => k + 1)
                setSearchOpen(true)
              }}
              className='flex items-center gap-2 rounded-lg border border-border-default bg-surface-inset px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors'
            >
              <Search size={16} aria-hidden='true' />
              <span className='hidden lg:inline'>{m.admin_layout_search_placeholder()}</span>
              <span className='hidden lg:inline rounded border border-border-default px-1 text-xs text-text-muted'>
                {m.admin_layout_search_cmd()}
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className='flex-1 overflow-y-auto px-4 py-6 md:px-8'>
          <div className='mx-auto max-w-6xl'>
            <Outlet />
          </div>
        </main>
      </div>

      <AdminSearchModal key={searchKey} open={searchOpen} onOpenChange={setSearchOpen} />
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}
