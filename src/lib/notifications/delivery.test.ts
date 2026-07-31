import { describe, expect, it } from 'vitest'
import { NOTIFICATION_DELIVERY } from './delivery'
import { notificationTypeEnum } from './operations.server'

/**
 * The delivery table is the spec for how a notification reaches someone. These
 * tests exist so it cannot quietly stop being one.
 */
describe('notification delivery', () => {
  it('covers every notification type', () => {
    // The `Record` already enforces this at compile time; asserted at runtime
    // too because a widened type or a stray cast would silently reopen the gap
    // this table was built to close.
    expect(Object.keys(NOTIFICATION_DELIVERY).sort()).toEqual(
      [...notificationTypeEnum.options].sort(),
    )
  })

  it('sends the consequential seller events by email', () => {
    // These four were in-app only, so a chargeback or a DAC7 warning waited for
    // the seller to happen to open the site.
    for (const type of [
      'order_chargeback',
      'dac7_warning_limit',
      'payout_sent',
      'review_moderated',
    ] as const) {
      expect(NOTIFICATION_DELIVERY[type].mode).toBe('auto_email')
    }
  })

  it('leaves routine, high-frequency events in-app', () => {
    for (const type of ['low_stock', 'review_received'] as const) {
      expect(NOTIFICATION_DELIVERY[type].mode).toBe('in_app')
    }
  })

  it('never auto-sends a type whose flow already emails', () => {
    // The double-send guard: if a type is listed as `caller_email`, the call
    // site sends it and `createNotification` must not.
    const callerSent = Object.entries(NOTIFICATION_DELIVERY).filter(
      ([, delivery]) => delivery.mode === 'caller_email',
    )
    expect(callerSent.length).toBeGreaterThan(0)
    for (const [, delivery] of callerSent) {
      expect(delivery.mode).not.toBe('auto_email')
    }
  })

  it('names where each caller-sent email is sent from', () => {
    // Without this the split is invisible and has to be rediscovered by
    // grepping, which is how it drifted in the first place.
    for (const [type, delivery] of Object.entries(NOTIFICATION_DELIVERY)) {
      if (delivery.mode !== 'caller_email') continue
      expect(delivery.sentBy, `${type} must say where it is sent from`).toMatch(/^lib\/.+\.ts$/)
    }
  })
})
