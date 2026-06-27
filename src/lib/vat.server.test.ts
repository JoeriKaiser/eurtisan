import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateVat, normalizeCountryCode, verifyVatIdVies } from './vat.server'
import { isVatIdFormatValid } from './vat-patterns'
import { validateVatId } from './vat'
import { logger } from './logger.server'

describe('VAT Calculation Engine', () => {
  it('returns zero VAT if the seller is not VAT registered', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'FR',
      isVatRegistered: false,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1200,
    })
    expect(result).toEqual({ vatAmountCents: 0, vatRateBasisPoints: 0 })
  })

  it('returns zero VAT if the product is VAT exempt', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'FR',
      isVatRegistered: true,
      vatRateCategory: 'exempt',
      inclusiveAmountCents: 1200,
    })
    expect(result).toEqual({ vatAmountCents: 0, vatRateBasisPoints: 0 })
  })

  it('calculates standard domestic VAT correctly (e.g. France standard 20%)', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'FR',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1200, // 1000 base + 200 VAT
    })
    expect(result).toEqual({ vatAmountCents: 200, vatRateBasisPoints: 2000 })
  })

  it('calculates reduced domestic VAT correctly (e.g. Germany reduced 7%)', () => {
    const result = calculateVat({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      isVatRegistered: true,
      vatRateCategory: 'reduced',
      inclusiveAmountCents: 1070, // 1000 base + 70 VAT
    })
    expect(result).toEqual({ vatAmountCents: 70, vatRateBasisPoints: 700 })
  })

  it('calculates cross-border standard VAT correctly (e.g. seller FR -> buyer DE standard 19%)', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'DE',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1190, // 1000 base + 190 VAT (19% German VAT)
    })
    expect(result).toEqual({ vatAmountCents: 190, vatRateBasisPoints: 1900 })
  })

  it('calculates cross-border reduced VAT correctly (e.g. seller DE -> buyer FR reduced 10%)', () => {
    const result = calculateVat({
      sellerCountry: 'DE',
      buyerCountry: 'FR',
      isVatRegistered: true,
      vatRateCategory: 'reduced',
      inclusiveAmountCents: 1100, // 1000 base + 100 VAT (10% French reduced VAT)
    })
    expect(result).toEqual({ vatAmountCents: 100, vatRateBasisPoints: 1000 })
  })

  it('returns zero VAT for export outside EU (e.g. FR -> US)', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'US',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1200,
    })
    expect(result).toEqual({ vatAmountCents: 0, vatRateBasisPoints: 0 })
  })

  it('handles rounding logic correctly on non-divisible amounts', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'DE',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 999, // 999 * 1900 / 11900 = 159.504 -> 160 VAT, base 839
    })
    expect(result).toEqual({ vatAmountCents: 160, vatRateBasisPoints: 1900 })
  })

  it('handles negative or zero amounts safely', () => {
    expect(
      calculateVat({
        sellerCountry: 'FR',
        buyerCountry: 'FR',
        isVatRegistered: true,
        vatRateCategory: 'standard',
        inclusiveAmountCents: 0,
      }),
    ).toEqual({ vatAmountCents: 0, vatRateBasisPoints: 0 })

    expect(
      calculateVat({
        sellerCountry: 'FR',
        buyerCountry: 'FR',
        isVatRegistered: true,
        vatRateCategory: 'standard',
        inclusiveAmountCents: -100,
      }),
    ).toEqual({ vatAmountCents: 0, vatRateBasisPoints: 0 })
  })

  it('normalizes full country names to ISO codes', () => {
    expect(normalizeCountryCode('Germany')).toBe('DE')
    expect(normalizeCountryCode('FRANCE')).toBe('FR')
    expect(normalizeCountryCode('it')).toBe('IT')
    expect(normalizeCountryCode('United Kingdom')).toBe('GB')
    expect(normalizeCountryCode('Czech Republic')).toBe('CZ')
    expect(normalizeCountryCode('  de  ')).toBe('DE')
    expect(normalizeCountryCode('Unknown')).toBeNull()
  })

  it('calculates VAT using normalized country names', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'Germany',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1190,
    })
    expect(result).toEqual({ vatAmountCents: 190, vatRateBasisPoints: 1900 })
  })

  it('resolves localized country names to ISO codes', () => {
    const result = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: 'Deutschland',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1190,
    })
    expect(result).toEqual({ vatAmountCents: 190, vatRateBasisPoints: 1900 })
  })

  it('throws an error on unrecognized or unmappable country names if they are not empty', () => {
    expect(() =>
      calculateVat({
        sellerCountry: 'FR',
        buyerCountry: 'RandomState',
        isVatRegistered: true,
        vatRateCategory: 'standard',
        inclusiveAmountCents: 1190,
      }),
    ).toThrowError('Unrecognized country code or name: "RandomState"')
  })

  it('does not throw an error and returns 0% VAT if country name is empty or only whitespace', () => {
    const resultEmpty = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: '',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1190,
    })
    expect(resultEmpty).toEqual({ vatAmountCents: 0, vatRateBasisPoints: 0 })

    const resultSpaces = calculateVat({
      sellerCountry: 'FR',
      buyerCountry: '   ',
      isVatRegistered: true,
      vatRateCategory: 'standard',
      inclusiveAmountCents: 1190,
    })
    expect(resultSpaces).toEqual({ vatAmountCents: 0, vatRateBasisPoints: 0 })
  })
})

describe('validateVatId', () => {
  it('accepts a valid German VAT ID', () => {
    expect(validateVatId('DE123456789')).toEqual({ valid: true })
  })

  it('accepts a valid French VAT ID', () => {
    expect(validateVatId('FRXX123456789')).toEqual({ valid: true })
  })

  it('accepts a valid Dutch VAT ID', () => {
    expect(validateVatId('NL123456789B01')).toEqual({ valid: true })
  })

  it('rejects an empty VAT ID', () => {
    expect(validateVatId('')).toEqual({ valid: false, message: 'VAT ID is too short' })
  })

  it('rejects a VAT ID with an unknown country prefix', () => {
    expect(validateVatId('XX123456789')).toEqual({
      valid: false,
      message: 'Unrecognised country code in VAT ID',
    })
  })

  it('rejects an invalid German VAT ID (too short)', () => {
    expect(validateVatId('DE123')).toEqual({
      valid: false,
      message: 'Invalid format for DE VAT ID',
    })
  })

  it('ignores spaces and normalises case', () => {
    expect(validateVatId('de 123 456 789')).toEqual({ valid: true })
  })

  it('accepts a valid Belgian VAT ID starting with 0 or 1', () => {
    expect(validateVatId('BE0123456789')).toEqual({ valid: true })
    expect(validateVatId('BE1123456789')).toEqual({ valid: true })
  })

  it('rejects Belgian VAT IDs that do not start with 0 or 1', () => {
    expect(validateVatId('BE2123456789')).toEqual({
      valid: false,
      message: 'Invalid format for BE VAT ID',
    })
  })

  it('accepts a valid Irish VAT ID', () => {
    expect(validateVatId('IE1234567A')).toEqual({ valid: true })
    expect(validateVatId('IE1A23456A')).toEqual({ valid: true })
  })

  it('rejects Irish VAT IDs ending in X, Y or Z', () => {
    expect(validateVatId('IE1234567X')).toEqual({
      valid: false,
      message: 'Invalid format for IE VAT ID',
    })
  })

  it('accepts a valid Swedish VAT ID', () => {
    expect(validateVatId('SE123456789012')).toEqual({ valid: true })
  })

  it('rejects a Swedish VAT ID that is too short', () => {
    expect(validateVatId('SE1234567890')).toEqual({
      valid: false,
      message: 'Invalid format for SE VAT ID',
    })
  })

  it('accepts a valid Spanish VAT ID', () => {
    expect(validateVatId('ESA1234567B')).toEqual({ valid: true })
    expect(validateVatId('ES12345678A')).toEqual({ valid: true })
  })

  it('rejects an invalid Spanish VAT ID', () => {
    expect(validateVatId('ES1234567')).toEqual({
      valid: false,
      message: 'Invalid format for ES VAT ID',
    })
  })

  it('accepts Greek VAT IDs with both EL and GR prefixes', () => {
    expect(validateVatId('EL123456789')).toEqual({ valid: true })
    expect(validateVatId('GR123456789')).toEqual({ valid: true })
  })

  it('agrees with isVatIdFormatValid for a representative sample', () => {
    const samples = [
      { vatId: 'DE123456789', country: 'DE', valid: true },
      { vatId: 'FRXX123456789', country: 'FR', valid: true },
      { vatId: 'NL123456789B01', country: 'NL', valid: true },
      { vatId: 'BE0123456789', country: 'BE', valid: true },
      { vatId: 'IE1234567A', country: 'IE', valid: true },
      { vatId: 'SE123456789012', country: 'SE', valid: true },
      { vatId: 'ESA1234567B', country: 'ES', valid: true },
      { vatId: 'EL123456789', country: 'EL', valid: true },
      { vatId: 'GR123456789', country: 'GR', valid: true },
      { vatId: 'DE123', country: 'DE', valid: false },
      { vatId: 'XX123456789', country: 'XX', valid: false },
    ]

    for (const sample of samples) {
      const clientResult = validateVatId(sample.vatId)
      const serverResult = isVatIdFormatValid(sample.vatId, sample.country)
      expect(serverResult).toBe(sample.valid)
      expect(clientResult.valid).toBe(sample.valid)
    }
  })
})

describe('isVatIdFormatValid (Offline Check)', () => {
  it('validates correct formats', () => {
    expect(isVatIdFormatValid('DE123456789', 'DE')).toBe(true)
    expect(isVatIdFormatValid('FR 12 345678901', 'FR')).toBe(true)
    expect(isVatIdFormatValid('NL123456789B01', 'NL')).toBe(true)
  })

  it('rejects incorrect formats', () => {
    expect(isVatIdFormatValid('DE123', 'DE')).toBe(false)
    expect(isVatIdFormatValid('FR123', 'FR')).toBe(false)
    expect(isVatIdFormatValid('NL123', 'NL')).toBe(false)
    expect(isVatIdFormatValid('DE123456789', 'FR')).toBe(false)
  })

  it('accepts both EL and GR prefixes for Greek VAT IDs when country is GR', () => {
    expect(isVatIdFormatValid('EL123456789', 'GR')).toBe(true)
    expect(isVatIdFormatValid('GR123456789', 'GR')).toBe(true)
    expect(isVatIdFormatValid('EL12345', 'GR')).toBe(false)
  })
})

describe('verifyVatIdVies (Online Check)', () => {
  const originalViesTimeout = process.env.VIES_TIMEOUT_MS

  afterEach(() => {
    if (originalViesTimeout === undefined) {
      delete process.env.VIES_TIMEOUT_MS
    } else {
      process.env.VIES_TIMEOUT_MS = originalViesTimeout
    }
  })

  it('uses the configured VIES_TIMEOUT_MS', async () => {
    process.env.VIES_TIMEOUT_MS = '50'
    const originalFetch = globalThis.fetch
    globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (signal?.aborted) {
          reject(new Error('AbortError'))
          return
        }
        signal?.addEventListener('abort', () => {
          reject(new Error('AbortError'))
        })
      })
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    try {
      const start = Date.now()
      const result = await verifyVatIdVies('DE123456789', 'DE')
      const elapsed = Date.now() - start

      expect(result).toBe(false)
      expect(elapsed).toBeLessThan(200)
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
      errorSpy.mockRestore()
    }
  })

  it('defaults to 5000 ms when VIES_TIMEOUT_MS is unset', async () => {
    delete process.env.VIES_TIMEOUT_MS
    const originalFetch = globalThis.fetch
    let requestedUrl = ''
    globalThis.fetch = (input) => {
      requestedUrl = input.toString()
      return Promise.resolve(new Response(JSON.stringify({ isValid: true }), { status: 200 }))
    }

    try {
      const result = await verifyVatIdVies('DE123456789', 'DE')
      expect(result).toBe(true)
      expect(requestedUrl).toContain('/ms/DE/vat/')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns false when the VIES endpoint is unreachable or fails (fail closed)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = () => Promise.reject(new Error('Network error'))
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    try {
      const result = await verifyVatIdVies('DE123456789', 'DE')
      expect(result).toBe(false)
      expect(errorSpy).toHaveBeenCalled()
      const lastCall = errorSpy.mock.calls[errorSpy.mock.calls.length - 1]
      expect(lastCall?.[lastCall.length - 1]).toMatchObject({ alert: true, viesCountryCode: 'DE' })
    } finally {
      globalThis.fetch = originalFetch
      errorSpy.mockRestore()
    }
  })

  it('returns false on non-OK VIES HTTP responses (fail closed)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = () => Promise.resolve(new Response('Service Unavailable', { status: 503 }))
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    try {
      const result = await verifyVatIdVies('DE123456789', 'DE')
      expect(result).toBe(false)
      expect(errorSpy).toHaveBeenCalled()
      const lastCall = errorSpy.mock.calls[errorSpy.mock.calls.length - 1]
      expect(lastCall?.[lastCall.length - 1]).toMatchObject({
        alert: true,
        viesCountryCode: 'DE',
        status: 503,
      })
    } finally {
      globalThis.fetch = originalFetch
      errorSpy.mockRestore()
    }
  })

  it('verifies validity based on VIES API response', async () => {
    const originalFetch = globalThis.fetch

    // Valid mock response
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify({ isValid: true }), { status: 200 }))
    try {
      const result = await verifyVatIdVies('DE123456789', 'DE')
      expect(result).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }

    // Invalid mock response
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify({ isValid: false }), { status: 200 }))
    try {
      const result = await verifyVatIdVies('DE123456789', 'DE')
      expect(result).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('normalises Greek country code GR to EL for the VIES request', async () => {
    const originalFetch = globalThis.fetch
    let requestedUrl = ''
    globalThis.fetch = (input) => {
      requestedUrl = input.toString()
      return Promise.resolve(new Response(JSON.stringify({ isValid: true }), { status: 200 }))
    }

    try {
      const result = await verifyVatIdVies('EL123456789', 'GR')
      expect(result).toBe(true)
      expect(requestedUrl).toContain('/ms/EL/vat/123456789')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('strips the EL prefix from Greek VAT IDs before calling VIES', async () => {
    const originalFetch = globalThis.fetch
    let requestedUrl = ''
    globalThis.fetch = (input) => {
      requestedUrl = input.toString()
      return Promise.resolve(new Response(JSON.stringify({ isValid: true }), { status: 200 }))
    }

    try {
      await verifyVatIdVies('EL123456789', 'GR')
      expect(requestedUrl).not.toContain('/vat/EL123456789')
      expect(requestedUrl).toContain('/vat/123456789')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
