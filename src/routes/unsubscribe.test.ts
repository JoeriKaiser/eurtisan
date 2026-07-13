import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUnsubscribeByToken } = vi.hoisted(() => ({ mockUnsubscribeByToken: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}))
vi.mock('#/lib/unsubscribe', () => ({ unsubscribeByToken: mockUnsubscribeByToken }))
vi.mock('#/route-components/unsubscribe', () => ({
  UnsubscribePage: () => null,
  UnsubscribePending: () => null,
}))

import { Route } from './unsubscribe'

type Loader = (input: {
  deps: {
    token?: string
    category?: 'seller_updates' | 'marketing' | 'platform_announcements'
  }
}) => Promise<{ success: boolean; category?: string }>
const loader = Route.options.loader as Loader

describe('unsubscribe route loader', () => {
  beforeEach(() => {
    mockUnsubscribeByToken.mockReset()
  })

  it('rejects an absent token without invoking the mutation', async () => {
    await expect(loader({ deps: {} })).resolves.toEqual({ success: false, category: undefined })
    expect(mockUnsubscribeByToken).not.toHaveBeenCalled()
  })

  it('executes the idempotent mutation and returns its category', async () => {
    mockUnsubscribeByToken.mockResolvedValue({ success: true, category: 'marketing' })

    await expect(
      loader({ deps: { token: 'unsubscribe-token', category: 'marketing' } }),
    ).resolves.toEqual({ success: true, category: 'marketing' })
    expect(mockUnsubscribeByToken).toHaveBeenCalledTimes(1)
    expect(mockUnsubscribeByToken).toHaveBeenCalledWith({
      data: { token: 'unsubscribe-token', category: 'marketing' },
    })
  })

  it('maps mutation failures to the safe error result', async () => {
    mockUnsubscribeByToken.mockRejectedValue(new Error('database detail'))
    await expect(loader({ deps: { token: 'bad-token' } })).resolves.toEqual({
      success: false,
      category: undefined,
    })
  })
})
