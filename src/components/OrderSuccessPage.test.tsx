// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OrderSuccessPage from './OrderSuccessPage'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
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
    order_success_order_id: () => 'Order ID',
    order_success_items: () => 'Ordered items',
    order_success_continue_shopping: () => 'Continue shopping',
    order_success_total: () => 'Total',
    cart_shop_subtotal: () => 'Subtotal',
  },
}))

import type { OrderDetail } from '#/lib/orders.server'

function makeOrder(status: OrderDetail['status'] = 'paid'): OrderDetail {
  return {
    id: 'order-123',
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
        shippingCostCents: 500,
        subtotalCents: 2000,
        vatAmountCents: 0,
        shippingVatRateBasisPoints: 0,
        shippingVatAmountCents: 0,
        status,
        trackingNumber: null,
        trackingUrl: null,
        deliveredAt: null,
        shippingLabel: null,
        trackingStatus: null,
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

  it('renders order id', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText('order-123')).toBeDefined()
  })

  it('renders total', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText('€25,00')).toBeDefined()
  })

  it('renders shop name and items', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getAllByText('Vase').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('€10,00 × 2')).toBeDefined()
    expect(screen.getAllByText('€20,00').length).toBeGreaterThanOrEqual(1)
  })

  it('renders shipping method and cost', () => {
    render(<OrderSuccessPage order={makeOrder('paid')} />)
    expect(screen.getByText(/standard:\s*€5,00/i)).toBeDefined()
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
      shippingCostCents: 1000,
      subtotalCents: 3000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'shipped',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://example.com/track',
      deliveredAt: null,
      shippingLabel: null,
      trackingStatus: null,
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
      expect(screen.getByText('order-123')).toBeDefined()
      expect(screen.getByText('€25,00')).toBeDefined()
      expect(screen.getByText('Test Shop')).toBeDefined()
    })

    it('renders continue shopping button while pending', () => {
      render(<OrderSuccessPage order={makeOrder('pending_payment')} />)
      expect(screen.getByRole('link', { name: 'Continue shopping' })).toBeDefined()
    })
  })

  describe('cancelled state', () => {
    it('renders failed title and description', () => {
      render(<OrderSuccessPage order={makeOrder('cancelled')} />)
      expect(screen.getByRole('heading', { name: 'Payment failed' })).toBeDefined()
      expect(screen.getByText('Your payment could not be processed.')).toBeDefined()
    })

    it('still renders order details when cancelled', () => {
      render(<OrderSuccessPage order={makeOrder('cancelled')} />)
      expect(screen.getByText('order-123')).toBeDefined()
      expect(screen.getByText('€25,00')).toBeDefined()
      expect(screen.getByText('Test Shop')).toBeDefined()
    })

    it('renders continue shopping button when cancelled', () => {
      render(<OrderSuccessPage order={makeOrder('cancelled')} />)
      expect(screen.getByRole('link', { name: 'Continue shopping' })).toBeDefined()
    })
  })
})
