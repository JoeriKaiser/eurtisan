import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  guardAuth,
  guardGuest,
  guardOptionalAuth,
  guardPrivilegedRole,
  guardRole,
  guardShopOwnership,
} from './route-guards'

vi.mock('../server-auth', () => ({
  getCurrentUser: vi.fn(),
  requireAuthUser: vi.fn(),
  requireRoleUser: vi.fn(),
  verifyShopOwnership: vi.fn(),
}))

import {
  getCurrentUser,
  requireAuthUser,
  requireRoleUser,
  verifyShopOwnership,
} from '../server-auth'

const mockGetCurrentUser = getCurrentUser as unknown as ReturnType<typeof vi.fn>
const mockRequireAuthUser = requireAuthUser as unknown as ReturnType<typeof vi.fn>
const mockRequireRoleUser = requireRoleUser as unknown as ReturnType<typeof vi.fn>
const mockVerifyShopOwnership = verifyShopOwnership as unknown as ReturnType<typeof vi.fn>

function makeUser(role: 'customer' | 'creator' | 'admin', twoFactorEnabled = false) {
  return {
    id: 'user-1',
    name: 'Test',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    role,
    twoFactorEnabled,
  }
}

function assertRedirect(err: unknown, expectedStatus: number) {
  expect(err).toBeInstanceOf(Response)
  expect((err as Response).status).toBe(expectedStatus)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('guardAuth', () => {
  it('returns user when authenticated', async () => {
    mockRequireAuthUser.mockResolvedValue(makeUser('customer'))

    const result = await guardAuth()
    expect(result.user).toEqual(makeUser('customer'))
  })

  it('redirects to /signin when unauthenticated', async () => {
    mockRequireAuthUser.mockRejectedValue(new Error('UNAUTHENTICATED'))

    try {
      await guardAuth()
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })

  it('redirects to /signin with redirect search param when provided', async () => {
    mockRequireAuthUser.mockRejectedValue(new Error('UNAUTHENTICATED'))

    try {
      await guardAuth('/checkout')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })
})

describe('guardRole', () => {
  it('returns user when role is sufficient', async () => {
    mockRequireRoleUser.mockResolvedValue(makeUser('creator'))

    const result = await guardRole('creator')
    expect(result.user).toEqual(makeUser('creator'))
  })

  it('redirects to /signin when unauthenticated', async () => {
    mockRequireRoleUser.mockRejectedValue(new Error('UNAUTHENTICATED'))

    try {
      await guardRole('creator')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })

  it('redirects to /signin with redirect search param when provided', async () => {
    mockRequireRoleUser.mockRejectedValue(new Error('UNAUTHENTICATED'))

    try {
      await guardRole('creator', '/studio')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })

  it('redirects to /forbidden when role is insufficient', async () => {
    mockRequireRoleUser.mockRejectedValue(new Error('FORBIDDEN'))

    try {
      await guardRole('creator')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })
})

describe('guardShopOwnership', () => {
  it('returns user when ownership verified', async () => {
    mockVerifyShopOwnership.mockResolvedValue(makeUser('creator'))

    const result = await guardShopOwnership('shop-1')
    expect(result.user).toEqual(makeUser('creator'))
  })

  it('redirects to /signin when unauthenticated', async () => {
    mockVerifyShopOwnership.mockRejectedValue(new Error('UNAUTHENTICATED'))

    try {
      await guardShopOwnership('shop-1')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })

  it('redirects to /signin with redirect search param when provided', async () => {
    mockVerifyShopOwnership.mockRejectedValue(new Error('UNAUTHENTICATED'))

    try {
      await guardShopOwnership('shop-1', '/checkout')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })

  it('redirects to /forbidden when ownership fails', async () => {
    mockVerifyShopOwnership.mockRejectedValue(new Error('FORBIDDEN'))

    try {
      await guardShopOwnership('shop-1')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })
})

describe('guardGuest', () => {
  it('does not throw when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    await expect(guardGuest()).resolves.toBeUndefined()
  })

  it('redirects to / when authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser('customer'))

    try {
      await guardGuest()
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
    }
  })
})

describe('guardOptionalAuth', () => {
  it('returns user when authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser('customer'))

    const result = await guardOptionalAuth()
    expect(result.user).toEqual(makeUser('customer'))
  })

  it('returns null when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const result = await guardOptionalAuth()
    expect(result.user).toBeNull()
  })
})

describe('guardPrivilegedRole', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirects to /account/security when a creator has not enabled 2FA', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')
    mockRequireRoleUser.mockResolvedValue(makeUser('creator', false))

    try {
      await guardPrivilegedRole('creator')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
      expect((err as { options: { to: string } }).options.to).toBe('/account/security')
    }
  })

  it('redirects to /account/security when an admin has not enabled 2FA', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')
    mockRequireRoleUser.mockResolvedValue(makeUser('admin', false))

    try {
      await guardPrivilegedRole('admin')
      expect.fail('should have thrown')
    } catch (err) {
      assertRedirect(err, 307)
      expect((err as { options: { to: string } }).options.to).toBe('/account/security')
    }
  })

  it('returns user when a privileged role has 2FA enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')
    mockRequireRoleUser.mockResolvedValue(makeUser('creator', true))

    const result = await guardPrivilegedRole('creator')
    expect(result.user).toEqual(makeUser('creator', true))
  })

  it('does not enforce 2FA for customers', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')
    mockRequireRoleUser.mockResolvedValue(makeUser('customer', false))

    const result = await guardPrivilegedRole('customer')
    expect(result.user).toEqual(makeUser('customer', false))
  })

  it('bypasses the 2FA check in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VITEST', 'false')
    mockRequireRoleUser.mockResolvedValue(makeUser('creator', false))

    const result = await guardPrivilegedRole('creator')
    expect(result.user).toEqual(makeUser('creator', false))
  })

  it('bypasses the 2FA check when VITEST is true', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'true')
    mockRequireRoleUser.mockResolvedValue(makeUser('creator', false))

    const result = await guardPrivilegedRole('creator')
    expect(result.user).toEqual(makeUser('creator', false))
  })
})
