import { describe, expect, it } from 'vitest'
import { containsProfanity } from './profanity'

describe('containsProfanity', () => {
  it('detects blocked terms', () => {
    expect(containsProfanity('this is shit')).toBe(true)
  })

  it('allows clean text', () => {
    expect(containsProfanity('Beautiful handmade vase')).toBe(false)
  })
})
