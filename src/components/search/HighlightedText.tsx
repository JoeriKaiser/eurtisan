import { parseHighlightedText } from '#/lib/search/highlight'

interface HighlightedTextProps {
  /** Meilisearch `_formatted` value, or null when the engine did not supply one. */
  formatted: string | null
  /** Plain text rendered when no highlighting is available. */
  fallback: string
}

/**
 * Render engine-highlighted text as React nodes.
 *
 * Deliberately does not use `dangerouslySetInnerHTML`: Meilisearch inserts
 * highlight tags into the original document text without escaping the rest of
 * it, so rendering the raw string as HTML would let a product name inject
 * markup.
 */
export default function HighlightedText({ formatted, fallback }: HighlightedTextProps) {
  if (!formatted) return <>{fallback}</>

  const segments = parseHighlightedText(formatted)
  if (segments.length === 0) return <>{fallback}</>

  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark
            // Segments are positional; their index is the only stable identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional text segments
            key={index}
            className='bg-transparent font-semibold text-text-primary'
          >
            {segment.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional text segments
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}
