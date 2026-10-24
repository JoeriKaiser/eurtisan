/**
 * Canonical registry of all 24 official European Union languages supported by Eurtisan.
 *
 * `en` is the base unprefixed locale; all other 23 locales use `/${locale}` URL prefixes.
 */

export const EU_LOCALES = [
  'en',
  'nl',
  'fr',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'et',
  'fi',
  'ga',
  'hr',
  'hu',
  'it',
  'lt',
  'lv',
  'mt',
  'pl',
  'pt',
  'ro',
  'sk',
  'sl',
  'sv',
] as const

export type EuLocale = (typeof EU_LOCALES)[number]

/** Non-base locales served under `/${locale}` URL prefixes. */
export const PREFIXED_EU_LOCALES = EU_LOCALES.filter(
  (locale): locale is Exclude<EuLocale, 'en'> => locale !== 'en',
)

/** URL prefixes for all non-base EU locales (e.g. `'/nl'`, `'/fr'`, `'/de'`). */
export const EU_LOCALE_PREFIXES = PREFIXED_EU_LOCALES.map((locale) => `/${locale}` as const)

/** Native autonym labels for locale selectors. */
export const EU_LOCALE_LABELS: Record<EuLocale, string> = {
  en: 'English',
  nl: 'Nederlands',
  fr: 'Français',
  bg: 'Български',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  es: 'Español',
  et: 'Eesti',
  fi: 'Suomi',
  ga: 'Gaeilge',
  hr: 'Hrvatski',
  hu: 'Magyar',
  it: 'Italiano',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  mt: 'Malti',
  pl: 'Polski',
  pt: 'Português',
  ro: 'Română',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sv: 'Svenska',
}

/** Open Graph `og:locale` territory tags for each EU language. */
export const EU_OG_LOCALES: Record<EuLocale, string> = {
  en: 'en_US',
  nl: 'nl_NL',
  fr: 'fr_FR',
  bg: 'bg_BG',
  cs: 'cs_CZ',
  da: 'da_DK',
  de: 'de_DE',
  el: 'el_GR',
  es: 'es_ES',
  et: 'et_EE',
  fi: 'fi_FI',
  ga: 'ga_IE',
  hr: 'hr_HR',
  hu: 'hu_HU',
  it: 'it_IT',
  lt: 'lt_LT',
  lv: 'lv_LV',
  mt: 'mt_MT',
  pl: 'pl_PL',
  pt: 'pt_PT',
  ro: 'ro_RO',
  sk: 'sk_SK',
  sl: 'sl_SI',
  sv: 'sv_SE',
}

/** ISO 639-3 three-letter language codes used by Meilisearch `localizedAttributes`. */
export const EU_ISO639_3_LOCALES = [
  'eng',
  'nld',
  'fra',
  'bul',
  'ces',
  'dan',
  'deu',
  'ell',
  'spa',
  'est',
  'fin',
  'gle',
  'hrv',
  'hun',
  'ita',
  'lit',
  'lav',
  'mlt',
  'pol',
  'por',
  'ron',
  'slk',
  'slv',
  'swe',
] as const

export function isEuLocale(value: unknown): value is EuLocale {
  return typeof value === 'string' && Object.hasOwn(EU_LOCALE_LABELS, value)
}

/** Resolves an arbitrary language tag (e.g. `"de-DE"`, `"nl"`, `"unknown"`) to a supported `EuLocale`. */
export function resolveEuLocale(value: unknown, fallback: EuLocale = 'en'): EuLocale {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (isEuLocale(normalized)) return normalized
  const primary = normalized.split(/[-_]/)[0]
  if (primary && isEuLocale(primary)) return primary
  return fallback
}

/**
 * Strips any EU locale prefix from a URL path in O(1) so routes and canonical URLs
 * normalize to a single locale-free path.
 */
export function stripEuLocalePrefix(path: string): string {
  const normalized = path.replace(/^\/+/, '/')
  if (normalized.length >= 3) {
    const code = normalized.slice(1, 3)
    const boundary = normalized.charAt(3)
    if (code !== 'en' && Object.hasOwn(EU_LOCALE_LABELS, code)) {
      if (boundary === '') return '/'
      if (boundary === '/') return normalized.slice(3)
      if (boundary === '?') return `/${normalized.slice(3)}`
    }
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}
