import { describe, expect, it } from 'vitest'

import { parseHighlightedText, stripHighlightTags } from './highlight'

describe('parseHighlightedText', () => {
  it('splits a highlighted term from its surrounding text', () => {
    expect(parseHighlightedText('Ceramic <em>Mug</em> set')).toEqual([
      { text: 'Ceramic ', highlighted: false },
      { text: 'Mug', highlighted: true },
      { text: ' set', highlighted: false },
    ])
  })

  it('handles multiple highlights', () => {
    const segments = parseHighlightedText('<em>Wool</em> and <em>linen</em>')
    expect(segments.filter((s) => s.highlighted).map((s) => s.text)).toEqual(['Wool', 'linen'])
  })

  it('returns a single plain segment when nothing matched', () => {
    expect(parseHighlightedText('Plain name')).toEqual([{ text: 'Plain name', highlighted: false }])
  })

  it('treats an unclosed tag as plain text rather than throwing', () => {
    expect(parseHighlightedText('Broken <em>name')).toEqual([
      { text: 'Broken <em>name', highlighted: false },
    ])
  })

  it('keeps embedded markup as literal text so it can never be rendered as HTML', () => {
    // Meilisearch does not escape document content, so a product name
    // containing markup arrives intact. It must stay a text segment.
    const segments = parseHighlightedText('<em>Vase</em> <script>alert(1)</script>')
    expect(segments).toContainEqual({ text: ' <script>alert(1)</script>', highlighted: false })
  })

  it('skips empty highlight spans', () => {
    expect(parseHighlightedText('a<em></em>b')).toEqual([
      { text: 'a', highlighted: false },
      { text: 'b', highlighted: false },
    ])
  })

  it('is reusable across calls despite the shared regex', () => {
    const input = '<em>one</em> two <em>three</em>'
    expect(parseHighlightedText(input)).toEqual(parseHighlightedText(input))
  })
})

describe('stripHighlightTags', () => {
  it('recovers the original text', () => {
    expect(stripHighlightTags('Ceramic <em>Mug</em> set')).toBe('Ceramic Mug set')
  })
})
