import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthHandler = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockExtractClientIp = vi.hoisted(() => vi.fn())

vi.mock('#/lib/auth', () => ({
  auth: {
    handler: mockAuthHandler,
  },
}))

vi.mock('#/lib/rate-limit', () => ({
  extractClientIp: mockExtractClientIp,
  isAuthRateLimitedAction: vi.fn(),
}))

vi.mock('#/lib/rate-limit.server', () => ({
  checkRateLimit: mockCheckRateLimit,
  assertAuthRateLimit: vi.fn(),
}))

vi.mock('#/lib/auth-lockout.server', () => ({
  checkAccountLockout: vi.fn(),
  recordFailedSignIn: vi.fn(),
  recordSuccessfulSignIn: vi.fn(),
}))

import { Route } from './$'

const getHandler = (
  Route.options.server?.handlers as unknown as {
    GET: (ctx: { request: Request }) => Promise<Response>
  }
).GET

describe('GET /api/auth/$', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractClientIp.mockReturnValue('192.168.1.1')
  })

  it('allows the request when the rate limit is not exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: new Date(),
      retryAfterSeconds: 0,
    })
    mockAuthHandler.mockResolvedValue(new Response('OK', { status: 200 }))

    const request = new Request('http://localhost/api/auth/session')
    const response = await getHandler({ request })

    expect(mockCheckRateLimit).toHaveBeenCalledWith('auth:get:192.168.1.1', 100, 60_000)
    expect(mockAuthHandler).toHaveBeenCalledWith(request)
    expect(response.status).toBe(200)
  })

  it('returns 429 when the rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      retryAfterSeconds: 45,
    })

    const request = new Request('http://localhost/api/auth/session')
    try {
      await getHandler({ request })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      const response = err as Response
      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body.error).toBe('Too Many Requests')
      expect(body.message).toBe('Rate limit exceeded.')
      expect(response.headers.get('Retry-After')).toBe('45')
    }

    expect(mockAuthHandler).not.toHaveBeenCalled()
  })

  it('uses the auth:get prefix in the rate-limit key', async () => {
    mockExtractClientIp.mockReturnValue('10.0.0.1')
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: new Date(),
      retryAfterSeconds: 0,
    })
    mockAuthHandler.mockResolvedValue(new Response('OK', { status: 200 }))

    const request = new Request('http://localhost/api/auth/session')
    await getHandler({ request })

    expect(mockCheckRateLimit).toHaveBeenCalledWith('auth:get:10.0.0.1', 100, 60_000)
  })
})
