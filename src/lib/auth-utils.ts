export function isLocalRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

/**
 * Validate a raw callback/redirect path.
 * Only same-origin relative paths are returned; everything else falls back to '/'.
 */
export function safeRedirect(path: string | null): string {
  if (!path) return '/'
  return isLocalRedirect(path) ? path : '/'
}
