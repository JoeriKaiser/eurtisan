/**
 * Structured logger for order lifecycle events.
 *
 * Emits consistent, JSON-parseable log entries for every major order state
 * transition so developers can trace orders in production.
 */

import { logger } from './logger.server'

export type OrderLifecycleEvent =
  | 'order_created'
  | 'order_paid'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_disputed'
  | 'order_resolved'
  | 'order_cancelled'
  | 'order_tracking_updated'
  | 'manual_review_resolved'

export interface OrderLogEntry {
  event: OrderLifecycleEvent
  timestamp: string
  orderId: string
  shopOrderId?: string
  [key: string]: unknown
}

/**
 * Write a structured order lifecycle log entry to stdout.
 *
 * The output is a single-line JSON object suitable for ingestion by log
 * aggregators (e.g. Loki, ELK, Datadog, CloudWatch).
 */
export function logOrderLifecycle(entry: OrderLogEntry): void {
  logger.info('order_lifecycle', entry)
}

/**
 * Convenience helpers for each lifecycle event.
 */

export function logOrderCreated(params: {
  platformOrderId: string
  userId: string
  totalCents: number
  shopOrderCount: number
}): void {
  logOrderLifecycle({
    event: 'order_created',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    userId: params.userId,
    totalCents: params.totalCents,
    shopOrderCount: params.shopOrderCount,
  })
}

export function logOrderPaid(params: {
  platformOrderId: string
  totalCents: number
  paymentStatus: string
}): void {
  logOrderLifecycle({
    event: 'order_paid',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    totalCents: params.totalCents,
    paymentStatus: params.paymentStatus,
  })
}

export function logOrderShipped(params: {
  shopOrderId: string
  platformOrderId: string
  trackingNumber?: string | null
  trackingUrl?: string | null
}): void {
  logOrderLifecycle({
    event: 'order_shipped',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    shopOrderId: params.shopOrderId,
    trackingNumber: params.trackingNumber ?? undefined,
    trackingUrl: params.trackingUrl ?? undefined,
  })
}

export function logOrderDelivered(params: { shopOrderId: string; platformOrderId: string }): void {
  logOrderLifecycle({
    event: 'order_delivered',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    shopOrderId: params.shopOrderId,
  })
}

export function logOrderDisputed(params: {
  disputeId: string
  shopOrderId: string
  platformOrderId: string
  reason: string
}): void {
  logOrderLifecycle({
    event: 'order_disputed',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    shopOrderId: params.shopOrderId,
    disputeId: params.disputeId,
    reason: params.reason,
  })
}

export function logOrderResolved(params: {
  disputeId: string
  shopOrderId: string
  platformOrderId: string
  resolution: string
  refundCents: number | null
}): void {
  logOrderLifecycle({
    event: 'order_resolved',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    shopOrderId: params.shopOrderId,
    disputeId: params.disputeId,
    resolution: params.resolution,
    refundCents: params.refundCents,
  })
}

export function logOrderCancelled(params: { platformOrderId: string; reason?: string }): void {
  logOrderLifecycle({
    event: 'order_cancelled',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    reason: params.reason,
  })
}

export function logOrderTrackingUpdated(params: {
  shopOrderId: string
  platformOrderId: string
  trackingNumber?: string | null
  trackingUrl?: string | null
}): void {
  logOrderLifecycle({
    event: 'order_tracking_updated',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    shopOrderId: params.shopOrderId,
    trackingNumber: params.trackingNumber ?? undefined,
    trackingUrl: params.trackingUrl ?? undefined,
  })
}

export function logManualReviewResolved(params: {
  shopOrderId: string
  platformOrderId: string
  resolution: 'paid' | 'cancelled'
  reason?: string
}): void {
  logOrderLifecycle({
    event: 'manual_review_resolved',
    timestamp: new Date().toISOString(),
    orderId: params.platformOrderId,
    shopOrderId: params.shopOrderId,
    resolution: params.resolution,
    reason: params.reason,
  })
}
