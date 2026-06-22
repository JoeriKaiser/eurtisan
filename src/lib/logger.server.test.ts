import { describe, expect, it } from 'vitest'

import { redactMeta } from './logger.server'

describe('redactMeta', () => {
  it('redacts sensitive top-level keys', () => {
    const meta = {
      email: 'user@example.com',
      token: 'secret-token',
      password: 'super-secret',
      billingDetails: { name: 'Buyer', totalCents: 1000 },
    }

    const redacted = redactMeta(meta)

    expect(redacted.email).toBe('[REDACTED]')
    expect(redacted.token).toBe('[REDACTED]')
    expect(redacted.password).toBe('[REDACTED]')
    expect(redacted.billingDetails).toBe('[REDACTED]')
  })

  it('preserves non-sensitive identifiers', () => {
    const meta = {
      shopId: 'shop-1',
      orderId: 'order-1',
      molliePaymentId: 'tr_123',
      totalCents: 1000,
    }

    const redacted = redactMeta(meta)

    expect(redacted).toEqual(meta)
  })

  it('does not mutate the original meta object', () => {
    const meta = {
      email: 'user@example.com',
      nested: { email: 'nested@example.com' },
    }

    const redacted = redactMeta(meta)

    expect(meta.email).toBe('user@example.com')
    expect(meta.nested.email).toBe('nested@example.com')
    expect(redacted.email).toBe('[REDACTED]')
    expect(redacted.nested.email).toBe('[REDACTED]')
  })

  it('redacts sensitive keys in nested objects and arrays', () => {
    const meta = {
      items: [
        { name: 'Product A', price: 1000 },
        { shippingAddress: { street: 'Secret St', city: 'Paris' } },
      ],
      buyer: {
        email: 'buyer@example.com',
        phone: '+1234567890',
        vatId: 'FR123',
      },
    }

    const redacted = redactMeta(meta)

    expect(redacted.items[0].name).toBe('[REDACTED]')
    expect(redacted.items[0].price).toBe(1000)
    expect(redacted.items[1].shippingAddress).toBe('[REDACTED]')
    expect(redacted.buyer.email).toBe('[REDACTED]')
    expect(redacted.buyer.phone).toBe('[REDACTED]')
    expect(redacted.buyer.vatId).toBe('[REDACTED]')
  })
})
