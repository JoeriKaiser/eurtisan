const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  germany: 'DE',
  france: 'FR',
  italy: 'IT',
  spain: 'ES',
  netherlands: 'NL',
  belgium: 'BE',
  austria: 'AT',
  portugal: 'PT',
  poland: 'PL',
  ireland: 'IE',
  sweden: 'SE',
  denmark: 'DK',
  finland: 'FI',
  'united kingdom': 'GB',
  greece: 'GR',
  'czech republic': 'CZ',
  czechia: 'CZ',
  hungary: 'HU',
  romania: 'RO',
  bulgaria: 'BG',
  croatia: 'HR',
  cyprus: 'CY',
  estonia: 'EE',
  latvia: 'LV',
  lithuania: 'LT',
  luxembourg: 'LU',
  malta: 'MT',
  slovakia: 'SK',
  slovenia: 'SI',
  switzerland: 'CH',
  norway: 'NO',
  iceland: 'IS',
  liechtenstein: 'LI',
}

export function normalizeCountryCode(country: string): string | null {
  const trimmed = country.trim()
  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper
  }
  return COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()] ?? null
}

const EU_VAT_RATES: Record<string, { standard: number; reduced: number }> = {
  AT: { standard: 2000, reduced: 1000 },
  BE: { standard: 2100, reduced: 600 },
  BG: { standard: 2000, reduced: 900 },
  HR: { standard: 2500, reduced: 500 },
  CY: { standard: 1900, reduced: 900 },
  CZ: { standard: 2100, reduced: 1200 },
  DK: { standard: 2500, reduced: 2500 }, // Denmark has no reduced rate for most retail items
  EE: { standard: 2200, reduced: 900 },
  FI: { standard: 2400, reduced: 1400 },
  FR: { standard: 2000, reduced: 1000 },
  DE: { standard: 1900, reduced: 700 },
  GR: { standard: 2400, reduced: 1300 },
  HU: { standard: 2700, reduced: 500 },
  IE: { standard: 2300, reduced: 1350 },
  IT: { standard: 2200, reduced: 1000 },
  LV: { standard: 2100, reduced: 1200 },
  LT: { standard: 2100, reduced: 900 },
  LU: { standard: 1700, reduced: 800 },
  MT: { standard: 1800, reduced: 700 },
  NL: { standard: 2100, reduced: 900 },
  PL: { standard: 2300, reduced: 800 },
  PT: { standard: 2300, reduced: 1300 },
  RO: { standard: 1900, reduced: 900 },
  SK: { standard: 2000, reduced: 1000 },
  SI: { standard: 2200, reduced: 950 },
  ES: { standard: 2100, reduced: 1000 },
  SE: { standard: 2500, reduced: 1200 },
}

export function getStandardVatRate(country: string): number {
  const code = normalizeCountryCode(country)
  if (!code) return 0
  return EU_VAT_RATES[code]?.standard ?? 0
}

export interface VatCalculationInput {
  sellerCountry: string
  buyerCountry: string
  isVatRegistered: boolean
  vatRateCategory: 'standard' | 'reduced' | 'exempt'
  inclusiveAmountCents: number
}

export interface VatCalculationResult {
  vatAmountCents: number
  vatRateBasisPoints: number
}

/**
 * Calculate the VAT portion of an inclusive price in cents.
 * Follows EU destination country principles (OSS) for registered sellers,
 * and handles small business exemptions (0% VAT).
 */
export function calculateVat(input: VatCalculationInput): VatCalculationResult {
  const { buyerCountry, isVatRegistered, vatRateCategory, inclusiveAmountCents } = input

  if (!isVatRegistered || vatRateCategory === 'exempt' || inclusiveAmountCents <= 0) {
    return { vatAmountCents: 0, vatRateBasisPoints: 0 }
  }

  const buyerCode = normalizeCountryCode(buyerCountry)
  if (!buyerCode && buyerCountry.trim() !== '') {
    throw new Error(`Unrecognized country code or name: "${buyerCountry}"`)
  }

  const rates = buyerCode ? EU_VAT_RATES[buyerCode] : undefined
  if (!rates) {
    // Export out of the EU is VAT-exempt
    return { vatAmountCents: 0, vatRateBasisPoints: 0 }
  }

  let vatRateBasisPoints = 0
  if (vatRateCategory === 'reduced') {
    vatRateBasisPoints = rates.reduced
  } else {
    vatRateBasisPoints = rates.standard
  }

  // Base exclusive price: Round to nearest cent to ensure base + vat equals total exactly
  const baseAmountCents = Math.round((inclusiveAmountCents * 10000) / (10000 + vatRateBasisPoints))
  const vatAmountCents = inclusiveAmountCents - baseAmountCents

  return { vatAmountCents, vatRateBasisPoints }
}

/**
 * Strict alphanumeric validation patterns for EU VAT formats.
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
  EL: /^EL\d{9}$/, // Greece
  GR: /^GR\d{9}$/, // Greece (alternative country code)
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, // Spain
  FI: /^FI\d{8}$/, // Finland
  FR: /^FR[A-Z0-9]{2}\d{9}$/, // France
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
 */
export function isVatIdFormatValid(vatId: string, countryCode: string): boolean {
  const normalizedCountry = countryCode.toUpperCase().trim()
  const pattern = EU_VAT_REGEXES[normalizedCountry]
  if (!pattern) return false

  // Strip spaces, hyphens, and dots for a clean alphanumeric check
  const cleanVat = vatId.toUpperCase().replace(/[\s.-]+/g, '')
  return pattern.test(cleanVat)
}

/**
 * Verifies a VAT ID with the European Commission's public VIES API.
 * Aborts and returns true (graceful fallback) if the API is down or times out.
 */
export async function verifyVatIdVies(vatId: string, countryCode: string): Promise<boolean> {
  const cleanVat = vatId.toUpperCase().replace(/[\s.-]+/g, '')
  // Extract number part if it starts with the country code prefix
  const vatNumber = cleanVat.startsWith(countryCode) ? cleanVat.slice(2) : cleanVat

  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`VIES API returned status ${response.status} for ${countryCode}-${vatNumber}`)
      return true
    }

    const data = (await response.json()) as { isValid: boolean }
    return data.isValid
  } catch (err) {
    console.error(`VIES validation failed or timed out:`, err)
    // Fallback to true so downtime does not block checkout
    return true
  }
}
