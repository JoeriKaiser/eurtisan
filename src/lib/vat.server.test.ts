import { describe, expect, it } from 'vitest'
import { calculateVat, normalizeCountryCode } from './vat.server'
import { validateVatId } from './vat'

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
})
