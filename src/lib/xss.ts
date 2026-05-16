/* -------------------------------------------------------------------------- */
/*                              Constants                                     */
/* -------------------------------------------------------------------------- */

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em'])

const SCRIPT_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi
const JAVASCRIPT_PATTERN = /javascript:/gi
const EVENT_HANDLER_PATTERN = /<[^>]*\bon\w+\s*=/i
const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*\b[^>]*>/i

/* -------------------------------------------------------------------------- */
/*                              Helpers                                       */
/* -------------------------------------------------------------------------- */

export function hasHtmlTags(input: string): boolean {
  return HTML_TAG_PATTERN.test(input)
}

export function hasDangerousContent(input: string): boolean {
  return /<script\b/i.test(input) || /javascript:/i.test(input) || EVENT_HANDLER_PATTERN.test(input)
}

/* -------------------------------------------------------------------------- */
/*                         Rich Text Sanitizer                                */
/* -------------------------------------------------------------------------- */

/**
 * Sanitizes rich text by keeping only a strict allow-list of HTML tags
 * (`<p>`, `<br>`, `<strong>`, `<em>`) and stripping all attributes.
 * Also strips `<script>` tags, `javascript:` URLs, and event handlers.
 *
 * - Non-allowed tags are removed entirely.
 * - Allowed tags have all attributes removed.
 * - Returns `null` for empty/whitespace-only input.
 */
export function sanitizeRichText(input: string | null | undefined): string | null {
  if (!input) return null

  let sanitized = input

  // Strip script tags and their contents
  sanitized = sanitized.replace(SCRIPT_PATTERN, '')

  // Strip javascript: protocol references
  sanitized = sanitized.replace(JAVASCRIPT_PATTERN, '')

  // Process all HTML tags: keep only allowed ones, remove all attributes
  sanitized = sanitized.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tagName) => {
    const lowerTag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(lowerTag)) {
      return ''
    }
    if (match.startsWith('</')) {
      return `</${lowerTag}>`
    }
    return `<${lowerTag}>`
  })

  const result = sanitized.trim()
  return result.length > 0 ? result : null
}

/* -------------------------------------------------------------------------- */
/*                         Plain Text Validator                               */
/* -------------------------------------------------------------------------- */

/**
 * Validates that plain text does not contain HTML tags or dangerous content.
 * Trims the input and throws a 400 Response if validation fails.
 *
 * Use this for fields like names, titles, slugs, reasons, and moderation notes
 * where HTML is never expected.
 */
export function validatePlainText(input: string, fieldName = 'Field'): string {
  const trimmed = input.trim()

  if (hasHtmlTags(trimmed)) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `${fieldName} contains HTML tags, which are not allowed.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (hasDangerousContent(trimmed)) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `${fieldName} contains potentially dangerous content.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return trimmed
}
