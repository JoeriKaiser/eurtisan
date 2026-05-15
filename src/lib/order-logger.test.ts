import { describe, expect, it, vi } from 'vitest'
import {
  logOrderCancelled,
  logOrderCreated,
  logOrderDelivered,
  logOrderDisputed,
  logOrderLifecycle,
  logOrderPaid,
  logOrderResolved,
  logOrderShipped,
} from './order-logger'

describe('logOrderLifecycle', () => {
  it('emits a JSON log entry to console.log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderLifecycle({
      event: 'order_created',
      timestamp: '2026-05-15T12:00:00.000Z',
      orderId: 'order-123',
    })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.level).toBe('info')
    expect(parsed.service).toBe('eurtisan')
    expect(parsed.event).toBe('order_created')
    expect(parsed.orderId).toBe('order-123')
    expect(parsed.timestamp).toBe('2026-05-15T12:00:00.000Z')

    consoleSpy.mockRestore()
  })
})

describe('logOrderCreated', () => {
  it('emits order_created with correct fields', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderCreated({
      platformOrderId: 'po-1',
      userId: 'user-1',
      totalCents: 5000,
      shopOrderCount: 2,
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_created')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed.userId).toBe('user-1')
    expect(parsed.totalCents).toBe(5000)
    expect(parsed.shopOrderCount).toBe(2)
    expect(typeof parsed.timestamp).toBe('string')

    consoleSpy.mockRestore()
  })
})

describe('logOrderPaid', () => {
  it('emits order_paid with correct fields', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderPaid({
      platformOrderId: 'po-1',
      totalCents: 5000,
      paymentStatus: 'paid',
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_paid')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed.totalCents).toBe(5000)
    expect(parsed.paymentStatus).toBe('paid')

    consoleSpy.mockRestore()
  })
})

describe('logOrderShipped', () => {
  it('emits order_shipped with tracking info', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderShipped({
      shopOrderId: 'so-1',
      platformOrderId: 'po-1',
      trackingNumber: 'TRACK-123',
      trackingUrl: 'https://track.example.com/123',
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_shipped')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed.shopOrderId).toBe('so-1')
    expect(parsed.trackingNumber).toBe('TRACK-123')
    expect(parsed.trackingUrl).toBe('https://track.example.com/123')

    consoleSpy.mockRestore()
  })

  it('omits null tracking fields', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderShipped({
      shopOrderId: 'so-1',
      platformOrderId: 'po-1',
      trackingNumber: null,
      trackingUrl: null,
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed).not.toHaveProperty('trackingNumber')
    expect(parsed).not.toHaveProperty('trackingUrl')

    consoleSpy.mockRestore()
  })
})

describe('logOrderDelivered', () => {
  it('emits order_delivered with correct fields', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderDelivered({
      shopOrderId: 'so-1',
      platformOrderId: 'po-1',
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_delivered')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed.shopOrderId).toBe('so-1')

    consoleSpy.mockRestore()
  })
})

describe('logOrderDisputed', () => {
  it('emits order_disputed with reason code', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderDisputed({
      disputeId: 'd-1',
      shopOrderId: 'so-1',
      platformOrderId: 'po-1',
      reason: 'Item not as described',
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_disputed')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed.shopOrderId).toBe('so-1')
    expect(parsed.disputeId).toBe('d-1')
    expect(parsed.reason).toBe('Item not as described')

    consoleSpy.mockRestore()
  })
})

describe('logOrderResolved', () => {
  it('emits order_resolved with resolution and refund', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderResolved({
      disputeId: 'd-1',
      shopOrderId: 'so-1',
      platformOrderId: 'po-1',
      resolution: 'partial_refund',
      refundCents: 2500,
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_resolved')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed.resolution).toBe('partial_refund')
    expect(parsed.refundCents).toBe(2500)

    consoleSpy.mockRestore()
  })
})

describe('logOrderCancelled', () => {
  it('emits order_cancelled with reason', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderCancelled({
      platformOrderId: 'po-1',
      reason: 'Buyer requested cancellation',
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_cancelled')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed.reason).toBe('Buyer requested cancellation')

    consoleSpy.mockRestore()
  })

  it('emits order_cancelled without reason when omitted', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logOrderCancelled({
      platformOrderId: 'po-1',
    })

    const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string)
    expect(parsed.event).toBe('order_cancelled')
    expect(parsed.orderId).toBe('po-1')
    expect(parsed).not.toHaveProperty('reason')

    consoleSpy.mockRestore()
  })
})
