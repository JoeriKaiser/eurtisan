import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

import type { account, shop, twoFactor } from '#/db/schema'

import { logger } from './logger.server'

type Account = typeof account.$inferSelect
type TwoFactor = typeof twoFactor.$inferSelect
type Shop = typeof shop.$inferSelect

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

let cachedKey: Buffer | undefined

function decodeKey(): Buffer {
  if (cachedKey) return cachedKey

  const envKey = process.env.DATABASE_ENCRYPTION_KEY
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_ENCRYPTION_KEY is required in production')
    }
    logger.warn(
      'DATABASE_ENCRYPTION_KEY is not set; using a deterministic development key. Never use this in production.',
    )
    // Derive a deterministic key from a known string so dev/test data remains
    // decryptable across restarts, while still being obviously not a real secret.
    cachedKey = scryptSync('eurtisan-dev-only-deterministic-key', 'eurtisan-dev-salt', KEY_LENGTH)
    return cachedKey
  }

  const decoded = Buffer.from(envKey, 'base64')
  if (decoded.length !== KEY_LENGTH) {
    throw new Error(
      `DATABASE_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (256 bits), got ${decoded.length}`,
    )
  }
  cachedKey = decoded
  return cachedKey
}

/**
 * Encrypts plaintext using AES-256-GCM with a random IV.
 * Returns a base64 string containing: IV (16 bytes) + ciphertext + auth tag (16 bytes).
 */
export function encrypt(plaintext: string): string {
  if (plaintext === '') return ''
  const key = decodeKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const combined = Buffer.concat([iv, ciphertext, authTag])
  return combined.toString('base64')
}

/**
 * Decrypts a value produced by {@link encrypt}. Throws if the ciphertext has
 * been tampered with or the key is incorrect.
 */
export function decrypt(ciphertext: string): string {
  if (ciphertext === '') return ''
  const key = decodeKey()
  const combined = Buffer.from(ciphertext, 'base64')
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short')
  }
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/**
 * Re-decrypts a value only if it looks like one of our ciphertexts. Plaintext
 * values are returned as-is so backfill migrations can be idempotent.
 */
export function decryptIfEncrypted(value: string | null | undefined): string | null {
  if (value == null) return null
  // Heuristic: our ciphertexts are base64 and always longer than the raw secret.
  const looksEncrypted =
    /^[A-Za-z0-9+/]+={0,2}$/.test(value) &&
    Buffer.from(value, 'base64').length >= IV_LENGTH + AUTH_TAG_LENGTH
  if (!looksEncrypted) return value
  return decrypt(value)
}

export function decryptAccountTokens(account: Account): Account {
  return {
    ...account,
    accessToken: decryptIfEncrypted(account.accessToken),
    refreshToken: decryptIfEncrypted(account.refreshToken),
    idToken: decryptIfEncrypted(account.idToken),
    password: decryptIfEncrypted(account.password),
  }
}

export function decryptTwoFactorSecrets(twoFactor: TwoFactor): TwoFactor {
  return {
    ...twoFactor,
    secret: decryptIfEncrypted(twoFactor.secret) ?? twoFactor.secret,
    backupCodes: decryptIfEncrypted(twoFactor.backupCodes) ?? twoFactor.backupCodes,
  }
}

export function decryptShopMollieTokens(shop: Shop): Shop {
  return {
    ...shop,
    mollieAccessToken: decryptIfEncrypted(shop.mollieAccessToken),
    mollieRefreshToken: decryptIfEncrypted(shop.mollieRefreshToken),
  }
}
