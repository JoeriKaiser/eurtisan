// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OrderSuccessPage from './OrderSuccessPage'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    params?: Record<string, string>
  }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    order_success_title: () => 'Order placed successfully',
    order_success_description: () => 'Thank you for your purchase!',
    order_pending_title: () => 'Confirming payment…',
    order_pending_description: () => "We're waiting for your payment to be confirmed.",
    order_failed_title: () => 'Payment failed',
    order_failed_description: () => 'Your payment could not be processed.',
    order_failed_expired_title: () => 'Payment expired',
    order_failed_expired_description: () => 'Your payment session expired.',
    order_failed_failed_title: () => 'Payment failed',
    order_failed_failed_description: () => 'Your payment could not be processed.',
    order_failed_cancelled_title: () => 'Payment cancelled',
    order_failed_cancelled_description: () => 'You cancelled the payment.',
    order_failed_retry_payment: () => 'Retry payment',
    order_failed_contact_support: () => 'Contact support',
    order_failed_view_order: () => 'View order details',
    order_failed_rebuild_cart: () => 'Rebuild my cart',
    order_failed_rebuild_error: () => 'Could not rebuild cart',
    order_pending_retry_payment: () => 'Retry payment',
    checkout_missing_url: () => 'Checkout URL is missing. Please try again.',
    checkout_error_submit: () => 'Could not complete checkout. Please try again.',
    order_success_order_id: () => 'Order ID',
    order_success_order_number: () => 'Order number',
    order_success_items: () => 'Ordered items',
    order_success_continue_shopping: () => 'Continue shopping',
    order_success_view_order: () => 'View order details',
    order_success_invoice: ({ shop }: { shop: string }) => `Invoice from ${shop}`,
    order_success_next_steps: () => 'What happens next',
    order_success_email_sent: ({ email }: { email: string }) => `Email sent to ${email}`,
    order_detail_shipping_address: () => 'Shipping address',
    order_success_total: () => 'Total',
    order_success_withdrawal_reminder: () =>
      'You have 14 days to withdraw from this purchase if needed.',
    footer_legal_terms: () => 'Terms of Service',
    cart_shop_subtotal: () => 'Subtotal',
  },
}))

import type { OrderDetail } from '#/lib/orders.server'

function makeOrder(status: OrderDetail['status'] = 'paid'): OrderDetail {
  return {
    id: 'order-123',
    orderNumber: 'EUR-123456',
    totalCents: 2500,
    status,
    createdAt: new Date('2026-05-10T12:00:00Z'),
    cancelledAt: null,
    cancellationReason: null,
    shippingAddress: {
      name: 'Test User',
      street: '123 Main St',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Germany',
    },
    shops: [
      {
        shopOrderId: 'so-1',
        shopId: 'shop-1',
        shopName: 'Test Shop',
        shippingMethod: 'standard',
        shippingRateId: null,
        shippingCostCents: 500,
        subtotalCents: 2000,
        vatAmountCents: 0,
        shippingVatRateBasisPoints: 0,
        shippingVatAmountCents: 0,
        status,
        trackingNumber: null,
        trackingUrl: null,
        deliveredAt: null,
        shippingLabels: [],
        trackingStatus: null,
        invoiceNumber: null,
        disputeId: null,
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Vase',
            unitPriceCents: 1000,
            quantity: 2,
            totalCents: 2000,
            vatRateBasisPoints: 0,
            vatAmountCents: 0,
          },
        ],
      },
    ],
  }
}

describe('OrderSuccessPage', () => {
  it('renders success title and description for paid orders', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByRole('heading', { name: 'Order placed successfully' })).toBeDefined()
    expect(screen.getByText('Thank you for your purchase!')).toBeDefined()
  })

  it('renders order number', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText(/EUR-123456/)).toBeDefined()
  })

  it('renders total', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText('€25.00')).toBeDefined()
  })

  it('renders shop name and items', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getAllByText('Vase').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('€10.00 × 2')).toBeDefined()
    expect(screen.getAllByText('€20.00').length).toBeGreaterThanOrEqual(1)
  })

  it('renders shipping method and cost', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText(/standard:\s*€5.00/i)).toBeDefined()
  })

  it('renders continue shopping button', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toBeDefined()
  })

  it('renders multiple shops', () => {
    const order = makeOrder('paid')
    order.shops.push({
      shopOrderId: 'so-2',
      shopId: 'shop-2',
      shopName: 'Second Shop',
      shippingMethod: 'express' as const,
      shippingRateId: null,
      shippingCostCents: 1000,
      subtotalCents: 3000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'shipped',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://example.com/track',
      deliveredAt: null,
      shippingLabels: [],
      trackingStatus: null,
      invoiceNumber: null,
      disputeId: null,
      items: [
        {
          id: 'item-2',
          productId: 'prod-2',
          productName: 'Bowl',
          unitPriceCents: 1500,
          quantity: 2,
          totalCents: 3000,
          vatRateBasisPoints: 0,
          vatAmountCents: 0,
        },
      ],
    })
    order.totalCents = 6500

    render(<OrderSuccessPage order={order} />)
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getByText('Second Shop')).toBeDefined()
    expect(screen.getAllByText('Bowl').length).toBeGreaterThanOrEqual(1)
  })

  describe('pending payment state', () => {
    it('renders pending title and description', () => {
      render(<OrderSuccessPage order={makeOrder('pending_payment')} />)
      expect(screen.getByRole('heading', { name: 'Confirming payment…' })).toBeDefined()
      expect(screen.getByText("We're waiting for your payment to be confirmed.")).toBeDefined()
    })

    it('still renders order details while pending', () => {
      render(<OrderSuccessPage order={makeOrder('pending_payment')} />)
      expect(screen.getByText(/EUR-123456/)).toBeDefined()
      expect(screen.getByText('€25.00')).toBeDefined()
      expect(screen.getByText('Test Shop')).toBeDefined()
    })

    it('renders continue shopping button while pending', () => {
      render(<OrderSuccessPage order={makeOrder('pending_payment')} />)
      expect(screen.getByRole('link', { name: 'Continue shopping' })).toBeDefined()
    })

    it('renders retry payment button when handler is provided', () => {
      render(
        <OrderSuccessPage
          order={makeOrder('pending_payment')}
          onRetryPayment={vi.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.test' })}
        />,
      )
      expect(screen.getByRole('button', { name: 'Retry payment' })).toBeDefined()
    })

    it('redirects to checkout URL when retry payment succeeds', async () => {
      const savedLocation = window.location
      delete (window as { location?: unknown }).location
      window.location = { ...savedLocation, href: '' } as Location & string

      const checkoutUrl = 'https://checkout.mollie.com/pay/retry_001'
      const onRetryPayment = vi.fn().mockResolvedValue({ checkoutUrl })

      render(
        <OrderSuccessPage order={makeOrder('pending_payment')} onRetryPayment={onRetryPayment} />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Retry payment' }))

      await waitFor(() => {
        expect(onRetryPayment).toHaveBeenCalledTimes(1)
        expect(window.location.href).toBe(checkoutUrl)
      })

      window.location = savedLocation as Location & string
    })

    it('displays error when retry payment fails', async () => {
      const onRetryPayment = vi
        .fn()
        .mockRejectedValue(
          new Response(JSON.stringify({ message: 'Payment provider error' }), { status: 503 }),
        )

      render(
        <OrderSuccessPage order={makeOrder('pending_payment')} onRetryPayment={onRetryPayment} />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Retry payment' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined()
        expect(screen.getByText('Payment provider error')).toBeDefined()
      })
    })
  })

  describe('cancelled state', () => {
    it('renders cancelled title and description by default', () => {
      render(<OrderSuccessPage order={makeOrder('cancelled')} />)
      expect(screen.getByRole('heading', { name: 'Payment cancelled' })).toBeDefined()
      expect(screen.getByText('You cancelled the payment.')).toBeDefined()
    })

    it('renders expired title and description when cancellation reason mentions expiry', () => {
      const order = makeOrder('cancelled')
      order.cancellationReason = 'payment_expired'
      render(<OrderSuccessPage order={order} />)
      expect(screen.getByRole('heading', { name: 'Payment expired' })).toBeDefined()
      expect(screen.getByText('Your payment session expired.')).toBeDefined()
    })

    it('renders failed title and description when cancellation reason mentions failure', () => {
      const order = makeOrder('cancelled')
      order.cancellationReason = 'payment_failed'
      render(<OrderSuccessPage order={order} />)
      expect(screen.getByRole('heading', { name: 'Payment failed' })).toBeDefined()
      expect(screen.getByText('Your payment could not be processed.')).toBeDefined()
    })

    it('still renders order details when cancelled', () => {
      render(<OrderSuccessPage order={makeOrder('cancelled')} />)
      expect(screen.getByText(/EUR-123456/)).toBeDefined()
      expect(screen.getByText('€25.00')).toBeDefined()
      expect(screen.getByText('Test Shop')).toBeDefined()
    })

    it('renders continue shopping button as secondary when cancelled', () => {
      render(<OrderSuccessPage order={makeOrder('cancelled')} />)
      const link = screen.getByRole('link', { name: 'Continue shopping' })
      expect(link).toBeDefined()
      const button = link.querySelector('button')
      expect(button).not.toBeNull()
      expect(button?.className.includes('bg-surface-default')).toBe(true)
    })

    it('renders retry payment, contact support and view order buttons when cancelled', () => {
      render(
        <OrderSuccessPage
          order={makeOrder('cancelled')}
          onRetryPayment={vi.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.test' })}
        />,
      )
      expect(screen.getByRole('button', { name: 'Retry payment' })).toBeDefined()
      expect(screen.getByRole('link', { name: 'Contact support' })).toBeDefined()
      expect(screen.getByRole('link', { name: 'View order details' })).toBeDefined()
    })

    it('redirects to checkout URL when retry payment succeeds from cancelled state', async () => {
      const savedLocation = window.location
      delete (window as { location?: unknown }).location
      window.location = { ...savedLocation, href: '' } as Location & string

      const checkoutUrl = 'https://checkout.mollie.com/pay/retry_001'
      const onRetryPayment = vi.fn().mockResolvedValue({ checkoutUrl })

      render(<OrderSuccessPage order={makeOrder('cancelled')} onRetryPayment={onRetryPayment} />)

      fireEvent.click(screen.getByRole('button', { name: 'Retry payment' }))

      await waitFor(() => {
        expect(onRetryPayment).toHaveBeenCalledTimes(1)
        expect(window.location.href).toBe(checkoutUrl)
      })

      window.location = savedLocation as Location & string
    })
  })
})
