/**
 * Email template rendering tests.
 *
 * Covers all three transactional templates and the plain-text fallback.
 */

import { describe, expect, it } from 'vitest'

import { renderFallbackPlainText, renderTemplate } from './email-templates'

describe('renderTemplate — order_confirmation', () => {
  it('renders HTML and plain text with all fields', async () => {
    const result = await renderTemplate('order_confirmation', {
      orderNumber: 'ORD-123',
      buyerName: 'Alice',
      shopName: 'Pottery by Alice',
      items: [
        { name: 'Ceramic Mug', quantity: 2, price: '€24.00' },
        { name: 'Plate', quantity: 1, price: '€18.00' },
      ],
      total: '€42.00',
      orderUrl: 'https://eurtisan.example.com/orders/123',
    })

    expect(result.subject).toBe('Order Confirmation #ORD-123 — Pottery by Alice')
    expect(result.html).toContain('Alice')
    expect(result.html).toContain('ORD-123')
    expect(result.html).toContain('Ceramic Mug')
    expect(result.html).toContain('€42.00')
    expect(result.html).toContain('https://eurtisan.example.com/orders/123')

    expect(result.text).toContain('Alice')
    expect(result.text).toContain('ORD-123')
    expect(result.text).toContain('Ceramic Mug')
    expect(result.text).toContain('€42.00')
    expect(result.text).toContain('https://eurtisan.example.com/orders/123')
  })

  it('handles missing optional fields gracefully', async () => {
    const result = await renderTemplate('order_confirmation', {
      orderNumber: 'ORD-456',
    })

    expect(result.subject).toBe('Order Confirmation #ORD-456 — Eurtisan')
    expect(result.html).toBeTruthy()
    expect(result.text).toBeTruthy()
    expect(result.text).toContain('No items')
  })

  it('escapes HTML in user-provided strings', async () => {
    const result = await renderTemplate('order_confirmation', {
      orderNumber: 'XSS-TEST',
      buyerName: '<script>alert(1)</script>',
      shopName: 'Shop <b>Test</b>',
      items: [{ name: 'Item "quoted"', quantity: 1, price: '€10' }],
    })

    expect(result.html).not.toContain('<script>alert(1)</script>')
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(result.html).toContain('Item &quot;quoted&quot;')
  })
})

describe('renderTemplate — shipping_notification', () => {
  it('renders HTML and plain text with all fields', async () => {
    const result = await renderTemplate('shipping_notification', {
      orderNumber: 'ORD-123',
      buyerName: 'Bob',
      shopName: 'Woodworks',
      trackingNumber: 'TRK-98765432',
      carrier: 'DHL',
      estimatedDelivery: '2026-06-01',
      trackingUrl: 'https://track.example.com/TRK-98765432',
    })

    expect(result.subject).toBe('Your order #ORD-123 has shipped — Woodworks')
    expect(result.html).toContain('Bob')
    expect(result.html).toContain('TRK-98765432')
    expect(result.html).toContain('DHL')
    expect(result.html).toContain('2026-06-01')
    expect(result.html).toContain('https://track.example.com/TRK-98765432')

    expect(result.text).toContain('Bob')
    expect(result.text).toContain('TRK-98765432')
    expect(result.text).toContain('DHL')
    expect(result.text).toContain('2026-06-01')
  })

  it('handles missing optional fields gracefully', async () => {
    const result = await renderTemplate('shipping_notification', {
      orderNumber: 'ORD-789',
    })

    expect(result.subject).toBe('Your order #ORD-789 has shipped — Eurtisan')
    expect(result.html).toBeTruthy()
    expect(result.text).toBeTruthy()
  })
})

describe('renderTemplate — dispute_update', () => {
  it('renders HTML and plain text with all fields', async () => {
    const result = await renderTemplate('dispute_update', {
      orderNumber: 'ORD-123',
      buyerName: 'Charlie',
      shopName: 'Leather Goods',
      status: 'resolved',
      message: 'A refund of €30 has been issued.',
      disputeUrl: 'https://eurtisan.example.com/disputes/456',
    })

    expect(result.subject).toBe('Dispute update for order #ORD-123 — Leather Goods')
    expect(result.html).toContain('Charlie')
    expect(result.html).toContain('resolved')
    expect(result.html).toContain('A refund of €30 has been issued.')
    expect(result.html).toContain('https://eurtisan.example.com/disputes/456')

    expect(result.text).toContain('Charlie')
    expect(result.text).toContain('resolved')
    expect(result.text).toContain('A refund of €30 has been issued.')
  })

  it('handles missing optional fields gracefully', async () => {
    const result = await renderTemplate('dispute_update', {
      orderNumber: 'ORD-999',
    })

    expect(result.subject).toBe('Dispute update for order #ORD-999 — Eurtisan')
    expect(result.html).toBeTruthy()
    expect(result.text).toBeTruthy()
    expect(result.html).not.toContain('View dispute details')
  })
})

describe('renderFallbackPlainText', () => {
  it('returns a safe plain-text fallback for order_confirmation', () => {
    const result = renderFallbackPlainText('order_confirmation', { orderNumber: '1' })

    expect(result.subject).toBe('[Eurtisan] order confirmation')
    expect(result.text).toContain('order confirmation')
    expect(result.text).toContain('"orderNumber": "1"')
  })

  it('returns a safe plain-text fallback for shipping_notification', () => {
    const result = renderFallbackPlainText('shipping_notification', { trackingNumber: 'T1' })

    expect(result.subject).toBe('[Eurtisan] shipping notification')
    expect(result.text).toContain('shipping notification')
  })

  it('returns a safe plain-text fallback for dispute_update', () => {
    const result = renderFallbackPlainText('dispute_update', { status: 'open' })

    expect(result.subject).toBe('[Eurtisan] dispute update')
    expect(result.text).toContain('dispute update')
  })

  it('returns a safe plain-text fallback for email_verification', () => {
    const result = renderFallbackPlainText('email_verification', { userName: 'Dave' })

    expect(result.subject).toBe('[Eurtisan] email verification')
    expect(result.text).toContain('email verification')
  })

  it('returns a safe plain-text fallback for password_reset', () => {
    const result = renderFallbackPlainText('password_reset', { userName: 'Eve' })

    expect(result.subject).toBe('[Eurtisan] password reset')
    expect(result.text).toContain('password reset')
  })
})

describe('renderTemplate — email_verification', () => {
  it('renders HTML and plain text with all fields', async () => {
    const result = await renderTemplate('email_verification', {
      userName: 'Dave',
      verificationUrl: 'https://eurtisan.example.com/verify-email?token=abc',
    })

    expect(result.subject).toBe('Verify your Eurtisan account')
    expect(result.html).toContain('Dave')
    expect(result.html).toContain('https://eurtisan.example.com/verify-email?token=abc')

    expect(result.text).toContain('Dave')
    expect(result.text).toContain('https://eurtisan.example.com/verify-email?token=abc')
  })
})

describe('renderTemplate — password_reset', () => {
  it('renders HTML and plain text with all fields', async () => {
    const result = await renderTemplate('password_reset', {
      userName: 'Eve',
      resetUrl: 'https://eurtisan.example.com/reset-password?token=xyz',
    })

    expect(result.subject).toBe('Reset your Eurtisan password')
    expect(result.html).toContain('Eve')
    expect(result.html).toContain('https://eurtisan.example.com/reset-password?token=xyz')

    expect(result.text).toContain('Eve')
    expect(result.text).toContain('https://eurtisan.example.com/reset-password?token=xyz')
  })
})

describe('renderTemplate — account_security_alert', () => {
  it('renders HTML and plain text with all fields', async () => {
    const result = await renderTemplate('account_security_alert', {
      userName: 'Frank',
      lockoutDurationMinutes: 30,
    })

    expect(result.subject).toBe('Security alert: your Eurtisan account has been temporarily locked')
    expect(result.html).toContain('Frank')
    expect(result.html).toContain('30')

    expect(result.text).toContain('Frank')
    expect(result.text).toContain('30')
  })
})

describe('renderFallbackPlainText — account_security_alert', () => {
  it('returns a safe plain-text fallback', () => {
    const result = renderFallbackPlainText('account_security_alert', { userName: 'Frank' })

    expect(result.subject).toBe('[Eurtisan] account security alert')
    expect(result.text).toContain('account security alert')
  })
})
