/**
 * Minimal TOTP code generator for E2E 2FA flows.
 *
 * Parses the `otpauth://` URI returned by Better Auth and produces the
 * current 6-digit TOTP code using Node's crypto module.
 */

import { createHmac } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, '')
  let bits = ''
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`)
    }
    bits += index.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function parseOtpauthUri(uri: string): { secret: string; algorithm: string; digits: number; period: number } {
  const url = new URL(uri)
  if (url.protocol !== 'otpauth:') {
    throw new Error(`Unsupported OTP URI protocol: ${url.protocol}`)
  }

  const secret = url.searchParams.get('secret')
  if (!secret) {
    throw new Error('OTP URI is missing secret')
  }

  return {
    secret,
    algorithm: url.searchParams.get('algorithm') ?? 'SHA1',
    digits: Number(url.searchParams.get('digits') ?? '6'),
    period: Number(url.searchParams.get('period') ?? '30'),
  }
}

function hmacSha1(secret: Buffer, counter: bigint): Buffer {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(counter)
  return createHmac('sha1', secret).update(counterBuffer).digest()
}

function dynamicTruncation(hash: Buffer): number {
  const offset = hash[hash.length - 1] & 0x0f
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  return binary
}

/**
 * Generate the current TOTP code from a Better Auth `totpURI`.
 * Defaults to 6 digits / 30 seconds / SHA1 (Better Auth defaults).
 */
export function generateTOTPCode(totpUri: string): string {
  const { secret, digits, period } = parseOtpauthUri(totpUri)
  const decodedSecret = base32Decode(secret)
  const counter = BigInt(Math.floor(Date.now() / 1000 / period))
  const hash = hmacSha1(decodedSecret, counter)
  const code = dynamicTruncation(hash) % 10 ** digits
  return String(code).padStart(digits, '0')
}
