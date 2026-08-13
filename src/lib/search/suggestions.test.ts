import { describe, expect, it } from 'vitest'

import { buildSuggestions, humanizeSlug } from './suggestions'

const product = (name: string, slug: string, shopSlug: string | null = 'shop') => ({
  name,
  slug,
  shopSlug,
})

describe('buildSuggestions', () => {
  it('returns nothing for a blank query', () => {
    expect(buildSuggestions('   ', [product('Mug', 'mug')])).toEqual([])
  })

  it('always leads with the raw query so Enter is predictable', () => {
    const suggestions = buildSuggestions('mug', [product('Ceramic Mug', 'ceramic-mug')])
    expect(suggestions[0]).toEqual({ type: 'query', label: 'mug' })
  })

  it('links products through their shop', () => {
    const [, first] = buildSuggestions('mug', [product('Ceramic Mug', 'ceramic-mug', 'clay-co')])
    expect(first).toMatchObject({
      type: 'product',
      label: 'Ceramic Mug',
      href: '/shops/clay-co/products/ceramic-mug',
    })
  })

  it('falls back to an unknown shop slug rather than emitting a broken link', () => {
    const [, first] = buildSuggestions('mug', [product('Ceramic Mug', 'ceramic-mug', null)])
    expect(first.href).toBe('/shops/unknown/products/ceramic-mug')
  })

  it('does not repeat a product whose name equals the query', () => {
    const suggestions = buildSuggestions('Ceramic Mug', [product('ceramic mug', 'ceramic-mug')])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].type).toBe('query')
  })

  it('de-duplicates products sharing a name', () => {
    const suggestions = buildSuggestions('mug', [
      product('Ceramic Mug', 'a'),
      product('Ceramic Mug', 'b'),
    ])
    expect(suggestions.filter((s) => s.type === 'product')).toHaveLength(1)
  })

  it('appends at most two category shortcuts', () => {
    const suggestions = buildSuggestions(
      'mug',
      [],
      [
        { slug: 'pottery', name: 'Pottery' },
        { slug: 'tableware', name: 'Tableware' },
        { slug: 'gifts', name: 'Gifts' },
      ],
    )
    expect(suggestions.filter((s) => s.type === 'category')).toHaveLength(2)
  })

  it('derives a readable label when a category has no name', () => {
    const suggestions = buildSuggestions('x', [], [{ slug: 'home-decor', name: '' }])
    expect(suggestions.at(-1)).toMatchObject({ type: 'category', label: 'Home Decor' })
  })

  it('caps the list at eight entries', () => {
    const products = Array.from({ length: 20 }, (_, i) => product(`Mug ${i}`, `mug-${i}`))
    expect(buildSuggestions('mug', products)).toHaveLength(8)
  })

  it('skips products missing a slug', () => {
    const suggestions = buildSuggestions('mug', [product('Broken', '')])
    expect(suggestions.filter((s) => s.type === 'product')).toHaveLength(0)
  })
})

describe('humanizeSlug', () => {
  it('turns a slug into title-cased words', () => {
    expect(humanizeSlug('wool-scarves')).toBe('Wool Scarves')
  })
})
