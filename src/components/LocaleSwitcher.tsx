import { getLocale, locales, setLocale } from '#/paraglide/runtime'

export default function LocaleSwitcher() {
  return (
    <div className='fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-1 shadow-[0_8px_24px_rgba(30,90,72,0.08)]'>
      {locales.map((locale) => (
        <button
          key={locale}
          type='button'
          onClick={() => setLocale(locale)}
          data-active-locale={locale === getLocale()}
          className='rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)] data-[active-locale=true]:bg-[var(--sea-ink)] data-[active-locale=true]:text-white'
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
