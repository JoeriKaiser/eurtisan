import { describe, expect, it } from 'vitest'
import type { OrderStatus } from '../order-status'
import { derivePlatformStatus, isValidStatusTransition } from './lifecycle'

const ALL_STATUSES: readonly OrderStatus[] = [
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

const EXPECTED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled', 'refunded'],
  paid: ['processing', 'shipped', 'refunded'],
  processing: ['shipped', 'refunded'],
  shipped: ['delivered', 'disputed', 'refunded'],
  delivered: ['completed', 'disputed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  disputed: ['refunded', 'completed'],
  manual_review: ['paid', 'cancelled', 'refunded'],
  chargeback: [],
}

describe('shop-order lifecycle rules', () => {
  it('matches the complete transition matrix', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(isValidStatusTransition(from, to), `${from} -> ${to}`).toBe(
          EXPECTED_TRANSITIONS[from].includes(to),
        )
      }
    }
  })

  it('keeps terminal states terminal', () => {
    for (const status of ['cancelled', 'refunded', 'chargeback'] as const) {
      expect(ALL_STATUSES.some((next) => isValidStatusTransition(status, next))).toBe(false)
    }
  })

  it('prioritizes review and risk states over fulfillment progress', () => {
    expect(derivePlatformStatus(['completed', 'chargeback'])).toBe('chargeback')
    expect(derivePlatformStatus(['chargeback', 'disputed'])).toBe('disputed')
    expect(derivePlatformStatus(['disputed', 'manual_review'])).toBe('manual_review')
  })

  it('ignores cancelled and refunded children while active children remain', () => {
    expect(derivePlatformStatus(['completed', 'cancelled', 'refunded'])).toBe('completed')
    expect(derivePlatformStatus(['shipped', 'cancelled', 'refunded'])).toBe('shipped')
  })
})
