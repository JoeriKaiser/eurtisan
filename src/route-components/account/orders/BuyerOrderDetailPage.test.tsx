// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { OrderDetail } from '#/lib/orders.server'
import BuyerOrderDetailPage from './BuyerOrderDetailPage'

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
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    orders_title: () => 'My orders',
    orders_empty: () => "You haven't placed any orders yet.",
    orders_empty_cta: () => 'Browse the marketplace',
    orders_error: () => 'Failed to load orders. Please try again.',
    orders_order_id: () => 'Order',
    orders_order_number: () => 'Order number',
    orders_shop_count: ({ count }: { count: number }) =>
      `${count} ${count === 1 ? 'shop' : 'shops'}`,
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
    order_detail_contact_support: () => 'Contact support',
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
    order_detail_view_dispute: () => 'View dispute',
    order_detail_dispute_disabled_tooltip: () => 'Dispute window has expired (30 days)',
    return_order_help_title: () => 'Need to return something?',
    return_order_help: () => 'Start or review a return request.',
    return_view_request: () => 'View return',
    return_start_request: () => 'Start return',
    order_non_delivery_title: () => 'Buyer protection',
    order_non_delivery_eligible: () => 'This order is eligible for a non-delivery report.',
    order_non_delivery_eligible_date: ({ date }: { date: string }) =>
      `You can report non-delivery from ${date}.`,
    order_non_delivery_unavailable: () => 'Non-delivery reporting is unavailable.',
    order_non_delivery_evidence_guidance: () =>
      'Include tracking updates and messages with the seller.',
    order_non_delivery_report: () => 'Report non-delivery',
    order_non_delivery_modal_description: () =>
      'Tell us what happened so the seller and support team can review it.',
    order_non_delivery_confirmation: () =>
      'I confirm that the order has not arrived and this information is accurate.',
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
    error_cart_empty: () => 'Cart is empty',
    error_out_of_stock: () => 'Some items are out of stock',
    error_dispute_window_expired: () => 'Dispute window has expired (30 days)',
    error_unexpected: () => 'An unexpected error occurred',
    error_access_denied: () => 'Access denied',
    error_dispute_exists: () => 'A dispute already exists for this order',
    error_order_not_delivered: () => 'Order must be delivered before opening a dispute',
    error_order_delivery_date_missing: () => 'Order delivery date is missing',
    error_non_delivery_not_eligible: () => 'This order is not yet eligible.',
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

vi.mock('#/lib/disputes', () => ({
  openDispute: vi.fn(),
}))

vi.mock('#/components/ui/primitives/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? React.createElement(React.Fragment, {}, children) : null,
  DialogBackdrop: () => null,
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('p', {}, children),
  DialogPopup: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', {}, children),
  DialogPortal: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, {}, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', {}, children),
}))

function makeOrderDetail(overrides?: Partial<OrderDetail>): OrderDetail {
  return {
    id: 'order-123',
    orderNumber: 'EUR-123456',
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
        shippingRateId: null,
        shippingCostCents: 500,
        subtotalCents: 2000,
        vatAmountCents: 0,
        shippingVatRateBasisPoints: 0,
        shippingVatAmountCents: 0,
        status: 'paid',
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
    ...overrides,
  }
}

describe('Order detail page', () => {
  it('renders order details', () => {
    render(<BuyerOrderDetailPage order={makeOrderDetail()} />)
    expect(screen.getByRole('heading', { name: 'Order details' })).toBeDefined()
    expect(screen.getByText(/EUR-123456/)).toBeDefined()
    expect(screen.getByText('€25.00')).toBeDefined()
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'shipped',
          trackingNumber: 'TRACK123',
          trackingUrl: 'https://track.example.com/123',
          deliveredAt: null,
          shippingLabels: [
            {
              carrier: 'sendcloud',
              trackingNumber: 'TRACK123',
              labelUrl: 'https://label.example.com/123',
              createdAt: new Date('2026-05-10T12:00:00Z'),
            },
          ],
          trackingStatus: 'in_transit',
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getByText('Sendcloud')).toBeDefined()
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'shipped',
          trackingNumber: 'TRACK123',
          trackingUrl: 'not-a-url',
          deliveredAt: null,
          shippingLabels: [
            {
              carrier: 'sendcloud',
              trackingNumber: 'TRACK123',
              labelUrl: 'https://label.example.com/123',
              createdAt: new Date('2026-05-10T12:00:00Z'),
            },
          ],
          trackingStatus: 'in_transit',
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    const link = screen.getByRole('link', { name: 'Track package' })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toContain('sendcloud.com')
  })

  it('shows tracking status summary for delivered orders', () => {
    const order = makeOrderDetail({
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
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: new Date('2026-05-10T12:00:00Z'),
          shippingLabels: [
            {
              carrier: 'sendcloud',
              trackingNumber: 'TRACK123',
              labelUrl: 'https://label.example.com/123',
              createdAt: new Date('2026-05-10T12:00:00Z'),
            },
          ],
          trackingStatus: 'delivered',
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1)
  })

  it('does not show progress or not-yet-shipped for delivered orders without labels', () => {
    const order = makeOrderDetail({
      status: 'delivered',
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
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: new Date('2026-05-10T12:00:00Z'),
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText('Not yet shipped')).toBeNull()
    expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1)
  })

  it('shows not yet shipped for orders without a shipping label', () => {
    const order = makeOrderDetail({
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
          status: 'processing',
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'paid',
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'shipped',
          trackingNumber: 'TRACK001',
          trackingUrl: 'https://track.example.com/001',
          deliveredAt: null,
          shippingLabels: [
            {
              carrier: 'sendcloud',
              trackingNumber: 'TRACK001',
              labelUrl: 'https://label.example.com/001',
              createdAt: new Date('2026-05-10T12:00:00Z'),
            },
          ],
          trackingStatus: 'in_transit',
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
        {
          shopOrderId: 'so-2',
          shopId: 'shop-2',
          shopName: 'Shop B',
          shippingMethod: 'express',
          shippingRateId: null,
          shippingCostCents: 800,
          subtotalCents: 1500,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'processing',
          trackingNumber: null,
          trackingUrl: null,
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
              quantity: 1,
              totalCents: 1500,
              vatRateBasisPoints: 0,
              vatAmountCents: 0,
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
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1)
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fifteenDaysAgo,
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fiveDaysAgo,
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'shipped',
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fiveDaysAgo,
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'paid',
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    expect(screen.queryByRole('button', { name: 'Open dispute' })).toBeNull()
  })

  it('shows the server-derived non-delivery eligibility date before reporting opens', () => {
    const order = makeOrderDetail()
    order.shops[0].nonDeliveryEligibility = {
      eligible: false,
      eligibleAt: new Date('2026-07-20T12:00:00Z'),
      basis: null,
      reason: 'fulfillment_in_progress',
    }

    render(<BuyerOrderDetailPage order={order} />)

    expect(screen.getByText(/You can report non-delivery from/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Open dispute' })).toBeNull()
  })

  it('requires confirmation before submitting an eligible non-delivery report', () => {
    const order = makeOrderDetail({ status: 'shipped' })
    order.shops[0].status = 'shipped'
    order.shops[0].nonDeliveryEligibility = {
      eligible: true,
      eligibleAt: new Date('2026-07-10T12:00:00Z'),
      basis: 'shipment_overdue',
      reason: null,
    }

    render(<BuyerOrderDetailPage order={order} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open dispute' }))

    expect(screen.getByText('Item not received')).toBeDefined()
    expect(
      screen.getAllByText('Include tracking updates and messages with the seller.'),
    ).toHaveLength(2)
    const submit = screen.getByRole('button', { name: 'Submit dispute' })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'The parcel has not arrived.' },
    })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'I confirm that the order has not arrived and this information is accurate.',
      }),
    )
    expect(submit.hasAttribute('disabled')).toBe(false)
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
          shippingRateId: null,
          shippingCostCents: 500,
          subtotalCents: 2000,
          vatAmountCents: 0,
          shippingVatRateBasisPoints: 0,
          shippingVatAmountCents: 0,
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fortyDaysAgo,
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
    })
    render(<BuyerOrderDetailPage order={order} />)
    const disputeButton = screen.getByRole('button', { name: 'Open dispute' })
    expect(disputeButton).toBeDefined()
    expect(disputeButton.hasAttribute('disabled')).toBe(true)
  })

  it('shows View dispute link immediately after opening a dispute', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const order = makeOrderDetail({
      status: 'delivered',
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
          status: 'delivered',
          trackingNumber: null,
          trackingUrl: null,
          deliveredAt: fiveDaysAgo,
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
    })
    const { openDispute } = await import('#/lib/disputes')
    vi.mocked(openDispute).mockResolvedValueOnce({ id: 'disp-new' } as Awaited<
      ReturnType<typeof openDispute>
    >)

    render(<BuyerOrderDetailPage order={order} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open dispute' }))

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'The item arrived damaged.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit dispute' }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'View dispute' })).toBeDefined()
    })
    expect(screen.getByRole('link', { name: 'View dispute' }).getAttribute('href')).toContain(
      'disp-new',
    )
  })
})
