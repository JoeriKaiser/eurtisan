import { describe, expect, it } from 'vitest'

import {
  decrypt,
  decryptAccountTokens,
  decryptShopMollieTokens,
  encrypt,
} from './encryption.server'

describe('encryption.server', () => {
  it('round-trips plaintext', () => {
    const plaintext = 'hello world'
    const ciphertext = encrypt(plaintext)
    expect(ciphertext).not.toBe(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('returns empty string unchanged', () => {
    expect(encrypt('')).toBe('')
    expect(decrypt('')).toBe('')
  })

  it('produces different ciphertexts for the same plaintext', () => {
    const plaintext = 'same same but different'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe(plaintext)
    expect(decrypt(b)).toBe(plaintext)
  })

  it('throws on tampered ciphertext', () => {
    const ciphertext = encrypt('secret')
    const altered = `${ciphertext.slice(0, -4)}0000`
    expect(() => decrypt(altered)).toThrow()
  })

  it('decryptAccountTokens decrypts encrypted token fields', () => {
    const account = {
      id: 'acc-1',
      accountId: 'github-123',
      providerId: 'github',
      userId: 'user-1',
      accessToken: encrypt('access-token'),
      refreshToken: encrypt('refresh-token'),
      idToken: encrypt('id-token'),
      password: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const decrypted = decryptAccountTokens(account)
    expect(decrypted.accessToken).toBe('access-token')
    expect(decrypted.refreshToken).toBe('refresh-token')
    expect(decrypted.idToken).toBe('id-token')
    expect(decrypted.password).toBeNull()
  })

  it('decryptShopMollieTokens decrypts mollie tokens', () => {
    const shop = {
      id: 'shop-1',
      name: 'Shop',
      slug: 'shop',
      currency: 'EUR',
      status: 'active' as const,
      onboardingStep: 1,
      isSuspended: false,
      paymentConnected: false,
      isVatRegistered: false,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      mollieAccessToken: encrypt('access'),
      mollieRefreshToken: encrypt('refresh'),
    }
    const decrypted = decryptShopMollieTokens(
      shop as unknown as Parameters<typeof decryptShopMollieTokens>[0],
    )
    expect(decrypted.mollieAccessToken).toBe('access')
    expect(decrypted.mollieRefreshToken).toBe('refresh')
  })
})
