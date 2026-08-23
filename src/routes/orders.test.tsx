// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OrdersPage } from '#/components/OrdersPage'
import type { BuyerOrderListItem } from '#/lib/orders.server'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    params?: Record<string, string>
  }) => {
    let href = props.to
    if (props.params) {
      for (const [key, value] of Object.entries(props.params)) {
        href = href.replaceAll(`$${key}`, value)
      }
    }
    return (
      <a href={href} className={props.className}>
        {props.children}
      </a>
    )
  },
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    orders_title: () => 'My orders',
    orders_empty: () => "You haven't placed any orders yet.",
    orders_empty_cta: () => 'Browse the marketplace',
    orders_order_number: () => 'Order number',
    orders_shop_count: ({ count }: { count: number }) =>
      `${count} ${count === 1 ? 'shop' : 'shops'}`,
    pagination_page_of: ({ page, totalPages }: { page: string; totalPages: string }) =>
      `Page ${page} of ${totalPages}`,
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
  },
}))

vi.mock('#/lib/orders-ui', () => ({
  statusBadgeVariant: (status: string) => {
    if (status === 'delivered' || status === 'completed') return 'success'
    if (status === 'cancelled') return 'error'
    return 'default'
  },
  getOrderStatusLabel: (status: string) => {
    const labels: Record<string, string> = {
      pending_payment: 'Pending payment',
      paid: 'Paid',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      completed: 'Completed',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
      disputed: 'Disputed',
      manual_review: 'Manual review',
      chargeback: 'Chargeback',
    }
    return labels[status] ?? status
  },
}))

function makeOrderListItem(overrides?: Partial<BuyerOrderListItem>): BuyerOrderListItem {
  return {
    id: 'order-123',
    orderNumber: 'EUR-123456',
    totalCents: 2500,
    status: 'paid',
    createdAt: new Date('2026-05-10T12:00:00Z'),
    shopCount: 1,
    shopSummary: [{ shopId: 'shop-1', shopName: 'Test Shop', status: 'paid' }],
    ...overrides,
  }
}

describe('Orders list page', () => {
  it('renders orders list', () => {
    const orders = [makeOrderListItem()]
    render(
      <OrdersPage
        orders={orders}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByRole('heading', { name: 'My orders' })).toBeDefined()
    expect(screen.getByText(/EUR-123456/)).toBeDefined()
    expect(screen.getByText('€25.00')).toBeDefined()
  })

  it('renders empty state', () => {
    render(
      <OrdersPage
        orders={[]}
        total={0}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByText("You haven't placed any orders yet.")).toBeDefined()
    expect(screen.getByRole('link', { name: 'Browse the marketplace' })).toBeDefined()
  })

  it('renders per-shop status badges for multi-shop orders', () => {
    const orders = [
      makeOrderListItem({
        shopCount: 2,
        shopSummary: [
          { shopId: 'shop-1', shopName: 'Shop A', status: 'paid' },
          { shopId: 'shop-2', shopName: 'Shop B', status: 'shipped' },
        ],
      }),
    ]
    render(
      <OrdersPage
        orders={orders}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByText('Shop A: paid')).toBeDefined()
    expect(screen.getByText('Shop B: shipped')).toBeDefined()
  })

  it('pluralizes the shop count label', () => {
    render(
      <OrdersPage
        orders={[makeOrderListItem({ shopCount: 1 })]}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByText(/1 shop/)).toBeDefined()
    expect(screen.queryByText(/1 shops/)).toBeNull()

    render(
      <OrdersPage
        orders={[makeOrderListItem({ shopCount: 2 })]}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByText(/2 shops/)).toBeDefined()
  })
})
