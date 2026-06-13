import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearMockRouteFailure,
  createMollieRoute,
  getMollieRoute,
  resetMockRouteCounter,
  setMockRouteFailure,
} from './mollie-routes-client'

describe('createMollieRoute (mock mode)', () => {
  beforeEach(() => {
    resetMockRouteCounter()
    clearMockRouteFailure()
  })

  it('creates a deterministic mock route', async () => {
    const route = await createMollieRoute({
      paymentId: 'tr_test',
      amountCents: 12345,
      currency: 'EUR',
      destinationOrganizationId: 'org_seller',
      description: 'Test payout',
    })

    expect(route.id).toBe('crt_mock_000001')
    expect(route.paymentId).toBe('tr_test')
    expect(route.amount).toEqual({ currency: 'EUR', value: '123.45' })
    expect(route.destination).toEqual({
      type: 'organization',
      organizationId: 'org_seller',
    })
  })

  it('formats amount with two decimal places', async () => {
    const route = await createMollieRoute({
      paymentId: 'tr_test',
      amountCents: 100,
      currency: 'eur',
      destinationOrganizationId: 'org_seller',
      description: 'Test payout',
    })

    expect(route.amount.value).toBe('1.00')
  })

  it('throws when mock failure is configured', async () => {
    setMockRouteFailure('Simulated Mollie error')

    await expect(
      createMollieRoute({
        paymentId: 'tr_test',
        amountCents: 1000,
        currency: 'EUR',
        destinationOrganizationId: 'org_seller',
        description: 'Test payout',
      }),
    ).rejects.toThrow('Simulated Mollie error')
  })
})

describe('getMollieRoute (mock mode)', () => {
  it('returns a mock route for mock IDs', async () => {
    const route = await getMollieRoute('tr_test', 'crt_mock_000001')

    expect(route).not.toBeNull()
    expect(route?.id).toBe('crt_mock_000001')
  })

  it('returns null for non-mock IDs', async () => {
    const route = await getMollieRoute('tr_test', 'crt_real_123')

    expect(route).toBeNull()
  })
})
