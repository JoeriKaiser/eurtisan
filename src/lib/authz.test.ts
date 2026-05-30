import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'

import {
  AuthError,
  authPipeline,
  requireAuth,
  requireRole,
  requireShopOwnership,
  withAuthz,
} from './authz'

// Mock Better Auth
vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock DB
vi.mock('#/db/index', () => ({
  db: {
    query: {
      shop: {
        findFirst: vi.fn(),
      },
    },
  },
}))

import { auth } from './auth'

const mockGetSession = auth.api.getSession as unknown as ReturnType<typeof vi.fn>
const mockFindFirst = db.query.shop.findFirst as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

function makeUser(
  role: 'customer' | 'creator' | 'admin',
  overrides?: Partial<{ id: string; name: string; email: string }>,
) {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    role,
    bannedAt: null,
    banReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeSession(userId: string) {
  return {
    id: 'session-1',
    token: 'tok-1',
    expiresAt: new Date(Date.now() + 3600_000),
    userId,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeRequest(): Request {
  return new Request('http://localhost/api/test')
}

describe('requireAuth', () => {
  it('throws AuthError(401) when session is missing', async () => {
    mockGetSession.mockResolvedValue(null)

    try {
      await requireAuth(makeRequest())
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).status).toBe(401)
      expect((err as AuthError).body.error).toBe('Unauthorized')
      expect((err as AuthError).body.message).toContain('Authentication required')
    }
  })

  it('returns AuthContext when session is present', async () => {
    const user = makeUser('customer')
    const session = makeSession(user.id)
    mockGetSession.mockResolvedValue({ user, session })

    const ctx = await requireAuth(makeRequest())
    expect(ctx.user.id).toBe('user-1')
    expect(ctx.session.token).toBe('tok-1')
  })

  it('throws AuthError(403) when user is banned', async () => {
    const user = makeUser('customer')
    ;(user as unknown as { bannedAt: Date | null }).bannedAt = new Date()
    const session = makeSession(user.id)
    mockGetSession.mockResolvedValue({ user, session })

    try {
      await requireAuth(makeRequest())
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).status).toBe(403)
      expect((err as AuthError).body.error).toBe('Forbidden')
      expect((err as AuthError).body.message).toContain('Account suspended')
    }
  })
})

describe('requireRole', () => {
  it('allows access when user role meets minimum requirement', () => {
    const ctx = { user: makeUser('creator'), session: makeSession('user-1') }
    expect(requireRole('creator')(ctx)).toBe(ctx)
  })

  it('allows access when user role exceeds minimum requirement', () => {
    const ctx = { user: makeUser('admin'), session: makeSession('user-1') }
    expect(requireRole('creator')(ctx)).toBe(ctx)
  })

  it('throws AuthError(403) when user role is insufficient', () => {
    const ctx = { user: makeUser('customer'), session: makeSession('user-1') }
    expect(() => requireRole('creator')(ctx)).toThrow(
      expect.objectContaining({
        status: 403,
        body: { error: 'Forbidden', message: "Insufficient role. Required: 'creator' or higher." },
      }),
    )
  })
})

describe('requireShopOwnership', () => {
  it('allows access when user owns the shop', async () => {
    const ctx = { user: makeUser('creator'), session: makeSession('user-1') }
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await requireShopOwnership(ctx, 'shop-1')
    expect(result).toBe(ctx)
  })

  it('throws AuthError(403) when user does not own the shop', async () => {
    const ctx = { user: makeUser('creator', { id: 'user-2' }), session: makeSession('user-2') }
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    try {
      await requireShopOwnership(ctx, 'shop-1')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).status).toBe(403)
      expect((err as AuthError).body.error).toBe('Forbidden')
    }
  })

  it('throws AuthError(403) when shop does not exist', async () => {
    const ctx = { user: makeUser('creator'), session: makeSession('user-1') }
    mockFindFirst.mockResolvedValue(undefined)

    try {
      await requireShopOwnership(ctx, 'missing-shop')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).status).toBe(403)
      expect((err as AuthError).body.message).toContain('Shop not found')
    }
  })

  it('bypasses ownership check for admin users', async () => {
    const ctx = { user: makeUser('admin', { id: 'user-2' }), session: makeSession('user-2') }
    // No shop lookup should be needed
    mockFindFirst.mockResolvedValue(undefined)

    const result = await requireShopOwnership(ctx, 'shop-1')
    expect(result).toBe(ctx)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })
})

describe('withAuthz', () => {
  it('converts AuthError into a JSON Response', async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(new AuthError(403, { error: 'Forbidden', message: 'Nope' }))
    const wrapped = withAuthz(handler)

    const response = await wrapped(makeRequest())
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toBe('Nope')
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('re-throws non-AuthError exceptions', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Something broke'))
    const wrapped = withAuthz(handler)

    await expect(wrapped(makeRequest())).rejects.toThrow('Something broke')
  })

  it('returns the handler response on success', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('OK'))
    const wrapped = withAuthz(handler)

    const response = await wrapped(makeRequest())
    expect(await response.text()).toBe('OK')
  })
})

describe('authPipeline', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await authPipeline(makeRequest(), [], async () => new Response('OK'))
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when user is banned', async () => {
    const user = makeUser('customer')
    ;(user as unknown as { bannedAt: Date | null }).bannedAt = new Date()
    mockGetSession.mockResolvedValue({
      user,
      session: makeSession('user-1'),
    })

    const response = await authPipeline(makeRequest(), [], async () => new Response('OK'))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toContain('Account suspended')
  })

  it('returns 403 when role is insufficient', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('customer'),
      session: makeSession('user-1'),
    })

    const response = await authPipeline(
      makeRequest(),
      [requireRole('creator')],
      async () => new Response('OK'),
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 when shop ownership fails', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', { id: 'user-2' }),
      session: makeSession('user-2'),
    })
    mockFindFirst.mockResolvedValue(undefined)

    const response = await authPipeline(
      makeRequest(),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      async () => new Response('OK'),
    )
    expect(response.status).toBe(403)
  })

  it('succeeds for admin without ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('admin', { id: 'user-2' }),
      session: makeSession('user-2'),
    })

    const handler = vi.fn().mockResolvedValue(new Response('Admin OK'))
    const response = await authPipeline(
      makeRequest(),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      handler,
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Admin OK')
  })

  it('succeeds for creator who owns the shop', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', { id: 'user-1' }),
      session: makeSession('user-1'),
    })
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const handler = vi.fn().mockResolvedValue(new Response('Creator OK'))
    const response = await authPipeline(
      makeRequest(),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      handler,
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Creator OK')
  })

  it('re-throws non-AuthError exceptions from handler', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('admin'),
      session: makeSession('user-1'),
    })

    await expect(
      authPipeline(makeRequest(), [], async () => {
        throw new Error('Handler boom')
      }),
    ).rejects.toThrow('Handler boom')
  })

  it('returns 403 for POST requests without Origin or Referer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('admin'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/test', { method: 'POST' })
    const response = await authPipeline(req, [], async () => new Response('OK'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toContain('Missing Origin or Referer')
  })

  it('returns 403 for POST requests with invalid Origin', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('admin'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Origin: 'https://evil.com' },
    })
    const response = await authPipeline(req, [], async () => new Response('OK'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
    expect(body.message).toContain('Invalid Origin header')
  })

  it('allows POST requests with trusted Origin', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('admin'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    })
    const response = await authPipeline(req, [], async () => new Response('OK'))

    expect(response.status).toBe(200)
  })

  it('allows POST requests with trusted Referer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('admin'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Referer: 'http://localhost:3000/some-page' },
    })
    const response = await authPipeline(req, [], async () => new Response('OK'))

    expect(response.status).toBe(200)
  })
})
