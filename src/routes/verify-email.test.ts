import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockVerifyEmailToken } = vi.hoisted(() => ({ mockVerifyEmailToken: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}))
vi.mock('#/lib/route-guards', () => ({ guardOptionalAuth: vi.fn() }))
vi.mock('#/lib/auth/verify-email', () => ({ verifyEmailToken: mockVerifyEmailToken }))
vi.mock('#/route-components/verify-email', () => ({
  VerifyEmail: () => null,
  VerifyEmailPending: () => null,
}))

import { Route } from './verify-email'

type Loader = (input: { deps: { token?: string } }) => Promise<{ status: string }>
const loader = Route.options.loader as Loader

describe('verify-email route loader', () => {
  beforeEach(() => {
    mockVerifyEmailToken.mockReset()
  })

  it('does not call verification without a token', async () => {
    await expect(loader({ deps: {} })).resolves.toEqual({ status: 'idle' })
    expect(mockVerifyEmailToken).not.toHaveBeenCalled()
  })

  it('verifies a token once and returns success', async () => {
    mockVerifyEmailToken.mockResolvedValue({ success: true })

    await expect(loader({ deps: { token: 'verification-token' } })).resolves.toEqual({
      status: 'success',
    })
    expect(mockVerifyEmailToken).toHaveBeenCalledTimes(1)
    expect(mockVerifyEmailToken).toHaveBeenCalledWith({ data: { token: 'verification-token' } })
  })

  it('maps provider failures to the user-safe error state', async () => {
    mockVerifyEmailToken.mockRejectedValue(new Error('provider detail'))
    await expect(loader({ deps: { token: 'bad-token' } })).resolves.toEqual({ status: 'error' })
  })
})
