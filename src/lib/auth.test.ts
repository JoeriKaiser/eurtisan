import { describe, expect, it, vi } from 'vitest'

import type { EmailProvider } from '#/lib/email-provider'
import { betterAuthOptions } from './auth'

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
