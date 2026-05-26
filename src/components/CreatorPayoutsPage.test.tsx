// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvalidate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ invalidate: mockInvalidate, navigate: vi.fn() }),
}))

vi.mock('#/lib/payouts', () => ({
  getMollieConnectUrl: vi.fn(),
  disconnectMollie: vi.fn(),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    creator_payouts_title: () => 'Payouts',
    creator_payouts_description: () => 'Track your earnings and pending payouts across all orders.',
    creator_payouts_earned_total: () => 'Total earned',
    creator_payouts_pending_amount: () => 'Pending payout',
    creator_payouts_col_order: () => 'Order ID',
    creator_payouts_col_date: () => 'Date',
    creator_payouts_col_amount: () => 'Amount',
    creator_payouts_col_status: () => 'Status',
    creator_payouts_status_pending: () => 'Pending',
    creator_payouts_status_processing: () => 'Processing',
    creator_payouts_status_sent: () => 'Sent',
    creator_payouts_filter_all: () => 'All',
    creator_payouts_filter_pending: () => 'Pending',
    creator_payouts_filter_processing: () => 'Processing',
    creator_payouts_filter_sent: () => 'Sent',
    creator_payouts_empty_title: () => 'No payouts yet',
    creator_payouts_empty_description: () =>
      'Payouts will appear once your orders are completed or delivered.',
    creator_payouts_no_results: () => 'No payouts match this filter',
    creator_payouts_no_results_description: () => 'Try selecting a different status filter.',
    creator_payouts_showing: ({ from, to, total }: { from: number; to: number; total: number }) =>
      `Showing ${from}–${to} of ${total}`,
    creator_payouts_pagination: () => 'Payout pagination',
    creator_payouts_error_load: () => 'Failed to load payouts. Please try again.',
    creator_payouts_refund_label: () => 'Refund',
    creator_payouts_mollie_connect_title: () => 'Mollie Connect',
    creator_payouts_mollie_connect_description_connected: ({
      merchantId,
    }: {
      merchantId: string
    }) =>
      `Your shop is successfully connected to Mollie to receive payouts. Connected Merchant ID: ${merchantId}`,
    creator_payouts_mollie_connect_description_disconnected: () =>
      'Connect your Mollie merchant account to start receiving payouts for your custom merchandise and artisan goods.',
    creator_payouts_mollie_connect_btn: () => 'Connect with Mollie',
    creator_payouts_mollie_disconnect_btn: () => 'Disconnect account',
    creator_payouts_mollie_status_connected: () => 'Connected',
    creator_payouts_mollie_status_disconnected: () => 'Not Connected',
    creator_shop_select_label: () => 'Select shop',
    creator_no_shops_title: () => 'Welcome, creator!',
    creator_no_shops_description: () => "You don't have any shops yet.",
    creator_error_retry: () => 'Retry',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: number; totalPages: number }) =>
      `Page ${page} of ${totalPages}`,
  },
}))

import type { CreatorPayoutLine } from '#/lib/payouts'
import { CreatorPayoutsPage } from './CreatorPayoutsPage'
import { CreatorPayoutsLoading } from './CreatorPayoutsLoading'
import { CreatorPayoutsError } from './CreatorPayoutsError'

function makePayoutLine(overrides?: Partial<CreatorPayoutLine>): CreatorPayoutLine {
  return {
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    date: new Date('2026-05-01T10:00:00Z'),
    amountCents: 2500,
    status: 'pending',
    orderStatus: 'delivered',
    isRefund: false,
    ...overrides,
  }
}

function makePaginatedPayouts(overrides?: {
  payouts?: CreatorPayoutLine[]
  total?: number
  page?: number
  pageSize?: number
  totalPages?: number
}) {
  return {
    payouts: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
    ...overrides,
  }
}

describe('CreatorPayoutsPage', () => {
  it('renders no-shops empty state when no shops exist', () => {
    render(
      <CreatorPayoutsPage
        shops={[]}
        payouts={makePaginatedPayouts()}
        currentShopId={null}
        initialStatus='all'
      />,
    )

    expect(screen.getByText('Welcome, creator!')).toBeDefined()
    expect(screen.getByText("You don't have any shops yet.")).toBeDefined()
  })

  it('renders title and description', () => {
    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    expect(screen.getByText('Payouts')).toBeDefined()
    expect(
      screen.getByText('Track your earnings and pending payouts across all orders.'),
    ).toBeDefined()
  })

  it('renders summary cards with correct values', () => {
    const payouts = makePaginatedPayouts({
      payouts: [
        makePayoutLine({ amountCents: 4500, status: 'pending' }),
        makePayoutLine({
          orderId: '660e8400-e29b-41d4-a716-446655440001',
          amountCents: 2000,
          status: 'sent',
        }),
        makePayoutLine({
          orderId: '770e8400-e29b-41d4-a716-446655440002',
          amountCents: -1000,
          status: 'processing',
          isRefund: true,
          orderStatus: 'refunded',
        }),
      ],
      total: 3,
    })

    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={payouts}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    // Total earned = 4500 + 2000 = 6500 → €65,00
    const earnedCard = screen
      .getByText('Total earned')
      .closest('[class*="rounded-xl"]') as HTMLElement | null
    expect(earnedCard).toBeDefined()
    if (earnedCard) expect(within(earnedCard).getByText('€65,00')).toBeDefined()
    // Pending amount = 4500 → €45,00
    const pendingCard = screen
      .getByText('Pending payout')
      .closest('[class*="rounded-xl"]') as HTMLElement | null
    expect(pendingCard).toBeDefined()
    if (pendingCard) expect(within(pendingCard).getByText('€45,00')).toBeDefined()
  })

  it('renders payouts table with order ID, date, amount, and status', () => {
    const payouts = makePaginatedPayouts({
      payouts: [
        makePayoutLine({ amountCents: 2500, status: 'pending' }),
        makePayoutLine({
          orderId: '660e8400-e29b-41d4-a716-446655440001',
          amountCents: 5000,
          status: 'sent',
        }),
        makePayoutLine({
          orderId: '770e8400-e29b-41d4-a716-446655440002',
          amountCents: 10000,
          status: 'processing',
        }),
      ],
      total: 3,
    })

    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={payouts}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    // Status badges — check within table body to avoid filter tab duplicates
    const tbody = document.querySelector('tbody')
    expect(tbody).toBeDefined()
    if (!tbody) throw new Error('tbody not found')
    expect(within(tbody).getByText('Pending')).toBeDefined()
    expect(within(tbody).getByText('Processing')).toBeDefined()
    expect(within(tbody).getByText('Sent')).toBeDefined()

    // Amounts
    expect(within(tbody).getByText('€25,00')).toBeDefined()
    expect(within(tbody).getByText('€50,00')).toBeDefined()
    expect(within(tbody).getByText('€100,00')).toBeDefined()
  })

  it('renders refunded orders as negative amounts with Refund badge', () => {
    const payouts = makePaginatedPayouts({
      payouts: [
        makePayoutLine({
          amountCents: -1500,
          isRefund: true,
          orderStatus: 'refunded',
          status: 'processing',
        }),
      ],
      total: 1,
    })

    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={payouts}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    // Negative amount displayed with minus sign (text is split across nodes)
    const refundTd = document.querySelector('td.text-error') as HTMLElement | null
    expect(refundTd).toBeDefined()
    if (!refundTd) throw new Error('refund td not found')
    expect(refundTd.textContent).toContain('−€15,00')
    // Refund label
    expect(within(refundTd).getByText('Refund')).toBeDefined()
  })

  it('renders empty state when no payouts', () => {
    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    expect(screen.getByText('No payouts yet')).toBeDefined()
    expect(
      screen.getByText('Payouts will appear once your orders are completed or delivered.'),
    ).toBeDefined()
  })

  it('renders no-results message when filtering with no matches', () => {
    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='sent'
      />,
    )

    expect(screen.getByText('No payouts match this filter')).toBeDefined()
    expect(screen.getByText('Try selecting a different status filter.')).toBeDefined()
  })

  it('renders status filter tabs with correct active state', () => {
    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='pending'
      />,
    )

    const pendingTab = screen.getByRole('tab', { name: 'Pending' })
    expect(pendingTab.getAttribute('aria-selected')).toBe('true')

    const allTab = screen.getByRole('tab', { name: 'All' })
    expect(allTab.getAttribute('aria-selected')).toBe('false')
  })

  it('renders all four filter tabs', () => {
    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    expect(screen.getByRole('tab', { name: 'All' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Pending' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Processing' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Sent' })).toBeDefined()
  })

  it('renders pagination controls when multiple pages exist', () => {
    const payouts = makePaginatedPayouts({
      payouts: [makePayoutLine()],
      total: 25,
      page: 1,
      pageSize: 20,
      totalPages: 2,
    })

    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={payouts}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    expect(screen.getByText('Page 1 of 2')).toBeDefined()
    expect(screen.getByText('Showing 1–20 of 25')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDefined()
  })

  it('disables previous button on first page', () => {
    const payouts = makePaginatedPayouts({
      payouts: [makePayoutLine()],
      total: 25,
      page: 1,
      pageSize: 20,
      totalPages: 2,
    })

    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={payouts}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    const prevBtn = screen.getByRole('button', { name: 'Previous' })
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables next button on last page', () => {
    const payouts = makePaginatedPayouts({
      payouts: [makePayoutLine()],
      total: 25,
      page: 2,
      pageSize: 20,
      totalPages: 2,
    })

    render(
      <CreatorPayoutsPage
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
        payouts={payouts}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders shop selector with all shops', () => {
    render(
      <CreatorPayoutsPage
        shops={[
          { id: 'shop-1', name: 'Shop One', slug: 'shop-one' },
          { id: 'shop-2', name: 'Shop Two', slug: 'shop-two' },
        ]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    const select = screen.getByLabelText('Select shop') as HTMLSelectElement
    expect(select).toBeDefined()
    expect(select.value).toBe('shop-1')
    expect(screen.getByText('Shop One')).toBeDefined()
    expect(screen.getByText('Shop Two')).toBeDefined()
  })

  it('renders Mollie Connect banner when disconnected', () => {
    render(
      <CreatorPayoutsPage
        shops={[
          {
            id: 'shop-1',
            name: 'Test Shop',
            slug: 'test-shop',
            paymentConnected: false,
            mollieAccountId: null,
          },
        ]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    expect(screen.getByText('Mollie Connect')).toBeDefined()
    expect(screen.getByText('Not Connected')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Connect with Mollie' })).toBeDefined()
  })

  it('renders Mollie connected details when connected', () => {
    render(
      <CreatorPayoutsPage
        shops={[
          {
            id: 'shop-1',
            name: 'Test Shop',
            slug: 'test-shop',
            paymentConnected: true,
            mollieAccountId: 'org_123456',
          },
        ]}
        payouts={makePaginatedPayouts()}
        currentShopId='shop-1'
        initialStatus='all'
      />,
    )

    expect(screen.getByText('Mollie Connect')).toBeDefined()
    expect(screen.getByText('Connected')).toBeDefined()
    expect(screen.getByText(/org_123456/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Disconnect account' })).toBeDefined()
  })
})

describe('CreatorPayoutsLoading', () => {
  it('renders skeleton loaders', () => {
    render(<CreatorPayoutsLoading />)
    // Check that the page title skeleton is present
    const skeletons = document.querySelectorAll('[aria-hidden="true"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })
})

describe('CreatorPayoutsError', () => {
  beforeEach(() => {
    mockInvalidate.mockClear()
  })

  it('renders error message and retry button', () => {
    render(<CreatorPayoutsError error={new Error('Network failure')} />)
    expect(screen.getByText('Failed to load payouts. Please try again.')).toBeDefined()
    expect(screen.getByText('Network failure')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined()
  })

  it('calls router.invalidate on retry click', () => {
    render(<CreatorPayoutsError error={new Error('Server error')} />)
    const retryBtn = screen.getByRole('button', { name: 'Retry' })
    retryBtn.click()
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })
})
