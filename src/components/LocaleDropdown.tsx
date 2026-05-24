import { Globe } from 'lucide-react'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from './ui/primitives/dropdown-menu'

export default function LocaleDropdown() {
  const currentLocale = getLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className='flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset focus-visible:bg-bg-inset outline-none'
        aria-label='Select language'
      >
        <Globe size={18} aria-hidden='true' />
        <span className='uppercase font-semibold tracking-wide text-xs sm:inline'>
          {currentLocale}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuPopup className='w-24 min-w-[6rem] p-1'>
          {locales.map((locale) => {
            const isActive = locale === currentLocale
            return (
              <DropdownMenuItem
                key={locale}
                onClick={() => setLocale(locale)}
                data-active={isActive}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors duration-fast ease-out ${
                  isActive
                    ? 'bg-text-primary text-text-on-primary hover:bg-text-primary hover:text-text-on-primary'
                    : 'text-text-secondary hover:bg-bg-inset hover:text-text-primary'
                }`}
              >
                <span>{locale}</span>
                {isActive && (
                  <span className='size-1.5 rounded-full bg-accent-primary' aria-hidden='true' />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuPopup>
      </DropdownMenuPortal>
    </DropdownMenu>
  )
}
