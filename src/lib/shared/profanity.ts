import { Profanity } from '@2toad/profanity'

/**
 * Profanity filter for user-generated text (reviews, etc.).
 * Uses @2toad/profanity with dictionaries for major European languages.
 */
const profanity = new Profanity({
  languages: ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru'],
})

/** Returns true when text contains blocked terms. */
export function containsProfanity(text: string): boolean {
  const normalized = text.normalize('NFKC').trim()
  if (!normalized) return false
  return profanity.exists(normalized)
}
