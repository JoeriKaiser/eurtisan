import crypto from 'node:crypto'

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

function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BETTER_AUTH_SECRET is required in production')
    }
    return 'fallback-secret'
  }
  return secret
}

export function signMollieState(shopId: string, userId: string): string {
  const secret = getAuthSecret()
  const data = `${shopId}:${userId}:${Date.now()}`
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex')
  return `${data}.${signature}`
}

export function verifyMollieState(
  state: string,
  userId: string,
  maxAgeMs = 15 * 60 * 1000,
): string | null {
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [data, signature] = parts
  const [shopId, stateUserId, timestampStr] = data.split(':')
  if (!shopId || !stateUserId || !timestampStr) return null

  // Verify user matches
  if (stateUserId !== userId) return null

  // Verify expiry
  const timestamp = parseInt(timestampStr, 10)
  if (Number.isNaN(timestamp) || Date.now() - timestamp > maxAgeMs) return null

  // Verify signature using a constant-time comparison to avoid timing attacks.
  const secret = getAuthSecret()
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex')
  const signatureBuf = Buffer.from(signature, 'hex')
  const expectedBuf = Buffer.from(expectedSignature, 'hex')
  if (signatureBuf.length !== expectedBuf.length) return null
  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) return null

  return shopId
}
