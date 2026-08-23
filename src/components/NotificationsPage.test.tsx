// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationGroup } from './NotificationsPage'
import { NotificationsPage } from './NotificationsPage'
import type { NotificationItem } from '#/lib/notifications.server'
import { NotificationsLoading } from './NotificationsLoading'
import { NotificationsError } from './NotificationsError'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockMutateAsync = vi.hoisted(() => vi.fn())
const mockMutate = vi.hoisted(() => vi.fn())
const mockInvalidate = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    invalidate: mockInvalidate,
  }),
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/lib/notifications-hooks', () => ({
  useMarkNotificationsRead: () => ({
    mutateAsync: mockMutateAsync,
    mutate: mockMutateAsync,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutateAsync: mockMutate,
    mutate: mockMutate,
    isPending: false,
  }),
}))

vi.mock('#/components/notifications/StatementOfReasons', () => ({
  StatementOfReasons: () => <div>Statement of reasons</div>,
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    notifications_title: () => 'Notifications',
    notifications_empty: () => 'You have no notifications yet.',
    notifications_error: () => 'Failed to load notifications. Please try again.',
    notifications_mark_all_read: () => 'Mark all as read',
    notifications_status_unread: () => 'Unread notification',
    notifications_status_read: () => 'Read notification',
    notifications_group_unread_badge: ({ count }: { count: string }) => `${count} unread`,
    notifications_group_items_capped: ({ shown, count }: { shown: string; count: string }) =>
      `Showing the ${shown} most recent of ${count} — the daily digest email lists the rest.`,
    notification_group_low_stock: ({ count }: { count: string }) =>
      `Low stock: ${count} products need attention`,
    notification_group_review_received: ({ count }: { count: string }) =>
      `${count} new reviews received`,
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: string; totalPages: string }) =>
      `Page ${page} of ${totalPages}`,
    notification_order_placed: ({ orderNumber }: { orderNumber: string }) =>
      `Order placed: ${orderNumber}`,
    notification_order_shipped: ({ orderNumber }: { orderNumber: string }) =>
      `Order shipped: ${orderNumber}`,
    notification_review_received: ({ productName }: { productName: string }) =>
      `New review on ${productName}`,
    notification_seller_reply_received: ({ productName }: { productName: string }) =>
      `Seller replied to your review of ${productName}`,
    notification_seller_reply_hidden: () => 'Your seller reply was hidden — see why',
    notification_seller_reply_flagged: () => 'Your seller reply was restricted — see why',
    notification_seller_reply_restored: () => 'Your seller reply is visible again',
    notification_seller_reply_report_upheld: () => 'We acted on the seller reply you reported',
    notification_seller_reply_report_dismissed: () =>
      'We reviewed your report and left the seller reply up',
    notification_dispute_opened: ({ orderNumber }: { orderNumber: string }) =>
      `Dispute opened for order ${orderNumber}`,
    notification_payout_sent: ({ amount }: { amount: string }) => `Payout sent: ${amount}`,
    notification_shop_moderation: ({ shopName }: { shopName: string }) => `${shopName} was updated`,
    notification_shop_changes_requested: ({ shopName }: { shopName: string }) =>
      `Changes requested for ${shopName}`,
    notification_shop_approved: ({ shopName }: { shopName: string }) => `${shopName} was approved`,
    notification_shop_active: ({ shopName }: { shopName: string }) => `${shopName} is live`,
    notification_shop_rejected: ({ shopName }: { shopName: string }) =>
      `${shopName} was not approved`,
    sor_notification_suspended_title: ({ shopName }: { shopName: string }) =>
      `Your shop ${shopName} was suspended`,
    sor_notification_summary: () => 'Statement of reasons for this decision',
    sor_notification_measure_suspended_delisted: () =>
      'Your shop is suspended and its listings are hidden.',
    sor_notification_active_body: () =>
      'Your shop is live and your listings are visible to buyers.',
    sor_notification_status_link: () => 'View your shop status',
    statement_of_reasons_what_label: () => 'What we did',
    statement_of_reasons_why_label: () => 'Why',
    statement_of_reasons_automated_label: () => 'Was this automated?',
    statement_of_reasons_automated_no: () => 'No. A person made this decision.',
    statement_of_reasons_redress_label: () => 'If you disagree',
    statement_of_reasons_redress_support: ({ email }: { email: string }) => `Email ${email}.`,
    statement_of_reasons_redress_judicial: () => 'You can also go to a court.',
    dsa_sor_grounds_generic: () => 'A moderator found that the shop breaks the terms.',
    notification_low_stock: ({ productName }: { productName: string }) =>
      `Low stock: ${productName}`,
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
function makeGroup(item: NotificationItem): NotificationGroup {
  return {
    key: item.id,
    type: item.type,
    items: [item],
    count: 1,
    unreadCount: item.readAt ? 0 : 1,
    createdAt: item.createdAt,
  }
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    mockMutateAsync.mockClear()
    mockMutate.mockClear()
    mockNavigate.mockClear()
    mockInvalidate.mockClear()
  })

  it('renders title', () => {
    render(
      <NotificationsPage
        groups={[]}
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
        groups={[]}
        total={0}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )
    expect(screen.getByText('You have no notifications yet.')).toBeDefined()
  })

  it('renders notification items with descriptive accessible names', () => {
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
        groups={notifications.map(makeGroup)}
        total={2}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByText('Order placed: order-123')).toBeDefined()
    expect(screen.getByText('New review on Vase')).toBeDefined()

    const buttons = screen.getAllByRole('button')
    const orderButton = buttons.find((b) => b.textContent?.includes('Order placed: order-123'))
    expect(orderButton).toBeDefined()
    expect(orderButton?.getAttribute('aria-labelledby')).toMatch(/notif-preview-notif-1/)
    expect(orderButton?.getAttribute('aria-labelledby')).toMatch(/notif-time-notif-1/)
  })

  it('shows unread indicator for unread items', () => {
    const notifications = [
      makeNotification({ readAt: null }),
      makeNotification({ id: 'notif-2', readAt: new Date() }),
    ]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
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
        groups={notifications.map(makeGroup)}
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

    expect(mockMutateAsync).toHaveBeenCalledWith(['notif-1'])
  })

  it('shows moderation feedback and opens the shop status page', () => {
    const notifications = [
      makeNotification({
        type: 'shop_moderation_update',
        data: {
          shopId: 'shop-1',
          shopName: 'Clay Studio',
          status: 'changes_requested',
          note: 'Add a clear photo of the product label.',
          targetPath: '/sell/status/shop-1',
        },
      }),
    ]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByText('Changes requested for Clay Studio')).toBeDefined()
    expect(screen.getByText('Add a clear photo of the product label.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Changes requested for Clay Studio/i }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/sell/status/shop-1' })
  })

  it('renders the Article 17 suspension card with grounds, redress, and deep link', () => {
    const notifications = [
      makeNotification({
        type: 'shop_moderation_update',
        data: {
          shopId: 'shop-1',
          shopName: 'Clay Studio',
          status: 'suspended',
          statusLabel: 'suspended',
          note: '',
          targetPath: '/sell/status/shop-1',
          measure: 'shop_suspended_listings_delisted',
          groundsKind: 'generic',
          groundsKey: 'dsa_sor_grounds_generic',
          redressSupportEmail: 'support@eurtisan.eu',
          judicialRemedyAvailable: true,
          automatedMeans: false,
        },
      }),
    ]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByText('Your shop Clay Studio was suspended')).toBeDefined()
    expect(screen.getByText('Statement of reasons for this decision')).toBeDefined()
    expect(screen.getByText('Your shop is suspended and its listings are hidden.')).toBeDefined()
    expect(screen.getByText('A moderator found that the shop breaks the terms.')).toBeDefined()
    expect(screen.getByText('No. A person made this decision.')).toBeDefined()
    expect(screen.getByText('You can also go to a court.')).toBeDefined()
    const support = screen.getByRole('link', { name: /Email support@eurtisan\.eu/ })
    expect(support.getAttribute('href')).toContain('mailto:support@eurtisan.eu')
    expect(screen.getByRole('link', { name: 'View your shop status' }).getAttribute('href')).toBe(
      '/sell/status/shop-1',
    )

    fireEvent.click(screen.getByRole('button', { name: /Your shop Clay Studio was suspended/ }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/sell/status/shop-1' })
  })

  it('shows the recorded note verbatim in the suspension card', () => {
    const notifications = [
      makeNotification({
        type: 'shop_moderation_update',
        data: {
          shopId: 'shop-1',
          shopName: 'Clay Studio',
          status: 'suspended',
          statusLabel: 'suspended',
          note: 'Listings copied from another shop.',
          targetPath: '/sell/status/shop-1',
          measure: 'shop_suspended_listings_delisted',
          groundsKind: 'note',
          groundsKey: null,
          redressSupportEmail: 'support@eurtisan.eu',
          judicialRemedyAvailable: true,
          automatedMeans: false,
        },
      }),
    ]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    // The recorded note appears twice by design — as the row's detail prose
    // and verbatim inside the Article 17 card — so scope each query.
    const rowButton = screen.getByRole('button', {
      name: /Your shop Clay Studio was suspended/,
    })
    expect(within(rowButton).getByText('Listings copied from another shop.')).toBeDefined()

    const card = screen.getByText('Statement of reasons for this decision').closest('details')
    expect(card).not.toBeNull()
    if (!card) return
    expect(within(card).getByText('Listings copied from another shop.')).toBeDefined()
    // A note grounds replaces the generic grounds label everywhere.
    expect(screen.queryByText('A moderator found that the shop breaks the terms.')).toBeNull()
  })

  it('renders a success card when a suspension is lifted', () => {
    const notifications = [
      makeNotification({
        type: 'shop_moderation_update',
        data: {
          shopId: 'shop-1',
          shopName: 'Clay Studio',
          status: 'active',
          statusLabel: 'active',
          note: '',
          targetPath: '/sell/status/shop-1',
        },
      }),
    ]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByText('Clay Studio is live')).toBeDefined()
    expect(
      screen.getByText('Your shop is live and your listings are visible to buyers.'),
    ).toBeDefined()
    expect(screen.queryByText('Statement of reasons for this decision')).toBeNull()
  })

  it('renders and safely links each seller-reply notification', () => {
    const notificationData = {
      shopSlug: 'clay/studio',
      productSlug: 'vase/one',
      productName: 'Vase',
      targetPath: '//attacker.test/not-used',
    }
    const notifications = [
      makeNotification({
        id: 'reply-received',
        type: 'seller_reply_received',
        data: notificationData,
      }),
      makeNotification({
        id: 'reply-moderated',
        type: 'seller_reply_moderated',
        data: { ...notificationData, restriction: 'hidden' },
      }),
      makeNotification({
        id: 'reply-report-resolved',
        type: 'seller_reply_report_resolved',
        data: { ...notificationData, outcome: 'upheld' },
      }),
    ]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
        total={3}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByText('Seller replied to your review of Vase')).toBeDefined()
    expect(screen.getByText('Your seller reply was hidden — see why')).toBeDefined()
    expect(screen.getByText('We acted on the seller reply you reported')).toBeDefined()

    for (const preview of [
      'Seller replied to your review of Vase',
      'Your seller reply was hidden — see why',
      'We acted on the seller reply you reported',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(preview) }))
    }

    expect(mockNavigate).toHaveBeenLastCalledWith({
      to: '/shops/clay%2Fstudio/products/vase%2Fone',
    })
    expect(mockNavigate).toHaveBeenCalledTimes(3)
  })

  it('does not mark read if already read', () => {
    const notifications = [makeNotification({ readAt: new Date(), data: { orderId: 'order-123' } })]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
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
        groups={notifications.map(makeGroup)}
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
        groups={[]}
        total={0}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull()
  })

  it('hides mark all read button when all notifications are already read', () => {
    const notifications = [makeNotification({ readAt: new Date() })]

    render(
      <NotificationsPage
        groups={notifications.map(makeGroup)}
        total={1}
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
        groups={[makeGroup(makeNotification())]}
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

  it('renders multi-item groups with aggregate title and bulk-reads on expand', async () => {
    const groups = [
      {
        key: 'daily:low_stock:2026-08-03',
        type: 'low_stock' as const,
        items: [
          makeNotification({
            id: 'stock-1',
            type: 'low_stock',
            data: { productId: 'p1', productName: 'Mug' },
            readAt: null,
          }),
          makeNotification({
            id: 'stock-2',
            type: 'low_stock',
            data: { productId: 'p2', productName: 'Plate' },
            readAt: null,
          }),
        ],
        count: 2,
        unreadCount: 2,
        createdAt: new Date(),
      },
    ]

    render(
      <NotificationsPage
        groups={groups}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    expect(screen.getByText('Low stock: 2 products need attention')).toBeDefined()
    expect(screen.getByText('2 unread')).toBeDefined()

    const toggleButton = screen.getByRole('button', {
      name: /Low stock: 2 products need attention/i,
    })
    expect(toggleButton.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggleButton)

    expect(toggleButton.getAttribute('aria-expanded')).toBe('true')
    expect(mockMutateAsync).toHaveBeenCalledWith(['stock-1', 'stock-2'])
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalled())

    expect(screen.getByText('Low stock: Mug')).toBeDefined()
    expect(screen.getByText('Low stock: Plate')).toBeDefined()
  })

  it('notes when a group shows fewer items than its full count', () => {
    const items = Array.from({ length: 2 }, (_, index) =>
      makeNotification({
        id: `stock-${index + 1}`,
        type: 'low_stock',
        data: { productId: `p${index + 1}`, productName: `Product ${index + 1}` },
        readAt: null,
      }),
    )
    const groups = [
      {
        key: 'daily:low_stock:2026-08-03',
        type: 'low_stock' as const,
        items,
        count: 25,
        unreadCount: 25,
        createdAt: new Date(),
      },
    ]

    render(
      <NotificationsPage
        groups={groups}
        total={1}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        isNavigating={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Low stock: 25 products need attention/i }))

    expect(
      screen.getByText('Showing the 2 most recent of 25 — the daily digest email lists the rest.'),
    ).toBeDefined()
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
