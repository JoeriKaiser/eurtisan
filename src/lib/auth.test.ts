import { describe, expect, it, vi } from 'vitest'

import type { EmailProvider } from '#/lib/email-provider'
import { betterAuthOptions, hashSessionToken, wrapAdapter } from './auth'

vi.mock('#/integrations/email', () => ({
  createEmailProvider: vi.fn(() => ({
    sendTransactional: vi.fn(),
  })),
}))

describe('auth configuration', () => {
  it('has explicit session settings', () => {
    expect(betterAuthOptions.session).toMatchObject({
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    })
  })

  it('revokes sessions on password reset', () => {
    expect(betterAuthOptions.emailAndPassword).toMatchObject({
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
    })
  })
})

describe('sendVerificationEmail', () => {
  it('builds a URL with token but without email', async () => {
    const { createEmailProvider } = await import('#/integrations/email')
    const sendTransactional = vi.fn()
    vi.mocked(createEmailProvider).mockReturnValue({ sendTransactional } as EmailProvider)

    const sendVerificationEmail = betterAuthOptions.emailVerification?.sendVerificationEmail
    expect(sendVerificationEmail).toBeDefined()

    await sendVerificationEmail?.({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      url: 'http://localhost:3000/api/auth/verify-email?token=secret-token&callbackURL=%2Fdashboard',
      token: 'secret-token',
    })

    expect(createEmailProvider).toHaveBeenCalledTimes(1)
    expect(sendTransactional).toHaveBeenCalledTimes(1)
    expect(sendTransactional).toHaveBeenCalledWith(
      'test@example.com',
      'email_verification',
      expect.objectContaining({
        verificationUrl: expect.stringContaining('token=secret-token'),
      }),
    )

    const [, , data] = sendTransactional.mock.calls[0]
    expect(data.verificationUrl).not.toContain('email=')
  })

  it('preserves redirect from callbackURL', async () => {
    const { createEmailProvider } = await import('#/integrations/email')
    const sendTransactional = vi.fn()
    vi.mocked(createEmailProvider).mockReturnValue({ sendTransactional } as EmailProvider)

    const sendVerificationEmail = betterAuthOptions.emailVerification?.sendVerificationEmail
    expect(sendVerificationEmail).toBeDefined()

    await sendVerificationEmail?.({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      url: 'http://localhost:3000/api/auth/verify-email?token=secret-token&callbackURL=%2Fdashboard',
      token: 'secret-token',
    })

    const [, , data] = sendTransactional.mock.calls[0]
    expect(data.verificationUrl).toContain('redirect=%2Fdashboard')
  })
})

describe('hashSessionToken', () => {
  it('returns a hex SHA-256 hash', () => {
    const token = 'test-token-123'
    const hash = hashSessionToken(token)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).toBe(hashSessionToken(token))
  })

  it('produces different hashes for different tokens', () => {
    const h1 = hashSessionToken('token-a')
    const h2 = hashSessionToken('token-b')
    expect(h1).not.toBe(h2)
  })
})

describe('wrapAdapter', () => {
  function makeMockAdapter() {
    const store = new Map<string, Record<string, unknown>>()
    let idCounter = 0
    return {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        idCounter += 1
        const id = `sess-${idCounter}`
        const record = { ...data, id }
        store.set(id, record)
        return record
      }),
      findOne: vi.fn(async ({ where }: { where: Array<{ field: string; value: unknown }> }) => {
        const clause = where.find((w) => w.field === 'tokenHash')
        if (clause) {
          for (const record of store.values()) {
            if (record.tokenHash === clause.value) {
              return { ...record }
            }
          }
        }
        return null
      }),
      findMany: vi.fn(async () => Array.from(store.values())),
      update: vi.fn(async ({ where }: { where: Array<{ field: string; value: unknown }> }) => {
        const clause = where.find((w) => w.field === 'tokenHash')
        if (clause) {
          for (const record of store.values()) {
            if (record.tokenHash === clause.value) {
              return { ...record }
            }
          }
        }
        return null
      }),
      updateMany: vi.fn(async () => 0),
      delete: vi.fn(async () => {}),
      deleteMany: vi.fn(async () => 0),
      count: vi.fn(async () => store.size),
      transaction: vi.fn(async (cb: (trx: unknown) => Promise<unknown>) => cb({})),
    } as unknown as Parameters<typeof wrapAdapter>[0]
  }

  it('hashes token on create and returns the original token', async () => {
    const adapter = makeMockAdapter()
    const wrapped = wrapAdapter(adapter)
    const result = await wrapped.create({
      model: 'session',
      data: { token: 'secret-token', userId: 'user-1' },
    })

    expect(adapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: null,
          tokenHash: hashSessionToken('secret-token'),
        }),
      }),
    )
    expect(result.token).toBe('secret-token')
  })

  it('finds a session by hashing the lookup token', async () => {
    const adapter = makeMockAdapter()
    const wrapped = wrapAdapter(adapter)
    await wrapped.create({
      model: 'session',
      data: { token: 'lookup-token', userId: 'user-1' },
    })

    const found = (await wrapped.findOne({
      model: 'session',
      where: [{ field: 'token', value: 'lookup-token' }],
    })) as Record<string, unknown> | null

    expect(found).not.toBeNull()
    expect(found?.token).toBe('lookup-token')
  })

  it('finds multiple sessions by hashed tokens', async () => {
    const adapter = makeMockAdapter()
    const wrapped = wrapAdapter(adapter)
    await wrapped.create({ model: 'session', data: { token: 't1', userId: 'u1' } })
    await wrapped.create({ model: 'session', data: { token: 't2', userId: 'u2' } })

    const found = (await wrapped.findMany({
      model: 'session',
      where: [{ field: 'token', value: ['t1', 't2'], operator: 'in' }],
    })) as Record<string, unknown>[]

    const tokens = found.map((r) => r.token)
    expect(tokens).toContain('t1')
    expect(tokens).toContain('t2')
  })

  it('injects original token into update result', async () => {
    const adapter = makeMockAdapter()
    const wrapped = wrapAdapter(adapter)
    await wrapped.create({ model: 'session', data: { token: 'upd-token', userId: 'u1' } })

    const updated = (await wrapped.update({
      model: 'session',
      where: [{ field: 'token', value: 'upd-token' }],
      update: { ipAddress: '127.0.0.1' },
    })) as Record<string, unknown> | null

    expect(updated?.token).toBe('upd-token')
  })

  it('passes through non-session operations unchanged', async () => {
    const adapter = makeMockAdapter()
    const wrapped = wrapAdapter(adapter)
    await wrapped.create({ model: 'user', data: { name: 'Alice' } })

    expect(adapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'user',
        data: { name: 'Alice' },
      }),
    )
  })
})
