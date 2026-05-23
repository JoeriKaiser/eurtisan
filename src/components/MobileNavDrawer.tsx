import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { Link } from '@tanstack/react-router'
import { ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import { Dialog, DialogBackdrop, DialogPortal } from './ui/primitives/dialog'
import ThemeToggle from './ThemeToggle'

interface MobileNavDrawerProps {
  isOpen: boolean
  onClose: () => void
  categories: Array<{ id: string; name: string; slug: string }>
  isLoadingCategories: boolean
}

export default function MobileNavDrawer({
  isOpen,
  onClose,
  categories,
  isLoadingCategories,
}: MobileNavDrawerProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <BaseDialog.Popup
          className='fixed left-0 top-0 bottom-0 z-modal flex h-full w-72 max-w-[85vw] flex-col border-r border-border-default bg-surface-default p-6 shadow-xl outline-none transition-transform duration-base ease-out data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full'
          aria-label='Navigation Drawer'
        >
          {/* Header */}
          <div className='flex items-center justify-between border-b border-border-default pb-4 mb-6'>
            <Link
              to='/'
              onClick={onClose}
              className='flex items-center gap-2 text-lg font-bold tracking-tight text-text-primary no-underline transition-colors hover:text-accent-primary'
            >
              {/* Stylized geometric logo icon */}
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
            <BaseDialog.Close
              className='inline-flex items-center justify-center rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-inset hover:text-text-primary focus-visible:bg-bg-inset outline-none'
              aria-label='Close menu'
            >
              <X size={18} aria-hidden='true' />
            </BaseDialog.Close>
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
            {(isLoadingCategories || categories.length > 0) && (
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
                    {isLoadingCategories ? (
                      <li className='py-2'>
                        <div className='h-4 w-24 animate-pulse rounded bg-surface-inset' />
                      </li>
                    ) : (
                      categories.map((category) => (
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
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </nav>

          {/* Footer Controls */}
          <div className='border-t border-border-default pt-6 mt-auto space-y-6'>
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
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-fast ${
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
