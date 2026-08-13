import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  createDeliveryPromiseSnapshot,
  getNonDeliveryEligibility,
  NON_DELIVERY_FALLBACK_DAYS,
  NON_DELIVERY_GRACE_DAYS,
  TRACKING_STALL_DAYS,
  type NonDeliveryOrderState,
} from './non-delivery'

const NOW = new Date('2026-07-13T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * DAY)
}

function state(overrides: Partial<NonDeliveryOrderState> = {}): NonDeliveryOrderState {
  return {
    status: 'paid',
    createdAt: daysBefore(20),
    paidAt: daysBefore(20),
    shippingMethod: 'standard',
    fulfillmentDueAt: daysBefore(10),
    earliestDeliveryAt: daysBefore(7),
    deliveryDueAt: daysBefore(4),
    shippedAt: null,
    trackingStatus: null,
    lastTrackingEventAt: null,
    ...overrides,
  }
}

describe('delivery promise dates', () => {
  it('adds business days without counting weekends', () => {
    expect(addBusinessDays(new Date('2026-07-10T12:00:00.000Z'), 1).toISOString()).toBe(
      '2026-07-13T12:00:00.000Z',
    )
  })

  it('snapshots processing and carrier promises from the payment timestamp', () => {
    const snapshot = createDeliveryPromiseSnapshot({
      paidAt: new Date('2026-07-06T12:00:00.000Z'),
      processingTimeMaxBusinessDays: 3,
      transitTimeMinBusinessDays: 2,
      transitTimeMaxBusinessDays: 5,
    })

    expect(snapshot.fulfillmentDueAt?.toISOString()).toBe('2026-07-09T12:00:00.000Z')
    expect(snapshot.earliestDeliveryAt?.toISOString()).toBe('2026-07-13T12:00:00.000Z')
    expect(snapshot.deliveryDueAt?.toISOString()).toBe('2026-07-16T12:00:00.000Z')
  })
})

describe('getNonDeliveryEligibility', () => {
  it('rejects an early unshipped attempt until the processing grace period ends', () => {
    const eligibility = getNonDeliveryEligibility(
      state({ fulfillmentDueAt: new Date(NOW.getTime() - (NON_DELIVERY_GRACE_DAYS - 1) * DAY) }),
      NOW,
    )

    expect(eligibility.eligible).toBe(false)
    expect(eligibility.reason).toBe('fulfillment_in_progress')
    expect(eligibility.eligibleAt).toEqual(new Date(NOW.getTime() + DAY))
  })

  it('allows an overdue unshipped order', () => {
    const eligibility = getNonDeliveryEligibility(state(), NOW)

    expect(eligibility).toMatchObject({
      eligible: true,
      basis: 'fulfillment_overdue',
      reason: null,
    })
  })

  it('allows an overdue shipped order after the latest estimate and grace period', () => {
    const eligibility = getNonDeliveryEligibility(state({ status: 'shipped' }), NOW)

    expect(eligibility).toMatchObject({ eligible: true, basis: 'shipment_overdue', reason: null })
  })

  it('allows stalled tracking after seven days without movement and the earliest estimate', () => {
    const eligibility = getNonDeliveryEligibility(
      state({
        status: 'shipped',
        deliveryDueAt: new Date(NOW.getTime() + 10 * DAY),
        earliestDeliveryAt: daysBefore(1),
        trackingStatus: 'in_transit',
        lastTrackingEventAt: daysBefore(TRACKING_STALL_DAYS + 1),
      }),
      NOW,
    )

    expect(eligibility).toMatchObject({ eligible: true, basis: 'tracking_stalled' })
  })

  it('does not treat label creation as carrier movement', () => {
    const eligibility = getNonDeliveryEligibility(
      state({
        status: 'shipped',
        deliveryDueAt: new Date(NOW.getTime() + 10 * DAY),
        trackingStatus: 'label_created',
        lastTrackingEventAt: daysBefore(TRACKING_STALL_DAYS + 1),
      }),
      NOW,
    )

    expect(eligibility).toMatchObject({ eligible: false, reason: 'shipment_in_transit' })
  })

  it.each([
    'unable_to_deliver',
    'returned_to_sender',
  ] as const)('allows an authoritative terminal carrier status: %s', (trackingStatus) => {
    const eligibility = getNonDeliveryEligibility(
      state({ status: 'shipped', trackingStatus, deliveryDueAt: new Date(NOW.getTime() + DAY) }),
      NOW,
    )

    expect(eligibility).toMatchObject({ eligible: true, basis: 'delivery_failed' })
  })

  it('uses the 30-day fallback for historical or manual shipping promises', () => {
    const paidAt = new Date(NOW.getTime() - (NON_DELIVERY_FALLBACK_DAYS - 1) * DAY)
    const eligibility = getNonDeliveryEligibility(
      state({
        status: 'shipped',
        paidAt,
        fulfillmentDueAt: null,
        earliestDeliveryAt: null,
        deliveryDueAt: null,
      }),
      NOW,
    )

    expect(eligibility.eligible).toBe(false)
    expect(eligibility.eligibleAt).toEqual(new Date(paidAt.getTime() + 30 * DAY))
  })

  it.each(['cancelled', 'refunded'] as const)('rejects %s orders', (status) => {
    expect(getNonDeliveryEligibility(state({ status }), NOW)).toMatchObject({
      eligible: false,
      reason: 'cancelled_or_refunded',
    })
  })

  it('keeps delivered orders on the existing delivered-dispute path', () => {
    expect(getNonDeliveryEligibility(state({ status: 'delivered' }), NOW)).toMatchObject({
      eligible: false,
      reason: 'delivered',
    })
  })
})
