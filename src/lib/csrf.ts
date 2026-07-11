import '@tanstack/react-start/server-only'

import { getBaseUrl } from './env.server'

export class CsrfError extends Error {
  constructor(message = 'CSRF validation failed') {
    super(message)
    this.name = 'CsrfError'
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])

/**
 * Returns the trusted origin for CSRF validation.
 */
function getTrustedOrigin(): string {
  return new URL(getBaseUrl()).origin
}

/**
 * Validates that a state-changing request originates from a trusted origin.
 *
 * Safe HTTP methods (GET, HEAD, OPTIONS, TRACE) are always allowed.
 * For state-changing methods, checks the Origin header first, then Referer.
 *
 * This aligns with Better Auth's origin-check middleware and the Fetch
 * Metadata specification.
 */
export function validateCsrf(request: Request): void {
  if (SAFE_METHODS.has(request.method)) {
    return
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const trustedOrigin = getTrustedOrigin()

  if (origin) {
    if (origin === 'null') {
      throw new CsrfError('Invalid Origin header: null')
    }
    if (origin !== trustedOrigin) {
      throw new CsrfError(`Invalid Origin header: ${origin}`)
    }
    return
  }

  if (referer) {
    let refererOrigin: string
    try {
      refererOrigin = new URL(referer).origin
    } catch {
      throw new CsrfError('Invalid Referer header')
    }
    if (refererOrigin !== trustedOrigin) {
      throw new CsrfError(`Invalid Referer header: ${refererOrigin}`)
    }
    return
  }

  throw new CsrfError('Missing Origin or Referer header')
}
