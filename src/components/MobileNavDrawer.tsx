import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Bell, LogOut, Menu, Package, Search, Settings, User, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { useAuth } from '#/lib/auth-hooks'
import { getCategoryIcon } from '#/lib/category-icons'
import { m } from '#/paraglide/messages'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import { Dialog, DialogBackdrop, DialogPortal } from './ui/primitives/dialog'

interface MobileNavDrawerProps {
  categories: Array<{ id: string; name: string; slug: string }>
  onOpenSearch: () => void
}

const VISIBLE_CATEGORY_COUNT = 8

export default function MobileNavDrawer({ categories, onOpenSearch }: MobileNavDrawerProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const visibleCategories = categories.slice(0, VISIBLE_CATEGORY_COUNT)
  const initials = user?.name?.charAt(0).toUpperCase() || 'U'

  const closeNavigation = () => setIsOpen(false)
  const markTriggerHydrated = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return

    node.dataset.mobileNavHydrated = 'true'
    return () => node.removeAttribute('data-mobile-nav-hydrated')
  }, [])

  const handleSignOut = async () => {
    await authClient.signOut()
    closeNavigation()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <BaseDialog.Trigger
        ref={markTriggerHydrated}
        className='inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-text-secondary outline-none transition-colors hover:bg-bg-inset hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 md:hidden'
        aria-label={m.mobile_nav_open()}
      >
        <Menu size={20} aria-hidden='true' />
      </BaseDialog.Trigger>
      <DialogPortal>
        <DialogBackdrop className='bg-bg-overlay/70' />
        <BaseDialog.Popup
          className='fixed inset-0 z-modal flex h-dvh min-h-0 w-full flex-col bg-bg-base outline-none transition-[opacity,transform] duration-base ease-out data-[starting-style]:translate-y-3 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-3 data-[ending-style]:opacity-0'
          aria-label={m.mobile_nav_label()}
        >
          <header className='shrink-0 border-b border-border-default bg-surface-default'>
            <div className='mx-auto flex min-h-16 w-full max-w-lg items-center justify-between px-4 py-2'>
              <Logo onClick={closeNavigation} />
              <BaseDialog.Close
                className='inline-flex size-11 items-center justify-center rounded-xl text-text-secondary outline-none transition-colors hover:bg-bg-inset hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                aria-label={m.mobile_nav_close()}
              >
                <X size={20} aria-hidden='true' />
              </BaseDialog.Close>
            </div>
          </header>

          <nav
            className='min-h-0 flex-1 overflow-y-auto overscroll-contain'
            aria-label={m.mobile_nav_label()}
          >
            <div className='mx-auto w-full max-w-lg px-4 pb-8 pt-5'>
              <button
                type='button'
                onClick={() => {
                  closeNavigation()
                  onOpenSearch()
                }}
                className='group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border-default bg-surface-default px-4 py-3 text-left text-base font-medium text-text-secondary outline-none transition-colors hover:border-border-strong hover:bg-surface-inset hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                <span className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary'>
                  <Search size={18} aria-hidden='true' />
                </span>
                <span className='flex-1'>{m.mobile_nav_search()}</span>
                <ArrowRight
                  size={17}
                  className='transition-transform duration-fast ease-out group-hover:translate-x-0.5'
                  aria-hidden='true'
                />
              </button>

              <section className='mt-8' aria-labelledby='mobile-primary-navigation'>
                <h2 id='mobile-primary-navigation' className='sr-only'>
                  {m.nav_main()}
                </h2>
                <Link
                  to='/search'
                  onClick={closeNavigation}
                  className='group flex min-h-16 items-center justify-between border-b border-border-default pb-4 text-text-primary no-underline'
                >
                  <span className='display-title text-[2.35rem] font-semibold leading-none tracking-tight'>
                    {m.mobile_nav_explore()}
                  </span>
                  <ArrowRight
                    size={22}
                    className='shrink-0 text-accent-primary transition-transform duration-fast ease-out group-hover:translate-x-1'
                    aria-hidden='true'
                  />
                </Link>
                <div className='grid grid-cols-2 gap-x-6'>
                  <Link
                    to='/about'
                    onClick={closeNavigation}
                    className='flex min-h-14 items-center border-b border-border-default text-base font-semibold text-text-primary no-underline hover:text-accent-primary'
                  >
                    {m.nav_about()}
                  </Link>
                  {user?.role === 'creator' || user?.role === 'admin' ? (
                    <Link
                      to='/studio'
                      onClick={closeNavigation}
                      className='flex min-h-14 items-center border-b border-border-default text-base font-semibold text-text-primary no-underline hover:text-accent-primary'
                    >
                      {m.nav_my_shop()}
                    </Link>
                  ) : (
                    <Link
                      to='/sell'
                      onClick={closeNavigation}
                      className='flex min-h-14 items-center border-b border-border-default text-base font-semibold text-text-primary no-underline hover:text-accent-primary'
                    >
                      {m.nav_start_selling()}
                    </Link>
                  )}
                </div>
              </section>

              {visibleCategories.length > 0 ? (
                <section className='mt-9' aria-labelledby='mobile-category-navigation'>
                  <div className='flex items-center justify-between gap-4'>
                    <h2
                      id='mobile-category-navigation'
                      className='display-title text-2xl font-semibold text-text-primary'
                    >
                      {m.mobile_nav_browse_crafts()}
                    </h2>
                    <Link
                      to='/category/all'
                      onClick={closeNavigation}
                      className='inline-flex min-h-11 shrink-0 items-center py-2 text-sm font-semibold text-accent-primary no-underline hover:text-accent-primary-hover'
                    >
                      {m.mobile_nav_view_all_categories({ count: categories.length })}
                    </Link>
                  </div>

                  <ul className='mt-4 grid list-none grid-cols-2 gap-2 p-0'>
                    {visibleCategories.map((category) => {
                      const Icon = getCategoryIcon(category.name) as LucideIcon
                      return (
                        <li key={category.id}>
                          <Link
                            to='/category/$slug'
                            params={{ slug: category.slug }}
                            onClick={closeNavigation}
                            className='group flex min-h-20 flex-col justify-between rounded-2xl bg-surface-inset p-3.5 text-text-primary no-underline transition-colors hover:bg-accent-primary-subtle dark:bg-surface-default'
                          >
                            <Icon
                              size={19}
                              strokeWidth={1.5}
                              className='text-accent-primary'
                              aria-hidden='true'
                            />
                            <span className='mt-3 flex items-end justify-between gap-2 text-sm font-semibold'>
                              <span className='line-clamp-2'>{category.name}</span>
                              <ArrowRight
                                size={14}
                                className='shrink-0 transition-transform duration-fast ease-out group-hover:translate-x-0.5'
                                aria-hidden='true'
                              />
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {user ? (
                <section className='mt-9' aria-labelledby='mobile-account-navigation'>
                  <h2
                    id='mobile-account-navigation'
                    className='display-title text-2xl font-semibold text-text-primary'
                  >
                    {m.mobile_nav_account()}
                  </h2>
                  <div className='mt-4 flex items-center gap-3 rounded-2xl bg-surface-inset p-4'>
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=''
                        className='size-11 rounded-xl border border-border-default object-cover'
                      />
                    ) : (
                      <div className='flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-default'>
                        <span className='text-sm font-semibold text-text-secondary'>
                          {initials}
                        </span>
                      </div>
                    )}
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-semibold text-text-primary'>
                        {user.name}
                      </p>
                      <p className='truncate text-xs text-text-muted'>{user.email}</p>
                    </div>
                  </div>

                  <ul className='mt-2 grid list-none grid-cols-2 gap-2 p-0'>
                    <li>
                      <Link
                        to='/account'
                        onClick={closeNavigation}
                        className='flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-secondary no-underline hover:bg-surface-inset hover:text-text-primary'
                      >
                        <User size={16} aria-hidden='true' />
                        {m.nav_profile()}
                      </Link>
                    </li>
                    <li>
                      <Link
                        to='/account/orders'
                        onClick={closeNavigation}
                        className='flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-secondary no-underline hover:bg-surface-inset hover:text-text-primary'
                      >
                        <Package size={16} aria-hidden='true' />
                        {m.account_orders()}
                      </Link>
                    </li>
                    <li>
                      <Link
                        to='/notifications'
                        onClick={closeNavigation}
                        className='flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-secondary no-underline hover:bg-surface-inset hover:text-text-primary'
                      >
                        <Bell size={16} aria-hidden='true' />
                        {m.notifications_title()}
                      </Link>
                    </li>
                    <li>
                      <Link
                        to='/account/settings'
                        onClick={closeNavigation}
                        className='flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-medium text-text-secondary no-underline hover:bg-surface-inset hover:text-text-primary'
                      >
                        <Settings size={16} aria-hidden='true' />
                        {m.nav_settings()}
                      </Link>
                    </li>
                  </ul>
                  <button
                    type='button'
                    onClick={handleSignOut}
                    className='mt-2 inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium text-error outline-none transition-colors hover:text-error-hover focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                  >
                    <LogOut size={16} aria-hidden='true' />
                    {m.nav_sign_out()}
                  </button>
                </section>
              ) : (
                <Link
                  to='/signin'
                  onClick={closeNavigation}
                  className='mt-9 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-primary px-5 py-3 text-sm font-semibold text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active'
                >
                  {m.nav_sign_in()}
                </Link>
              )}
            </div>
          </nav>

          <footer className='shrink-0 border-t border-border-default bg-surface-default pb-[max(0.5rem,env(safe-area-inset-bottom))]'>
            <div className='mx-auto flex min-h-16 w-full max-w-lg items-center justify-between gap-4 px-4 py-2'>
              <div className='flex items-center gap-2'>
                <span className='text-xs font-semibold text-text-muted'>
                  {m.mobile_nav_language()}
                </span>
                <div className='flex items-center rounded-xl bg-surface-inset p-1'>
                  {locales.map((locale) => {
                    const isActive = locale === getLocale()
                    return (
                      <button
                        key={locale}
                        type='button'
                        onClick={() => {
                          setLocale(locale)
                          closeNavigation()
                        }}
                        aria-pressed={isActive}
                        className={`min-h-9 rounded-lg px-3 text-xs font-semibold uppercase transition-colors focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 ${
                          isActive
                            ? 'bg-surface-default text-text-primary shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {locale}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className='flex items-center gap-1.5 [&_button]:size-11 [&_button]:justify-center'>
                <span className='text-xs font-semibold text-text-muted'>
                  {m.mobile_nav_theme()}
                </span>
                <ThemeToggle />
              </div>
            </div>
          </footer>
        </BaseDialog.Popup>
      </DialogPortal>
    </Dialog>
  )
}
