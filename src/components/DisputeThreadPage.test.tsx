// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DisputeDetail } from '#/lib/disputes.server'
import DisputeThreadPage, { DisputeThreadError, DisputeThreadLoading } from './DisputeThreadPage'

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
    dispute_back_to_order: () => 'Back to order',
    dispute_title: () => 'Dispute',
    dispute_status: () => 'Status',
    dispute_reason: () => 'Reason',
    dispute_order_info: () => 'Order information',
    dispute_shop: () => 'Shop',
    dispute_order_total: () => 'Order total',
    dispute_messages_title: () => 'Messages',
    dispute_messages_empty: () => 'No messages yet.',
    dispute_message_placeholder: () => 'Write a message...',
    dispute_message_submit: () => 'Send',
    dispute_error_load: () => 'Failed to load dispute. Please try again.',
    dispute_error_send: () => 'Failed to send message.',
    dispute_forbidden: () => 'You do not have permission to view this dispute.',
    dispute_not_found: () => 'Dispute not found.',
    dispute_description_label: () => 'Description',
    orders_back_to_list: () => 'Back to orders',
    error_not_found_description: () => 'The page you are looking for does not exist.',
    error_cart_empty: () => 'Cart is empty',
    error_out_of_stock: () => 'Some items are out of stock',
    error_dispute_window_expired: () => 'Dispute window has expired (30 days)',
    error_unexpected: () => 'An unexpected error occurred',
  },
}))

vi.mock('#/lib/disputes', () => ({
  addDisputeMessage: vi.fn(),
}))

function makeDisputeDetail(overrides?: Partial<DisputeDetail>): DisputeDetail {
  return {
    id: 'dispute-123',
    shopOrderId: 'so-1',
    buyerUserId: 'buyer-1',
    reason: 'damaged',
    description: 'The item arrived broken.',
    status: 'open',
    resolution: null,
    refundCents: null,
    createdAt: new Date('2026-05-01T12:00:00Z'),
    updatedAt: new Date('2026-05-01T12:00:00Z'),
    buyer: { id: 'buyer-1', name: 'Test Buyer', email: 'buyer@example.com' },
    shop: { id: 'owner-1', name: 'Test Owner', email: 'owner@example.com' },
    order: {
      id: 'so-1',
      platformOrderId: 'order-123',
      platformOrderNumber: 'EUR-123456',
      shopId: 'shop-1',
      shopName: 'Test Shop',
      status: 'disputed',
      subtotalCents: 2000,
      shippingCostCents: 500,
      totalCents: 2500,
      createdAt: new Date('2026-05-01T12:00:00Z'),
      items: [],
    },
    messages: [],
    ...overrides,
  }
}

describe('DisputeThreadPage', () => {
  it('renders dispute summary', () => {
    const dispute = makeDisputeDetail()
    render(<DisputeThreadPage dispute={dispute} />)
    expect(screen.getByRole('heading', { name: 'Dispute' })).toBeDefined()
    expect(screen.getByText('dispute-123')).toBeDefined()
    expect(screen.getByText('damaged')).toBeDefined()
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getByText('€25.00')).toBeDefined()
    expect(screen.getByText('The item arrived broken.')).toBeDefined()
  })

  it('renders message list', () => {
    const dispute = makeDisputeDetail({
      messages: [
        {
          id: 'msg-1',
          senderUserId: 'buyer-1',
          senderName: 'Test Buyer',
          message: 'Hello, the vase is broken.',
          createdAt: new Date('2026-05-01T12:00:00Z'),
        },
        {
          id: 'msg-2',
          senderUserId: 'owner-1',
          senderName: 'Test Owner',
          message: 'Sorry to hear that. We will investigate.',
          createdAt: new Date('2026-05-01T13:00:00Z'),
        },
      ],
    })
    render(<DisputeThreadPage dispute={dispute} />)
    expect(screen.getByRole('list')).toBeDefined()
    expect(screen.getByText('Hello, the vase is broken.')).toBeDefined()
    expect(screen.getByText('Sorry to hear that. We will investigate.')).toBeDefined()
  })

  it('shows empty state when no messages', () => {
    const dispute = makeDisputeDetail({ messages: [] })
    render(<DisputeThreadPage dispute={dispute} />)
    expect(screen.getByText('No messages yet.')).toBeDefined()
  })

  it('shows message input for open disputes', () => {
    const dispute = makeDisputeDetail({ status: 'open' })
    render(<DisputeThreadPage dispute={dispute} />)
    expect(screen.getByPlaceholderText('Write a message...')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined()
  })

  it('hides message input for resolved disputes', () => {
    const dispute = makeDisputeDetail({ status: 'resolved', resolution: 'close' })
    render(<DisputeThreadPage dispute={dispute} />)
    expect(screen.queryByPlaceholderText('Write a message...')).toBeNull()
  })
})

describe('DisputeThreadLoading', () => {
  it('renders loading skeleton', () => {
    render(<DisputeThreadLoading />)
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })
})

describe('DisputeThreadError', () => {
  it('renders not found error', () => {
    render(<DisputeThreadError error={new Error('Not Found')} />)
    expect(screen.getByText('Dispute not found.')).toBeDefined()
  })

  it('renders forbidden error', () => {
    render(<DisputeThreadError error={new Error('Forbidden: permission denied')} />)
    expect(screen.getByText('You do not have permission to view this dispute.')).toBeDefined()
  })

  it('renders generic load error', () => {
    render(<DisputeThreadError error={new Error('Network error')} />)
    expect(screen.getByText('Failed to load dispute. Please try again.')).toBeDefined()
  })
})
