import type { OrderStatus } from '../order-status'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const NON_DELIVERY_GRACE_DAYS = 2
export const TRACKING_STALL_DAYS = 7
export const NON_DELIVERY_FALLBACK_DAYS = 30

export type NonDeliveryEligibilityBasis =
  | 'delivery_failed'
  | 'fulfillment_overdue'
  | 'shipment_overdue'
  | 'tracking_stalled'

export type NonDeliveryIneligibleReason =
  | 'cancelled_or_refunded'
  | 'delivered'
  | 'dispute_exists'
  | 'fulfillment_in_progress'
  | 'not_paid'
  | 'shipment_in_transit'
  | 'unsupported_status'

export interface NonDeliveryEligibility {
  eligible: boolean
  eligibleAt: Date | null
  basis: NonDeliveryEligibilityBasis | null
  reason: NonDeliveryIneligibleReason | null
}

export interface NonDeliveryOrderState {
  status: OrderStatus
  createdAt: Date
  paidAt: Date | null
  shippingMethod: 'standard' | 'express' | 'manual'
  fulfillmentDueAt: Date | null
  earliestDeliveryAt: Date | null
  deliveryDueAt: Date | null
  shippedAt: Date | null
  trackingStatus: string | null
  lastTrackingEventAt: Date | null
}

export interface DeliveryPromiseSnapshot {
  processingTimeMaxBusinessDays: number | null
  transitTimeMinBusinessDays: number | null
  transitTimeMaxBusinessDays: number | null
  fulfillmentDueAt: Date | null
  earliestDeliveryAt: Date | null
  deliveryDueAt: Date | null
}

function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let remaining = Math.max(0, Math.trunc(days))

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const day = result.getUTCDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }

  return result
}

export function createDeliveryPromiseSnapshot(input: {
  paidAt: Date
  processingTimeMaxBusinessDays: number | null
  transitTimeMinBusinessDays: number | null
  transitTimeMaxBusinessDays: number | null
}): DeliveryPromiseSnapshot {
  const processingMax = input.processingTimeMaxBusinessDays
  const transitMin = input.transitTimeMinBusinessDays
  const transitMax = input.transitTimeMaxBusinessDays

  if (processingMax === null) {
    return {
      processingTimeMaxBusinessDays: null,
      transitTimeMinBusinessDays: transitMin,
      transitTimeMaxBusinessDays: transitMax,
      fulfillmentDueAt: null,
      earliestDeliveryAt: null,
      deliveryDueAt: null,
    }
  }

  const fulfillmentDueAt = addBusinessDays(input.paidAt, processingMax)
  return {
    processingTimeMaxBusinessDays: processingMax,
    transitTimeMinBusinessDays: transitMin,
    transitTimeMaxBusinessDays: transitMax,
    fulfillmentDueAt,
    earliestDeliveryAt: transitMin === null ? null : addBusinessDays(fulfillmentDueAt, transitMin),
    deliveryDueAt: transitMax === null ? null : addBusinessDays(fulfillmentDueAt, transitMax),
  }
}

function isTerminalDeliveryFailure(status: string | null): boolean {
  return status === 'unable_to_deliver' || status === 'returned_to_sender'
}

function hasCarrierMovement(status: string | null): boolean {
  return status !== null && !['label_created', 'unknown'].includes(status)
}

export function getNonDeliveryEligibility(
  order: NonDeliveryOrderState,
  now = new Date(),
): NonDeliveryEligibility {
  if (order.status === 'pending_payment' || order.status === 'manual_review') {
    return { eligible: false, eligibleAt: null, basis: null, reason: 'not_paid' }
  }

  if (order.status === 'cancelled' || order.status === 'refunded') {
    return { eligible: false, eligibleAt: null, basis: null, reason: 'cancelled_or_refunded' }
  }

  if (order.status === 'delivered' || order.status === 'completed') {
    return { eligible: false, eligibleAt: null, basis: null, reason: 'delivered' }
  }

  if (order.status === 'disputed') {
    return { eligible: false, eligibleAt: null, basis: null, reason: 'dispute_exists' }
  }

  const paidAt = order.paidAt ?? order.createdAt
  const fallbackAt = addCalendarDays(paidAt, NON_DELIVERY_FALLBACK_DAYS)

  if (order.status === 'paid' || order.status === 'processing') {
    const eligibleAt = order.fulfillmentDueAt
      ? addCalendarDays(order.fulfillmentDueAt, NON_DELIVERY_GRACE_DAYS)
      : fallbackAt
    return {
      eligible: now >= eligibleAt,
      eligibleAt,
      basis: now >= eligibleAt ? 'fulfillment_overdue' : null,
      reason: now >= eligibleAt ? null : 'fulfillment_in_progress',
    }
  }

  if (order.status !== 'shipped') {
    return { eligible: false, eligibleAt: null, basis: null, reason: 'unsupported_status' }
  }

  if (isTerminalDeliveryFailure(order.trackingStatus)) {
    return { eligible: true, eligibleAt: now, basis: 'delivery_failed', reason: null }
  }

  let candidate: { at: Date; basis: NonDeliveryEligibilityBasis } = {
    at: order.deliveryDueAt
      ? addCalendarDays(order.deliveryDueAt, NON_DELIVERY_GRACE_DAYS)
      : fallbackAt,
    basis: 'shipment_overdue',
  }

  if (order.lastTrackingEventAt && hasCarrierMovement(order.trackingStatus)) {
    const stalledAt = addCalendarDays(order.lastTrackingEventAt, TRACKING_STALL_DAYS)
    const eligibleAt =
      order.earliestDeliveryAt && order.earliestDeliveryAt > stalledAt
        ? order.earliestDeliveryAt
        : stalledAt
    if (eligibleAt < candidate.at) {
      candidate = { at: eligibleAt, basis: 'tracking_stalled' }
    }
  }

  return {
    eligible: now >= candidate.at,
    eligibleAt: candidate.at,
    basis: now >= candidate.at ? candidate.basis : null,
    reason: now >= candidate.at ? null : 'shipment_in_transit',
  }
}
