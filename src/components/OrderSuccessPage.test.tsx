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
    order_success_order_id: () => 'Order ID',
    order_success_items: () => 'Ordered items',
    order_success_continue_shopping: () => 'Continue shopping',
    order_success_total: () => 'Total',
    cart_shop_subtotal: () => 'Subtotal',
  },
}))

import type { OrderDetail } from '#/lib/orders.server'

function makeOrder(): OrderDetail {
  return {
    id: 'order-123',
    totalCents: 2500,
    status: 'pending_payment',
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
        status: 'pending_payment',
        trackingNumber: null,
        trackingUrl: null,
        deliveredAt: null,
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Vase',
            unitPriceCents: 1000,
            quantity: 2,
            totalCents: 2000,
          },
        ],
      },
    ],
  }
}

describe('OrderSuccessPage', () => {
  it('renders success title and description', () => {
    render(<OrderSuccessPage order={makeOrder()} />)
    expect(screen.getByRole('heading', { name: 'Order placed successfully' })).toBeDefined()
    expect(screen.getByText('Thank you for your purchase!')).toBeDefined()
  })

  it('renders order id', () => {
    render(<OrderSuccessPage order={makeOrder()} />)
    expect(screen.getByText('order-123')).toBeDefined()
  })

  it('renders total', () => {
    render(<OrderSuccessPage order={makeOrder()} />)
    expect(screen.getByText('€25,00')).toBeDefined()
  })

  it('renders shop name and items', () => {
    render(<OrderSuccessPage order={makeOrder()} />)
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getAllByText('Vase').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('€10,00 × 2')).toBeDefined()
    expect(screen.getAllByText('€20,00').length).toBeGreaterThanOrEqual(1)
  })

  it('renders shipping method and cost', () => {
    render(<OrderSuccessPage order={makeOrder()} />)
    expect(screen.getByText(/standard — €5,00/i)).toBeDefined()
  })

  it('renders continue shopping button', () => {
    render(<OrderSuccessPage order={makeOrder()} />)
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toBeDefined()
  })

  it('renders multiple shops', () => {
    const order = makeOrder()
    order.shops.push({
      shopOrderId: 'so-2',
      shopId: 'shop-2',
      shopName: 'Second Shop',
      shippingMethod: 'express' as const,
      shippingCostCents: 1000,
      subtotalCents: 3000,
      status: 'shipped',
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://example.com/track',
      deliveredAt: null,
      items: [
        {
          id: 'item-2',
          productId: 'prod-2',
          productName: 'Bowl',
          unitPriceCents: 1500,
          quantity: 2,
          totalCents: 3000,
        },
      ],
    })
    order.totalCents = 6500

    render(<OrderSuccessPage order={order} />)
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getByText('Second Shop')).toBeDefined()
    expect(screen.getAllByText('Bowl').length).toBeGreaterThanOrEqual(1)
  })
})
