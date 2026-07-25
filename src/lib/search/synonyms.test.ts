import { describe, expect, it } from 'vitest'

import { buildSynonyms, PRODUCT_SYNONYMS } from './synonyms'

describe('buildSynonyms', () => {
  it('expands every term in a group to the others', () => {
    expect(buildSynonyms([['mug', 'mok']])).toEqual({
      mug: ['mok'],
      mok: ['mug'],
    })
  })

  it('never maps a term to itself', () => {
    const synonyms = buildSynonyms([['bowl', 'kom', 'schaal']])
    for (const [term, expansions] of Object.entries(synonyms)) {
      expect(expansions).not.toContain(term)
    }
  })

  it('merges groups that share a term without duplicating expansions', () => {
    const synonyms = buildSynonyms([
      ['gift', 'cadeau'],
      ['gift', 'geschenk'],
    ])
    expect([...synonyms.gift].sort()).toEqual(['cadeau', 'geschenk'])
  })

  it('skips single-term groups', () => {
    expect(buildSynonyms([['solo']])).toEqual({})
  })
})

describe('PRODUCT_SYNONYMS', () => {
  it('bridges English and Dutch for common marketplace terms', () => {
    expect(PRODUCT_SYNONYMS.mug).toContain('mok')
    expect(PRODUCT_SYNONYMS.mok).toContain('mug')
    expect(PRODUCT_SYNONYMS.oorbellen).toContain('earrings')
  })

  it('is symmetric: every expansion maps back to its source', () => {
    for (const [term, expansions] of Object.entries(PRODUCT_SYNONYMS)) {
      for (const expansion of expansions) {
        expect(PRODUCT_SYNONYMS[expansion]).toContain(term)
      }
    }
  })
})
