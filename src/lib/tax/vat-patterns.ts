/**
 * Shared VAT validation patterns used by both client and server validators.
 *
 * This module must remain free of `.server.ts` imports so it can safely be
 * imported from client code.
 */

export const EU_VAT_REGEXES: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/, // Austria
  BE: /^BE[01]\d{9}$/, // Belgium
  BG: /^BG\d{9,10}$/, // Bulgaria
  CY: /^CY\d{8}[A-Z]$/, // Cyprus
  CZ: /^CZ\d{8,10}$/, // Czech Republic
  DE: /^DE\d{9}$/, // Germany
  DK: /^DK\d{8}$/, // Denmark
  EE: /^EE\d{9}$/, // Estonia
  EL: /^EL\d{9}$/, // Greece (VIES prefix)
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, // Spain
  FI: /^FI\d{8}$/, // Finland
  FR: /^FR[A-Z0-9]{2}\d{9}$/, // France
  GR: /^GR\d{9}$/, // Greece (ISO prefix, accepted for convenience)
  HR: /^HR\d{11}$/, // Croatia
  HU: /^HU\d{8}$/, // Hungary
  IE: /^IE(\d{7}[A-W]|\d[A-Z0-9+*]\d{5}[A-W])$/, // Ireland
  IT: /^IT\d{11}$/, // Italy
  LT: /^LT(\d{9}|\d{12})$/, // Lithuania
  LU: /^LU\d{8}$/, // Luxembourg
  LV: /^LV\d{11}$/, // Latvia
  MT: /^MT\d{8}$/, // Malta
  NL: /^NL\d{9}B\d{2}$/, // Netherlands
  PL: /^PL\d{10}$/, // Poland
  PT: /^PT\d{9}$/, // Portugal
  RO: /^RO\d{2,10}$/, // Romania
  SE: /^SE\d{12}$/, // Sweden
  SI: /^SI\d{8}$/, // Slovenia
  SK: /^SK\d{10}$/, // Slovakia
}

/**
 * Validates the format of a VAT ID offline using country-specific regexes.
 *
 * Greek VAT IDs use the VIES prefix `EL` but shop/buyer addresses use the
 * ISO code `GR`. This helper accepts either prefix when `countryCode` is `GR`.
 */
export function isVatIdFormatValid(vatId: string, countryCode: string): boolean {
  const normalizedCountry = countryCode.toUpperCase().trim()
  const cleanVat = vatId.toUpperCase().replace(/[\s.-]+/g, '')

  // Greece: allow both EL (VIES) and GR (ISO) prefixes when address country is GR.
  if (normalizedCountry === 'GR') {
    return (
      (EU_VAT_REGEXES.EL?.test(cleanVat) ?? false) || (EU_VAT_REGEXES.GR?.test(cleanVat) ?? false)
    )
  }

  const pattern = EU_VAT_REGEXES[normalizedCountry]
  if (!pattern) return false

  return pattern.test(cleanVat)
}
