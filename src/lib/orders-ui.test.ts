import { describe, expect, it, vi } from 'vitest'
import { getOrderStatusLabel, statusBadgeVariant } from './orders-ui'
import type { OrderStatus } from './orders.server'

vi.mock('#/paraglide/messages', () => ({
  m: {
    orderStatus_pending_payment: () => 'Pending payment',
    orderStatus_paid: () => 'Paid',
    orderStatus_processing: () => 'Processing',
    orderStatus_shipped: () => 'Shipped',
    orderStatus_delivered: () => 'Delivered',
    orderStatus_completed: () => 'Completed',
    orderStatus_cancelled: () => 'Cancelled',
    orderStatus_refunded: () => 'Refunded',
    orderStatus_disputed: () => 'Disputed',
    orderStatus_manual_review: () => 'Manual review',
    orderStatus_chargeback: () => 'Chargeback',
  },
}))

describe('orders-ui', () => {
  describe('getOrderStatusLabel', () => {
    it('returns a label for every supported status', () => {
      const statuses: OrderStatus[] = [
        'pending_payment',
        'paid',
        'processing',
        'shipped',
        'delivered',
        'completed',
        'cancelled',
        'refunded',
        'disputed',
        'manual_review',
        'chargeback',
      ]
      for (const status of statuses) {
        expect(getOrderStatusLabel(status)).toBeTruthy()
      }
    })

    it('falls back to the raw status string for unknown values', () => {
      expect(getOrderStatusLabel('unknown_status' as OrderStatus)).toBe('unknown_status')
    })
  })

  describe('statusBadgeVariant', () => {
    it('maps pending payment to warning', () => {
      expect(statusBadgeVariant('pending_payment')).toBe('warning')
    })

    it('maps paid and processing to primary', () => {
      expect(statusBadgeVariant('paid')).toBe('primary')
      expect(statusBadgeVariant('processing')).toBe('primary')
    })

    it('maps shipped, delivered, and completed to success', () => {
      expect(statusBadgeVariant('shipped')).toBe('success')
      expect(statusBadgeVariant('delivered')).toBe('success')
      expect(statusBadgeVariant('completed')).toBe('success')
    })

    it('maps cancelled, refunded, and disputed to error', () => {
      expect(statusBadgeVariant('cancelled')).toBe('error')
      expect(statusBadgeVariant('refunded')).toBe('error')
      expect(statusBadgeVariant('disputed')).toBe('error')
    })

    it('maps unexpected statuses to default', () => {
      expect(statusBadgeVariant('unknown_status' as OrderStatus)).toBe('default')
    })

    it('uses different variants for statuses that should be visually distinguishable', () => {
      // The audit flagged that primary (moss) and success were indistinguishable.
      // This test documents the intended semantic split even though color
      // distinctness is enforced by the design tokens in styles.css.
      expect(statusBadgeVariant('paid')).not.toBe(statusBadgeVariant('delivered'))
      expect(statusBadgeVariant('processing')).not.toBe(statusBadgeVariant('completed'))
    })
  })
})
