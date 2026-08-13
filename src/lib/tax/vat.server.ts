import { getAlpha2Code, getSupportedLanguages } from 'i18n-iso-countries'
import { EU_VAT_REGEXES, isVatIdFormatValid } from './vat-patterns'

export { EU_VAT_REGEXES, isVatIdFormatValid }

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

const SUPPORTED_LOCALES = getSupportedLanguages()

export function normalizeCountryCode(country: string): string | null {
  const trimmed = country.trim()
  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper
  }

  const lower = trimmed.toLowerCase()
  const fromStatic = COUNTRY_NAME_TO_CODE[lower]
  if (fromStatic) return fromStatic

  // Try localized country names across all supported ISO-639-1 locales.
  for (const locale of SUPPORTED_LOCALES) {
    try {
      const code = getAlpha2Code(trimmed, locale)
      if (code) return code.toUpperCase()
    } catch {
      // getAlpha2Code throws for unknown names in a given locale.
    }
  }

  return null
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

import { getViesTimeoutMs } from '#/lib/env.server'
import { logger } from '../logger.server'

/**
 * Verifies a VAT ID with the European Commission's public VIES API.
 *
 * VIES uses `EL` for Greece, so a `GR` country code is normalised to `EL` and
 * any `EL` prefix is stripped before calling the API.
 *
 * Failures are now fail-closed: any network, timeout, HTTP, or invalid JSON
 * error returns `false` and rejects checkout. An ops alert is emitted for
 * infrastructure failures so on-call can investigate.
 */
export async function verifyVatIdVies(vatId: string, countryCode: string): Promise<boolean> {
  const normalizedCountry = countryCode.toUpperCase().trim()
  // VIES expects EL for Greece; every other country uses its ISO code.
  const viesCountryCode = normalizedCountry === 'GR' ? 'EL' : normalizedCountry

  const cleanVat = vatId.toUpperCase().replace(/[\s.-]+/g, '')
  // Strip the VIES country prefix if present to leave only the numeric part.
  const vatNumber = cleanVat.startsWith(viesCountryCode) ? cleanVat.slice(2) : cleanVat

  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${viesCountryCode}/vat/${vatNumber}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), getViesTimeoutMs())

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      logger.error(
        `VIES API returned non-OK status ${response.status}`,
        new Error(`VIES HTTP ${response.status}`),
        { alert: true, viesCountryCode, status: response.status },
      )
      return false
    }

    const data = (await response.json()) as { isValid: boolean }
    return data.isValid === true
  } catch (err) {
    logger.error('VIES validation failed or timed out', err, { alert: true, viesCountryCode })
    return false
  }
}
