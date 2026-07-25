/**
 * Parsing for Meilisearch's `_formatted` highlight output.
 *
 * Meilisearch inserts the configured tags into the *original* document text
 * without HTML-escaping the rest of it, so a product name containing markup
 * would come back with that markup intact. Rendering the string as HTML would
 * therefore be an injection vector. Instead we split it into plain segments and
 * let React render them as text nodes.
 */

/** Tags requested from Meilisearch via highlightPreTag / highlightPostTag. */
export const HIGHLIGHT_PRE_TAG = '<em>'
export const HIGHLIGHT_POST_TAG = '</em>'

export interface HighlightSegment {
  text: string
  highlighted: boolean
}

const SEGMENT_PATTERN = /<em>([\s\S]*?)<\/em>/g

/**
 * Split formatted text into highlighted and plain segments.
 *
 * Unmatched or malformed tags degrade to plain text rather than throwing: the
 * worst case is a missing highlight, never broken output.
 */
export function parseHighlightedText(formatted: string): HighlightSegment[] {
  const segments: HighlightSegment[] = []
  let lastIndex = 0

  SEGMENT_PATTERN.lastIndex = 0
  let match = SEGMENT_PATTERN.exec(formatted)
  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: formatted.slice(lastIndex, match.index), highlighted: false })
    }
    if (match[1].length > 0) {
      segments.push({ text: match[1], highlighted: true })
    }
    lastIndex = match.index + match[0].length
    match = SEGMENT_PATTERN.exec(formatted)
  }

  if (lastIndex < formatted.length) {
    segments.push({ text: formatted.slice(lastIndex), highlighted: false })
  }

  return segments
}

/** Recover the original text by discarding highlight markers. */
export function stripHighlightTags(formatted: string): string {
  return parseHighlightedText(formatted)
    .map((segment) => segment.text)
    .join('')
}
