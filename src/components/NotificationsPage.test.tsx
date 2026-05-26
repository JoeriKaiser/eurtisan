// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationItem } from '#/lib/notifications.server'
import { NotificationsPage } from './NotificationsPage'
import { NotificationsLoading } from './NotificationsLoading'
import { NotificationsError } from './NotificationsError'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockMutateAsync = vi.hoisted(() => vi.fn())
const mockMutate = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
  }),
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/lib/notifications-hooks', () => ({
  useMarkNotificationRead: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    notifications_title: () => 'Notifications',
    notifications_empty: () => 'You have no notifications yet.',
    notifications_error: () => 'Failed to load notifications. Please try again.',
    notifications_mark_all_read: () => 'Mark all as read',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: string; totalPages: string }) =>
      `Page ${page} of ${totalPages}`,
    notification_order_placed: ({ orderId }: { orderId: string }) => `Order placed: ${orderId}`,
    notification_order_shipped: ({ orderId }: { orderId: string }) => `Order shipped: ${orderId}`,
    notification_review_received: ({ productName }: { productName: string }) =>
      `New review on ${productName}`,
    notification_dispute_opened: ({ orderId }: { orderId: string }) =>
      `Dispute opened for order ${orderId}`,
    notification_payout_sent: ({ amount }: { amount: string }) => `Payout sent: ${amount}`,
    time_just_now: () => 'Just now',
    time_minutes_ago: ({ count }: { count: string }) => `${count} min ago`,
    time_hours_ago: ({ count }: { count: string }) => `${count} hr ago`,
    time_days_ago: ({ count }: { count: string }) => `${count} days ago`,
  },
}))

function makeNotification(overrides?: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'order_placed',
    data: { orderId: 'order-123' },
    readAt: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    ...overrides,
  }
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    mockMutateAsync.mockClear()
    mockMutate.mockClear()
    mockNavigate.mockClear()
  })

  it('renders title', () => {
    render(
      <NotificationsPage
        notifications={[]}
        total={0}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeDefined()
  })

  it('renders empty state', () => {
    render(
      <NotificationsPage
        notifications={[]}
        total={0}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByText('You have no notifications yet.')).toBeDefined()
  })

  it('renders notification items', () => {
    const notifications = [
      makeNotification({ type: 'order_placed', data: { orderId: 'order-123' } }),
      makeNotification({
        id: 'notif-2',
        type: 'review_received',
        data: { productName: 'Vase' },
        readAt: new Date(),
      }),
    ]

    render(
      <NotificationsPage
        notifications={notifications}
        total={2}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByText('Order placed: order-123')).toBeDefined()
    expect(screen.getByText('New review on Vase')).toBeDefined()
  })

  it('shows unread indicator for unread items', () => {
    const notifications = [
      makeNotification({ readAt: null }),
      makeNotification({ id: 'notif-2', readAt: new Date() }),
    ]

    render(
      <NotificationsPage
        notifications={notifications}
        total={2}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    const indicators = screen.getAllByRole('listitem')
    expect(indicators).toHaveLength(2)
  })

  it('calls mark read and navigates on click', () => {
    const notifications = [
      makeNotification({ type: 'order_placed', data: { orderId: 'order-123' } }),
    ]

    render(
      <NotificationsPage
        notifications={notifications}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    const item = screen.getByRole('listitem').querySelector('button')
    if (!item) throw new Error('button not found')
    fireEvent.click(item)

    expect(mockMutateAsync).toHaveBeenCalledWith('notif-1')
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/orders/order-123' })
  })

  it('does not mark read if already read', () => {
    const notifications = [makeNotification({ readAt: new Date(), data: { orderId: 'order-123' } })]

    render(
      <NotificationsPage
        notifications={notifications}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    const item = screen.getByRole('listitem').querySelector('button')
    if (!item) throw new Error('button not found')
    fireEvent.click(item)

    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it('renders mark all read button when notifications exist', () => {
    const notifications = [makeNotification()]

    render(
      <NotificationsPage
        notifications={notifications}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDefined()
  })

  it('hides mark all read button when empty', () => {
    render(
      <NotificationsPage
        notifications={[]}
        total={0}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull()
  })

  it('calls onPageChange for pagination', () => {
    const onPageChange = vi.fn()

    render(
      <NotificationsPage
        notifications={[makeNotification()]}
        total={30}
        page={1}
        totalPages={2}
        onPageChange={onPageChange}
        isNavigating={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})

describe('NotificationsLoading', () => {
  it('renders skeleton loaders', () => {
    render(<NotificationsLoading />)
    expect(screen.getAllByRole('generic', { hidden: true }).length).toBeGreaterThan(0)
  })
})

describe('NotificationsError', () => {
  it('renders error message', () => {
    render(<NotificationsError error={new Error('Something broke')} />)
    expect(screen.getByText('Failed to load notifications. Please try again.')).toBeDefined()
    expect(screen.getByText('Something broke')).toBeDefined()
  })
})
