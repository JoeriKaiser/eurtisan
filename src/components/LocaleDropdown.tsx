import { Check, Globe } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from './ui/primitives/dropdown-menu'

const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  nl: 'Nederlands',
}

export default function LocaleDropdown() {
  const currentLocale = getLocale()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className='flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset focus-visible:bg-bg-inset outline-none'
        aria-label={m.mobile_nav_language()}
      >
        <Globe size={18} aria-hidden='true' />
        <span className='uppercase font-semibold tracking-wide text-xs sm:inline'>
          {currentLocale}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuPopup size='compact' align='end' className='p-1'>
          {locales.map((locale) => {
            const isActive = locale === currentLocale
            return (
              <DropdownMenuItem
                key={locale}
                onClick={() => setLocale(locale)}
                data-active={isActive ? '' : undefined}
                className='justify-between px-3 py-2 text-sm data-[active]:bg-accent-primary-subtle data-[active]:text-accent-primary data-[active]:hover:bg-accent-primary-subtle'
              >
                <span>{LOCALE_LABELS[locale] ?? locale.toUpperCase()}</span>
                {isActive && <Check size={15} strokeWidth={2.25} aria-hidden='true' />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuPopup>
      </DropdownMenuPortal>
    </DropdownMenu>
  )
}
