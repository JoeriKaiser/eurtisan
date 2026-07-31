import { describe, expect, it } from 'vitest'
import { formatReviewerName } from './display-name'

describe('formatReviewerName', () => {
  it('shortens a full name to first name and initial', () => {
    expect(formatReviewerName('Joeri Kaiser')).toBe('Joeri K.')
  })

  it('uses the last name for the initial, not the middle one', () => {
    expect(formatReviewerName('Anna Maria de Vries')).toBe('Anna V.')
  })

  it('leaves a single name alone rather than inventing an initial', () => {
    expect(formatReviewerName('Prince')).toBe('Prince')
  })

  it('tolerates the whitespace real sign-up data carries', () => {
    expect(formatReviewerName('  Joeri   Kaiser  ')).toBe('Joeri K.')
  })

  it('uppercases a lowercase initial', () => {
    expect(formatReviewerName('joeri kaiser')).toBe('joeri K.')
  })

  it('keeps an astral initial whole', () => {
    // Slicing by code unit here would emit half a surrogate pair and render as
    // a replacement character.
    expect(formatReviewerName('Li 𐐨lias')).toBe('Li 𐐀.')
  })

  it('returns empty rather than a stray dot when there is no name', () => {
    // The caller renders a localized fallback; this stays locale-free.
    expect(formatReviewerName(null)).toBe('')
    expect(formatReviewerName(undefined)).toBe('')
    expect(formatReviewerName('   ')).toBe('')
  })
})
