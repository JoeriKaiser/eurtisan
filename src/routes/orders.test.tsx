// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BuyerOrderDetailPage from '#/components/BuyerOrderDetailPage'
import { OrdersPage } from '#/components/OrdersPage'
import type { BuyerOrderListItem, OrderDetail } from '#/lib/orders.server'

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
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    orders_title: () => 'My orders',
    orders_empty: () => "You haven't placed any orders yet.",
    orders_empty_cta: () => 'Browse the marketplace',
    orders_error: () => 'Failed to load orders. Please try again.',
    orders_order_id: () => 'Order',
    orders_shop_count: ({ count }: { count: string }) => `${count} shops`,
    pagination_page_of: ({ page, totalPages }: { page: string; totalPages: string }) =>
      `Page ${page} of ${totalPages}`,
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    order_detail_title: () => 'Order details',
    order_detail_date: () => 'Order date',
    order_detail_total: () => 'Total',
    order_detail_items: () => 'Items',
    order_detail_tracking: () => 'Tracking',
    order_detail_track_package: () => 'Track package',
    order_detail_not_yet_shipped: () => 'Not yet shipped',
    order_detail_shipping_address: () => 'Shipping address',
    order_detail_cancelled: () => 'Cancelled',
    order_detail_cancelled_at: ({ date }: { date: string }) => `Cancelled on ${date}`,
    order_detail_cancellation_reason: ({ reason }: { reason: string }) => `Reason: ${reason}`,
    order_detail_review: () => 'Write a review',
    order_detail_review_disabled: ({ date }: { date: string }) => `Review available from ${date}`,
    order_detail_review_disabled_tooltip: ({ days }: { days: string }) => `${days} days remaining`,
    review_days_remaining: ({ days }: { days: string }) => `${days} days remaining`,
    review_submitted: () => 'Review submitted',
    review_modal_title: () => 'Write a review',
    review_modal_description: () => 'Share your experience with this product.',
    review_modal_close: () => 'Close review form',
    review_star_label: ({ star }: { star: string }) => `Rate ${star} out of 5 stars`,
    review_rating_prompt: () => 'Click a star to rate',
    review_rating_selected: ({ rating }: { rating: string }) => `You rated ${rating} out of 5`,
    review_comment_label: () => 'Comment (optional)',
    review_comment_placeholder: () => "Tell others what you liked or didn't like...",
    review_submit: () => 'Submit review',
    review_cancel: () => 'Cancel',
    order_detail_shop_status: () => 'complete',
    orders_back_to_list: () => 'Back to orders',
    order_success_continue_shopping: () => 'Continue shopping',
    cart_shop_subtotal: () => 'Subtotal',
    error_not_found: () => 'Page not found',
    error_not_found_description: () => 'The page you are looking for does not exist.',
    order_detail_open_dispute: () => 'Open dispute',
    order_detail_dispute_disabled_tooltip: () => 'Dispute window has expired (30 days)',
    dispute_modal_title: () => 'Open a dispute',
    dispute_modal_description: () => 'Describe the issue with your order.',
    dispute_reason_label: () => 'Reason',
    dispute_reason_item_not_received: () => 'Item not received',
    dispute_reason_not_as_described: () => 'Not as described',
    dispute_reason_damaged: () => 'Damaged',
    dispute_reason_other: () => 'Other',
    dispute_description_label: () => 'Description',
    dispute_description_placeholder: () => 'Please describe the issue in detail...',
    dispute_submit: () => 'Submit dispute',
    dispute_cancel: () => 'Cancel',
    dispute_modal_close: () => 'Close dispute form',
  },
}))

vi.mock('#/lib/orders-ui', () => ({
  statusBadgeVariant: (status: string) => {
    if (status === 'delivered' || status === 'completed') return 'success'
    if (status === 'cancelled') return 'error'
    return 'default'
  },
}))

vi.mock('#/lib/disputes', () => ({
  openDispute: vi.fn(),
}))

function makeOrderListItem(overrides?: Partial<BuyerOrderListItem>): BuyerOrderListItem {
  return {
    id: 'order-123',
    totalCents: 2500,
    status: 'paid',
    createdAt: new Date('2026-05-10T12:00:00Z'),
    shopCount: 1,
    shopSummary: [{ shopId: 'shop-1', shopName: 'Test Shop', status: 'paid' }],
    ...overrides,
  }
}

function makeOrderDetail(overrides?: Partial<OrderDetail>): OrderDetail {
  return {
    id: 'order-123',
    totalCents: 2500,
    status: 'paid',
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
        status: 'paid',
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
          },
        ],
      },
    ],
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
    expect(screen.getByText(/order-123/)).toBeDefined()
    expect(screen.getByText('€25,00')).toBeDefined()
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
})

describe('Order detail page', () => {
  it('renders order details', () => {
    render(<BuyerOrderDetailPage order={makeOrderDetail()} />)
    expect(screen.getByRole('heading', { name: 'Order details' })).toBeDefined()
    expect(screen.getByText('order-123')).toBeDefined()
    expect(screen.getByText('€25,00')).toBeDefined()
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getAllByText('Vase').length).toBeGreaterThanOrEqual(1)
  })

  it('renders shipping address', () => {
    render(<BuyerOrderDetailPage order={makeOrderDetail()} />)
    expect(screen.getByText('123 Main St')).toBeDefined()
    expect(screen.getByText(/Berlin/)).toBeDefined()
  })

  it('renders carrier name and tracking number when shipping label exists', () => {
    const order = makeOrderDetail({
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'shipped',
          trackingNumber: 'TRACK123',
          trackingUrl: 'https://track.example.com/123',
          deliveredAt: null,
          shippingLabel: {
            carrier: 'mondial_relay',
            trackingNumber: 'TRACK123',
            labelUrl: 'https://label.example.com/123',
            createdAt: new Date('2026-05-10T12:00:00Z'),
          },
          trackingStatus: 'in_transit',
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getByText('Mondial Relay')).toBeDefined()
    expect(screen.getByText('TRACK123')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Track package' })).toBeDefined()
    expect(screen.getByText('In transit')).toBeDefined()
  })

  it('renders tracking link using carrier URL when shop trackingUrl is invalid', () => {
    const order = makeOrderDetail({
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'shipped',
          trackingNumber: 'TRACK123',
          trackingUrl: 'not-a-url',
          deliveredAt: null,
          shippingLabel: {
            carrier: 'mondial_relay',
            trackingNumber: 'TRACK123',
            labelUrl: 'https://label.example.com/123',
            createdAt: new Date('2026-05-10T12:00:00Z'),
          },
          trackingStatus: 'in_transit',
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    const link = screen.getByRole('link', { name: 'Track package' })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toContain('mondialrelay.com')
  })

  it('shows tracking status summary for delivered orders', () => {
    const order = makeOrderDetail({
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: new Date('2026-05-10T12:00:00Z'),
          shippingLabel: {
            carrier: 'mondial_relay',
            trackingNumber: 'TRACK123',
            labelUrl: 'https://label.example.com/123',
            createdAt: new Date('2026-05-10T12:00:00Z'),
          },
          trackingStatus: 'delivered',
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getByText('Delivered')).toBeDefined()
  })

  it('shows not yet shipped for orders without a shipping label', () => {
    const order = makeOrderDetail({
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'processing',
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
            },
          ],
        },
      ],
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getByText('Not yet shipped')).toBeDefined()
  })

  it('does not show not yet shipped for paid orders', () => {
    const order = makeOrderDetail({
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'paid',
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
            },
          ],
        },
      ],
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.queryByText('Not yet shipped')).toBeNull()
  })

  it('renders multiple shop orders with independent tracking info', () => {
    const order = makeOrderDetail({
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Shop A',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'shipped',
          trackingNumber: 'TRACK001',
          trackingUrl: 'https://track.example.com/001',
          deliveredAt: null,
          shippingLabel: {
            carrier: 'mondial_relay',
            trackingNumber: 'TRACK001',
            labelUrl: 'https://label.example.com/001',
            createdAt: new Date('2026-05-10T12:00:00Z'),
          },
          trackingStatus: 'in_transit',
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
        {
          shopOrderId: 'so-2',
          shopId: 'shop-2',
          shopName: 'Shop B',
          shippingMethod: 'express',
          shippingCostCents: 800,
          subtotalCents: 1500,
          status: 'processing',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: null,
          shippingLabel: null,
          trackingStatus: null,
          items: [
            {
              id: 'item-2',
              productId: 'prod-2',
              productName: 'Bowl',
              unitPriceCents: 1500,
              quantity: 1,
              totalCents: 1500,
            },
          ],
        },
      ],
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getByText('Shop A')).toBeDefined()
    expect(screen.getByText('Shop B')).toBeDefined()
    expect(screen.getAllByText('In transit').length).toBe(1)
    expect(screen.getAllByText('Not yet shipped').length).toBe(1)
    expect(screen.getAllByRole('link', { name: 'Track package' }).length).toBe(1)
  })

  it('renders cancellation info for cancelled orders', () => {
    const order = makeOrderDetail({
      status: 'cancelled',
      cancelledAt: new Date('2026-05-11T12:00:00Z'),
      cancellationReason: 'Payment failed',
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getByText('Cancelled')).toBeDefined()
    expect(screen.getByText(/Cancelled on/)).toBeDefined()
    expect(screen.getByText('Reason: Payment failed')).toBeDefined()
  })

  it('renders review CTA for delivered orders after 14 days', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    const order = makeOrderDetail({
      status: 'delivered',
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fifteenDaysAgo,
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
            },
          ],
        },
      ],
    })
    const reviewableItems = [
      {
        shopOrderId: 'so-1',
        productId: 'prod-1',
        productName: 'Vase',
        deliveredAt: fifteenDaysAgo,
        isEligible: true,
        daysRemaining: null,
        hasReview: false,
      },
    ]
    render(<BuyerOrderDetailPage order={order} reviewableItems={reviewableItems} />)
    const reviewButton = screen.getByRole('button', { name: 'Write a review' })
    expect(reviewButton).toBeDefined()
    expect(reviewButton.hasAttribute('disabled')).toBe(false)
  })

  it('renders review disabled message for delivered orders within 14 days', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const order = makeOrderDetail({
      status: 'delivered',
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fiveDaysAgo,
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
            },
          ],
        },
      ],
    })
    const reviewableItems = [
      {
        shopOrderId: 'so-1',
        productId: 'prod-1',
        productName: 'Vase',
        deliveredAt: fiveDaysAgo,
        isEligible: false,
        daysRemaining: 10,
        hasReview: false,
      },
    ]
    render(<BuyerOrderDetailPage order={order} reviewableItems={reviewableItems} />)
    expect(screen.getByText(/Review available from/)).toBeDefined()
  })

  it('renders per-shop progress indicator', () => {
    const order = makeOrderDetail({
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'shipped',
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
            },
          ],
        },
      ],
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getByRole('progressbar')).toBeDefined()
  })

  it('renders open dispute button for delivered orders within 30 days', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const order = makeOrderDetail({
      status: 'delivered',
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fiveDaysAgo,
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
            },
          ],
        },
      ],
    })
    render(<BuyerOrderDetailPage order={order} />)
    const disputeButton = screen.getByRole('button', { name: 'Open dispute' })
    expect(disputeButton).toBeDefined()
    expect(disputeButton.hasAttribute('disabled')).toBe(false)
  })

  it('does not render dispute button for non-delivered orders', () => {
    const order = makeOrderDetail({
      status: 'paid',
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'paid',
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
            },
          ],
        },
      ],
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.queryByRole('button', { name: 'Open dispute' })).toBeNull()
  })

  it('renders disabled dispute button with tooltip for delivered orders past 30 days', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
    const order = makeOrderDetail({
      status: 'delivered',
      shops: [
        {
          shopOrderId: 'so-1',
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fortyDaysAgo,
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
            },
          ],
        },
      ],
    })
    render(<BuyerOrderDetailPage order={order} />)
    const disputeButton = screen.getByRole('button', { name: 'Open dispute' })
    expect(disputeButton).toBeDefined()
    expect(disputeButton.hasAttribute('disabled')).toBe(true)
  })
})
