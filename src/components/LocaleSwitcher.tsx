import { getLocale, locales, setLocale } from '#/paraglide/runtime'

export default function LocaleSwitcher() {
  return (
    <div className='fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-border-default bg-surface-default px-2 py-1 shadow-sm'>
      {locales.map((locale) => (
        <button
          key={locale}
          type='button'
          onClick={() => setLocale(locale)}
          data-active-locale={locale === getLocale()}
          className='rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary transition hover:bg-bg-inset hover:text-text-primary data-[active-locale=true]:bg-text-primary data-[active-locale=true]:text-text-on-primary'
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
