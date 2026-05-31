import z from 'zod'

/**
 * ISO-3166-1 alpha-2 country codes for European countries (primary marketplace
 * coverage) plus a handful of neighbouring states.
 */
export const EU_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'CH',
  'GB',
  'UK',
  'IS',
  'LI',
  'NO',
  'ME',
  'MK',
  'AL',
  'RS',
  'TR',
  'UA',
  'BY',
  'MD',
  'AD',
  'MC',
  'SM',
  'VA',
  'BA',
  'XK',
])

export const isoCountryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Country must be a valid ISO-3166-1 alpha-2 code')
  .refine(
    (code) => EU_COUNTRY_CODES.has(code),
    (code) => ({ message: `${code} is not a supported country code` }),
  )

/**
 * Country-specific postal-code patterns for major European markets.
 * Keys are ISO-3166-1 alpha-2 codes.
 */
export const POSTAL_CODE_PATTERNS: Record<string, RegExp> = {
  FR: /^\d{5}$/,
  DE: /^\d{5}$/,
  ES: /^\d{5}$/,
  IT: /^\d{5}$/,
  NL: /^\d{4}\s?[A-Z]{2}$/,
  BE: /^\d{4}$/,
  AT: /^\d{4}$/,
  PT: /^\d{4}(-\d{3})?$/,
  PL: /^\d{2}-\d{3}$/,
  IE: /^[A-Z0-9]{3}\s?[A-Z0-9]{4}$/i,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
  UK: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
  SE: /^\d{3}\s?\d{2}$/,
  DK: /^\d{4}$/,
  FI: /^\d{5}$/,
  NO: /^\d{4}$/,
  CH: /^\d{4}$/,
  LU: /^\d{4}$/,
  CZ: /^\d{3}\s?\d{2}$/,
  SK: /^\d{3}\s?\d{2}$/,
  HU: /^\d{4}$/,
  SI: /^\d{4}$/,
  HR: /^\d{5}$/,
  LT: /^\d{5}$/,
  LV: /^\d{4}$/,
  EE: /^\d{5}$/,
  GR: /^\d{3}\s?\d{2}$/,
  CY: /^\d{4}$/,
  MT: /^[A-Z]{3}\s?\d{4}$/i,
  BG: /^\d{4}$/,
  RO: /^\d{6}$/,
}

/**
 * Fallback postal-code regex for countries without a specific pattern.
 * Allows alphanumeric characters, spaces, and hyphens (3–20 chars).
 */
export const GENERIC_POSTAL_CODE_REGEX = /^[A-Za-z0-9\s-]{3,20}$/u

/**
 * Validate a postal code against a country-specific pattern (if known) or a
 * generic fallback.
 */
export function isPostalCodeValid(postalCode: string, country: string): boolean {
  const regex = POSTAL_CODE_PATTERNS[country] ?? GENERIC_POSTAL_CODE_REGEX
  return regex.test(postalCode)
}
