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

export const EU_VAT_RATES: Record<string, { standard: number; reduced: number }> = {
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

  // Check if buyer is in EU (by checking if the country has a VAT rate definition)
  const buyerCode = normalizeCountryCode(buyerCountry)
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
