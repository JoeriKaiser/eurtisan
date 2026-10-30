import { describe, expect, it } from 'vitest'
import {
  calculateConditionDeduction,
  calculateReturnRefund,
  getReturnDeadline,
  getReturnEligibility,
  isReturnExpired,
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

  it.each(['personalized', 'perishable', 'hygiene_sealed'] as const)(
    'applies the %s withdrawal exclusion',
    (returnPolicy) => {
      const result = getReturnEligibility({
        type: 'withdrawal',
        deliveredAt,
        returnPolicy,
        now: new Date('2026-03-05T12:00:00Z'),
      })
      expect(result.eligible).toBe(false)
      expect(result.exclusionCode).toContain(returnPolicy.toUpperCase())
    },
  )

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

describe('calculateConditionDeduction', () => {
  it('protects outbound shipping when items have partial/full shipping refund', () => {
    // Full shipping refund scenario (refundCents: 3500, outbound shipping: 500)
    expect(calculateConditionDeduction(3500, 500, 3500)).toBe(3000)
    // Only shipping refund scenario (refundCents: 500, outbound shipping: 500)
    expect(calculateConditionDeduction(500, 500, 300)).toBe(0)
    // Outbound shipping 0
    expect(calculateConditionDeduction(2000, 0, 2000)).toBe(2000)
  })

  it('proves deduction cannot exceed item total when outbound shipping is present', () => {
    expect(calculateConditionDeduction(2500, 500, 2100)).toBe(2000)
    expect(calculateConditionDeduction(2500, 500, 5000)).toBe(2000)
  })

  it('returns 0 for negative requested deductions', () => {
    expect(calculateConditionDeduction(2000, 500, -1)).toBe(0)
    expect(calculateConditionDeduction(2000, 500, -500)).toBe(0)
    expect(calculateConditionDeduction(2000, 0, 0)).toBe(0)
  })

  it('returns exact amount when deduction is within bounds', () => {
    expect(calculateConditionDeduction(3000, 500, 1500)).toBe(1500)
    expect(calculateConditionDeduction(3000, 500, 100)).toBe(100)
    expect(calculateConditionDeduction(3000, 500, 2500)).toBe(2500)
    expect(calculateConditionDeduction(3000, 500, 1500.4)).toBe(1500)
    expect(calculateConditionDeduction(3000, 500, 1500.6)).toBe(1501)
  })
})

describe('isReturnExpired', () => {
  const returnDeadline = new Date('2026-03-15T12:00:00Z')

  it('returns false for date within deadline', () => {
    const beforeDeadline = new Date('2026-03-15T11:59:59Z')
    const atDeadline = new Date('2026-03-15T12:00:00Z')

    expect(isReturnExpired(returnDeadline, beforeDeadline)).toBe(false)
    expect(isReturnExpired(returnDeadline, atDeadline)).toBe(false)
  })

  it('returns false for date within 72h grace window', () => {
    const oneDayAfter = new Date('2026-03-16T12:00:00Z')
    const withinGrace = new Date('2026-03-18T11:59:59Z')
    const atGraceLimit = new Date('2026-03-18T12:00:00Z')

    expect(isReturnExpired(returnDeadline, oneDayAfter)).toBe(false)
    expect(isReturnExpired(returnDeadline, withinGrace)).toBe(false)
    expect(isReturnExpired(returnDeadline, atGraceLimit)).toBe(false)
  })

  it('returns true for date past deadline + 72h', () => {
    const pastGrace = new Date('2026-03-18T12:00:01Z')
    const wellPastGrace = new Date('2026-03-20T12:00:00Z')

    expect(isReturnExpired(returnDeadline, pastGrace)).toBe(true)
    expect(isReturnExpired(returnDeadline, wellPastGrace)).toBe(true)
  })

  it('supports custom graceHours parameter', () => {
    const withinCustomGrace = new Date('2026-03-16T11:00:00Z')
    const pastCustomGrace = new Date('2026-03-16T12:00:01Z')

    expect(isReturnExpired(returnDeadline, withinCustomGrace, 24)).toBe(false)
    expect(isReturnExpired(returnDeadline, pastCustomGrace, 24)).toBe(true)

    const immediatelyPast = new Date('2026-03-15T12:00:01Z')
    expect(isReturnExpired(returnDeadline, immediatelyPast, 0)).toBe(true)
  })
})
