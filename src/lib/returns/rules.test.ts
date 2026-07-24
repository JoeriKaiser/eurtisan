import { describe, expect, it } from 'vitest'
import {
  calculateReturnRefund,
  getReturnDeadline,
  getReturnEligibility,
  RETURN_SHIPMENT_WINDOW_DAYS,
} from './rules'

describe('return rules', () => {
  const deliveredAt = new Date('2026-03-01T12:00:00Z')

  it('allows a standard withdrawal within 14 days', () => {
    const result = getReturnEligibility({
      type: 'withdrawal',
      deliveredAt,
      returnPolicy: 'standard',
      now: new Date('2026-03-15T12:00:00Z'),
    })
    expect(result.eligible).toBe(true)
    expect(result.exclusionCode).toBeNull()
  })

  it('rejects a withdrawal after the deadline', () => {
    const result = getReturnEligibility({
      type: 'withdrawal',
      deliveredAt,
      returnPolicy: 'standard',
      now: new Date('2026-03-15T12:00:01Z'),
    })
    expect(result.eligible).toBe(false)
    expect(result.exclusionCode).toBe('RETURN_WINDOW_EXPIRED')
  })

  it.each([
    'personalized',
    'perishable',
    'hygiene_sealed',
  ] as const)('applies the %s withdrawal exclusion', (returnPolicy) => {
    const result = getReturnEligibility({
      type: 'withdrawal',
      deliveredAt,
      returnPolicy,
      now: new Date('2026-03-05T12:00:00Z'),
    })
    expect(result.eligible).toBe(false)
    expect(result.exclusionCode).toContain(returnPolicy.toUpperCase())
  })

  it('does not apply discretionary exclusions to defective-item reports', () => {
    const result = getReturnEligibility({
      type: 'defective',
      deliveredAt,
      returnPolicy: 'personalized',
      now: new Date('2026-03-20T12:00:00Z'),
    })
    expect(result.eligible).toBe(true)
  })

  it('requires delivery before either return flow', () => {
    expect(
      getReturnEligibility({
        type: 'withdrawal',
        deliveredAt: null,
        returnPolicy: 'standard',
      }),
    ).toMatchObject({ eligible: false, exclusionCode: 'NOT_DELIVERED' })
  })

  it('refunds selected quantities without outbound shipping for a partial return', () => {
    expect(
      calculateReturnRefund({
        items: [{ unitPriceCents: 1200, quantity: 1, orderedQuantity: 2 }],
        shopOrderItemCount: 1,
        standardShippingCostCents: 500,
      }),
    ).toEqual({ itemRefundCents: 1200, outboundShippingRefundCents: 0, totalCents: 1200 })
  })

  it('includes standard outbound shipping for a complete shop-order return', () => {
    expect(
      calculateReturnRefund({
        items: [
          { unitPriceCents: 1200, quantity: 2, orderedQuantity: 2 },
          { unitPriceCents: 500, quantity: 1, orderedQuantity: 1 },
        ],
        shopOrderItemCount: 2,
        standardShippingCostCents: 500,
      }),
    ).toEqual({ itemRefundCents: 2900, outboundShippingRefundCents: 500, totalCents: 3400 })
  })

  it('sets a deterministic return shipment deadline', () => {
    const requestedAt = new Date('2026-04-01T09:00:00Z')
    expect(getReturnDeadline(requestedAt).getTime() - requestedAt.getTime()).toBe(
      RETURN_SHIPMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    )
  })
})
