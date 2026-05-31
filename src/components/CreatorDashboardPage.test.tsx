// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvalidate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    creator_title: () => 'Creator Dashboard',
    creator_description: () => 'Manage your shops and track performance.',
    creator_revenue_this_month: () => 'Revenue this month',
    creator_pending_orders: () => 'Pending orders',
    creator_low_stock_products: () => 'Low stock products',
    creator_total_shops: () => 'Total shops',
    creator_quick_actions: () => 'Quick actions',
    creator_quick_products: () => 'Products',
    creator_quick_orders: () => 'Orders',
    creator_quick_settings: () => 'Settings',
    creator_recent_activity: () => 'Recent activity',
    creator_activity_empty: () => 'No recent activity yet.',
    creator_activity_empty_description: () => 'New orders and reviews will appear here.',
    creator_activity_order_text: ({ buyerName, total }: { buyerName: string; total: string }) =>
      `${buyerName} placed an order — ${total}`,
    creator_activity_review_text: ({
      buyerName,
      productName,
      rating,
    }: {
      buyerName: string
      productName: string
      rating: string
    }) => `${buyerName} reviewed ${productName} — ${rating} stars`,
    creator_no_shops_title: () => 'Welcome, creator!',
    creator_no_shops_description: () => "You don't have any shops yet.",
    creator_no_shops_cta: () => 'Go to studio',
    creator_error_load: () => 'Failed to load dashboard. Please try again.',
    creator_error_retry: () => 'Retry',
    time_just_now: () => 'Just now',
    time_minutes_ago: ({ count }: { count: string }) => `${count} min ago`,
    time_hours_ago: ({ count }: { count: string }) => `${count} hr ago`,
    time_days_ago: ({ count }: { count: string }) => `${count} days ago`,
  },
}))

import type { CreatorActivity } from '#/lib/creator-dashboard'
import {
  CreatorDashboardError,
  CreatorDashboardLoading,
  CreatorDashboardPage,
} from './CreatorDashboardPage'

function makeStats(overrides?: Partial<Parameters<typeof CreatorDashboardPage>[0]['stats']>) {
  return {
    revenueThisMonthCents: 12500,
    pendingOrdersCount: 3,
    lowStockProductCount: 2,
    totalShopCount: 1,
    ...overrides,
  }
}

function makeOrderActivity(
  overrides?: Partial<Extract<CreatorActivity, { kind: 'order' }>>,
): Extract<CreatorActivity, { kind: 'order' }> {
  return {
    kind: 'order',
    id: 'order-1',
    createdAt: new Date(),
    orderId: 'order-1',
    shopId: 'shop-1',
    shopName: 'Test Shop',
    buyerName: 'Alice',
    totalCents: 2500,
    status: 'paid',
    ...overrides,
  }
}

function makeReviewActivity(
  overrides?: Partial<Extract<CreatorActivity, { kind: 'review' }>>,
): Extract<CreatorActivity, { kind: 'review' }> {
  return {
    kind: 'review',
    id: 'review-1',
    createdAt: new Date(),
    reviewId: 'review-1',
    productId: 'prod-1',
    productName: 'Vase',
    shopId: 'shop-1',
    shopName: 'Test Shop',
    buyerName: 'Alice',
    rating: 5,
    comment: 'Great product!',
    ...overrides,
  }
}

describe('CreatorDashboardPage', () => {
  it('renders no-shops empty state when totalShopCount is 0', () => {
    render(
      <CreatorDashboardPage
        stats={makeStats({
          totalShopCount: 0,
          revenueThisMonthCents: 0,
          pendingOrdersCount: 0,
          lowStockProductCount: 0,
        })}
        activity={[]}
        shops={[]}
      />,
    )

    expect(screen.getByText('Welcome, creator!')).toBeDefined()
    expect(screen.getByText("You don't have any shops yet.")).toBeDefined()
    expect(screen.getByRole('link', { name: 'Go to studio' })).toBeDefined()
  })

  it('renders stat cards with correct values', () => {
    render(
      <CreatorDashboardPage
        stats={makeStats()}
        activity={[]}
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
      />,
    )

    expect(screen.getByText('Creator Dashboard')).toBeDefined()
    expect(screen.getByText('€125.00')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
  })

  it('renders quick action buttons', () => {
    render(
      <CreatorDashboardPage
        stats={makeStats()}
        activity={[]}
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
      />,
    )

    expect(screen.getByText('Quick actions')).toBeDefined()
    expect(screen.getByText('Products')).toBeDefined()
    expect(screen.getByText('Orders')).toBeDefined()
    expect(screen.queryByText('Payouts')).toBeNull()
    expect(screen.getByText('Settings')).toBeDefined()
  })

  it('renders recent activity with orders and reviews', () => {
    render(
      <CreatorDashboardPage
        stats={makeStats()}
        activity={[
          makeOrderActivity({ buyerName: 'Bob', totalCents: 5000 }),
          makeReviewActivity({ buyerName: 'Carol', rating: 4, productName: 'Mug' }),
        ]}
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
      />,
    )

    expect(screen.getByText('Recent activity')).toBeDefined()
    expect(screen.getByText('Bob placed an order — €50.00')).toBeDefined()
    expect(screen.getByText('Carol reviewed Mug — 4 stars')).toBeDefined()
    expect(screen.getByText('"Great product!"')).toBeDefined()
  })

  it('renders activity empty state when no activity', () => {
    render(
      <CreatorDashboardPage
        stats={makeStats()}
        activity={[]}
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
      />,
    )

    expect(screen.getByText('No recent activity yet.')).toBeDefined()
    expect(screen.getByText('New orders and reviews will appear here.')).toBeDefined()
  })

  it('links quick actions to first shop when shops exist', () => {
    render(
      <CreatorDashboardPage
        stats={makeStats()}
        activity={[]}
        shops={[{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]}
      />,
    )

    expect(screen.getByText('Products').closest('a')?.getAttribute('href')).toBe('/studio/shop-1')
    expect(screen.getByText('Orders').closest('a')?.getAttribute('href')).toBe(
      '/studio/shop-1/orders',
    )
    expect(screen.getByText('Settings').closest('a')?.getAttribute('href')).toBe('/studio/shop-1')
  })
})

describe('CreatorDashboardLoading', () => {
  it('renders skeleton loaders for stats, quick actions, and activity', () => {
    render(<CreatorDashboardLoading />)
    const skeletons = screen.getAllByRole('generic', { hidden: true })
    expect(skeletons.length).toBeGreaterThanOrEqual(16)
  })
})

describe('CreatorDashboardError', () => {
  beforeEach(() => {
    mockInvalidate.mockClear()
  })

  it('renders error message and retry button', () => {
    render(<CreatorDashboardError error={new Error('Something broke')} />)
    expect(screen.getByText('Failed to load dashboard. Please try again.')).toBeDefined()
    expect(screen.getByText('Something broke')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined()
  })

  it('calls router.invalidate on retry click', () => {
    render(<CreatorDashboardError error={new Error('Network error')} />)
    const retryBtn = screen.getByRole('button', { name: 'Retry' })
    retryBtn.click()
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })
})
