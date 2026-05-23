import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { Link } from '@tanstack/react-router'
import { ChevronDown, X, Search, User, Store, Sparkles, Settings, LogOut } from 'lucide-react'
import { useState } from 'react'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import { useAuth } from '#/lib/auth-hooks'
import { authClient } from '#/lib/auth-client'
import { Dialog, DialogBackdrop, DialogPortal } from './ui/primitives/dialog'
import ThemeToggle from './ThemeToggle'

interface MobileNavDrawerProps {
  isOpen: boolean
  onClose: () => void
  categories: Array<{ id: string; name: string; slug: string }>
  onOpenSearch: () => void
}

export default function MobileNavDrawer({
  isOpen,
  onClose,
  categories,
  onOpenSearch,
}: MobileNavDrawerProps) {
  const { user } = useAuth()
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)

  const handleSignOut = async () => {
    await authClient.signOut()
    onClose()
  }

  const initials = user?.name?.charAt(0).toUpperCase() || 'U'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <BaseDialog.Popup
          className='fixed left-0 top-0 bottom-0 z-modal flex h-full w-72 max-w-[85vw] flex-col border-r border-border-default bg-surface-default p-6 shadow-xl outline-none transition-transform duration-base ease-out data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full'
          aria-label='Navigation Drawer'
        >
          {/* Header */}
          <div className='flex items-center justify-between border-b border-border-default pb-4 mb-4'>
            <Link
              to='/'
              onClick={onClose}
              className='flex items-center gap-2 text-lg font-bold tracking-tight text-text-primary no-underline transition-colors hover:text-accent-primary'
            >
              <svg
                className='size-5 text-accent-primary transition-transform duration-fast ease-out hover:scale-110'
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
              <span className='text-accent-primary'>{m.nav_logo()}</span>
            </Link>
            <BaseDialog.Close
              className='inline-flex items-center justify-center rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-inset hover:text-text-primary focus-visible:bg-bg-inset outline-none'
              aria-label='Close menu'
            >
              <X size={18} aria-hidden='true' />
            </BaseDialog.Close>
          </div>

          {/* Search Trigger Button */}
          <div className='relative mb-4 min-w-0'>
            <button
              type='button'
              onClick={() => {
                onClose()
                onOpenSearch()
              }}
              className='w-full h-10 pl-9 pr-3 relative rounded-lg border border-border-default bg-surface-inset text-sm text-text-muted text-left transition-all duration-fast outline-none cursor-pointer flex items-center min-w-0'
              aria-label={m.search_header_placeholder()}
            >
              <span className='absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'>
                <Search size={16} aria-hidden='true' />
              </span>
              <span
                className='flex-1 text-left whitespace-nowrap truncate min-w-0'
                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {m.search_header_placeholder()}
              </span>
            </button>
          </div>

          {/* Nav stack */}
          <nav className='flex-1 space-y-4 overflow-y-auto pr-1' aria-label='Mobile navigation'>
            <Link
              to='/'
              onClick={onClose}
              className='block py-2 text-base font-semibold text-text-primary hover:text-accent-primary transition-colors'
            >
              {m.nav_home()}
            </Link>
            <Link
              to='/about'
              onClick={onClose}
              className='block py-2 text-base font-semibold text-text-primary hover:text-accent-primary transition-colors'
            >
              {m.nav_about()}
            </Link>

            {/* Categories Collapsible */}
            {categories.length > 0 && (
              <div className='border-t border-border-default/40 pt-2'>
                <button
                  type='button'
                  onClick={() => setCategoriesExpanded(!categoriesExpanded)}
                  className='flex w-full items-center justify-between py-2 text-base font-semibold text-text-primary outline-none focus-visible:text-accent-primary'
                  aria-expanded={categoriesExpanded}
                  aria-controls='mobile-categories-list'
                >
                  <span>{m.nav_categories()}</span>
                  <ChevronDown
                    size={18}
                    className={`text-text-secondary transition-transform duration-fast ${
                      categoriesExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {categoriesExpanded && (
                  <ul
                    id='mobile-categories-list'
                    className='mt-1 flex flex-col gap-1 pl-4 border-l border-border-default/60 animate-in fade-in slide-in-from-top-1 duration-fast'
                  >
                    {categories.map((category) => (
                      <li key={category.id}>
                        <Link
                          to='/category/$slug'
                          params={{ slug: category.slug }}
                          onClick={onClose}
                          className='block py-2 text-sm font-medium text-text-secondary hover:text-accent-primary transition-colors'
                        >
                          {category.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* User Auth Actions inside drawer */}
            {user ? (
              <div className='border-t border-border-default/40 pt-4 mt-4 space-y-4'>
                <div className='flex items-center gap-3 px-1 py-1.5'>
                  {user.image ? (
                    <img
                      src={user.image}
                      alt=''
                      className='size-10 rounded-full object-cover border border-border-default'
                    />
                  ) : (
                    <div className='flex size-10 items-center justify-center rounded-full bg-surface-inset border border-border-default'>
                      <span className='text-sm font-semibold text-text-secondary'>{initials}</span>
                    </div>
                  )}
                  <div className='flex flex-col min-w-0'>
                    <span className='text-sm font-semibold text-text-primary truncate'>
                      {user.name}
                    </span>
                    <span className='text-xs text-text-muted truncate'>{user.email}</span>
                  </div>
                </div>

                <ul className='flex flex-col gap-1 pl-1'>
                  <li>
                    <Link
                      to='/account'
                      onClick={onClose}
                      className='flex items-center gap-3 py-2 text-sm font-medium text-text-secondary hover:text-accent-primary transition-colors'
                    >
                      <User size={16} aria-hidden='true' />
                      {m.nav_profile()}
                    </Link>
                  </li>
                  {user.role === 'customer' && (
                    <li>
                      <Link
                        to='/sell'
                        onClick={onClose}
                        className='flex items-center gap-3 py-2 text-sm font-medium text-text-secondary hover:text-accent-primary transition-colors'
                      >
                        <Sparkles size={16} aria-hidden='true' />
                        {m.nav_start_selling()}
                      </Link>
                    </li>
                  )}
                  {(user.role === 'creator' || user.role === 'admin') && (
                    <li>
                      <Link
                        to='/studio'
                        onClick={onClose}
                        className='flex items-center gap-3 py-2 text-sm font-medium text-text-secondary hover:text-accent-primary transition-colors'
                      >
                        <Store size={16} aria-hidden='true' />
                        {m.nav_my_shop()}
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link
                      to='/account/settings'
                      onClick={onClose}
                      className='flex items-center gap-3 py-2 text-sm font-medium text-text-secondary hover:text-accent-primary transition-colors'
                    >
                      <Settings size={16} aria-hidden='true' />
                      {m.nav_settings()}
                    </Link>
                  </li>
                  <li>
                    <button
                      type='button'
                      onClick={handleSignOut}
                      className='flex w-full items-center gap-3 py-2 text-sm font-medium text-error hover:text-error-hover transition-colors outline-none text-left cursor-pointer'
                    >
                      <LogOut size={16} aria-hidden='true' />
                      {m.nav_sign_out()}
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <div className='border-t border-border-default/40 pt-4 mt-4'>
                <Link
                  to='/signin'
                  onClick={onClose}
                  className='flex items-center justify-center w-full rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-text-on-primary shadow-sm hover:bg-accent-primary-hover transition-colors no-underline'
                >
                  {m.nav_sign_in()}
                </Link>
              </div>
            )}
          </nav>

          {/* Footer Controls */}
          <div className='border-t border-border-default pt-4 mt-auto space-y-4'>
            {/* Locale Selector */}
            <div className='flex flex-col gap-2'>
              <span className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                Language
              </span>
              <div className='flex items-center gap-1 bg-surface-inset p-1 rounded-lg border border-border-default w-fit'>
                {locales.map((locale) => {
                  const isActive = locale === getLocale()
                  return (
                    <button
                      key={locale}
                      type='button'
                      onClick={() => {
                        setLocale(locale)
                        onClose()
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-fast cursor-pointer ${
                        isActive
                          ? 'bg-surface-default text-text-primary shadow-sm border border-border-default/10'
                          : 'text-text-secondary hover:bg-surface-default/50 hover:text-text-primary'
                      }`}
                    >
                      {locale}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Theme Toggle */}
            <div className='flex flex-col gap-2'>
              <span className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                Theme
              </span>
              <div className='flex items-center gap-2.5'>
                <ThemeToggle />
                <span className='text-sm text-text-secondary font-medium'>Toggle Light/Dark</span>
              </div>
            </div>
          </div>
        </BaseDialog.Popup>
      </DialogPortal>
    </Dialog>
  )
}
