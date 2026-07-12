/**
 * Human-friendly order-number utilities.
 *
 * Order numbers are short (8 characters), URL-safe, and visually unambiguous:
 * the alphabet excludes 0/O and 1/I to avoid transcription errors.
 */

const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ORDER_NUMBER_LENGTH = 8

function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto
  }
  throw new Error('Crypto API is required for order-number generation')
}

/**
 * Generate an 8-character order number using a cryptographically secure
 * random source. The output is drawn from an alphabet that excludes visually
 * ambiguous characters (0, O, 1, I).
 */
export function generateOrderNumber(): string {
  const crypto = getCrypto()
  const buffer = new Uint8Array(ORDER_NUMBER_LENGTH)
  crypto.getRandomValues(buffer)

  let result = ''
  for (let i = 0; i < ORDER_NUMBER_LENGTH; i++) {
    result += ORDER_NUMBER_ALPHABET[buffer[i] % ORDER_NUMBER_ALPHABET.length]
  }
  return result
}

/**
 * Validate that a value matches the order-number format.
 */
export function isValidOrderNumber(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    new RegExp(`^[${ORDER_NUMBER_ALPHABET}]{${ORDER_NUMBER_LENGTH}}$`).test(value)
  )
}
