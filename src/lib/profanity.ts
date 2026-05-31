/**
 * Lightweight profanity filter for user-generated text (reviews, etc.).
 */

const BLOCKED_TERMS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'faggot',
  'retard',
] as const

const BLOCKED_PATTERN = new RegExp(
  `\\b(${BLOCKED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i',
)

/** Returns true when text contains blocked terms. */
export function containsProfanity(text: string): boolean {
  const normalized = text.normalize('NFKC').trim()
  if (!normalized) return false
  return BLOCKED_PATTERN.test(normalized)
}
