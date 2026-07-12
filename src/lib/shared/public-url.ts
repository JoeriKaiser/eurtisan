/**
 * Returns the configured public URL for absolute links and structured data.
 *
 * The value is read when the function is called so this module remains
 * safe for isomorphic consumers and does not capture environment state at
 * module initialization time.
 */
export function getPublicUrl(): string {
  return typeof process !== 'undefined' ? process.env.PUBLIC_URL || '' : ''
}
