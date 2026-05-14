// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useLoaderData: () => ({
      stats: {
        totalUsers: 42,
        activeShops: 7,
        openDisputes: 3,
        pendingPayouts: 5,
      },
      signups: [
        {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          createdAt: new Date('2026-05-10T10:00:00Z'),
        },
        {
          id: 'user-2',
          name: 'Bob',
          email: 'bob@example.com',
          createdAt: new Date('2026-05-09T08:00:00Z'),
        },
      ],
      orders: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          status: 'paid',
          totalCents: 2500,
          createdAt: new Date('2026-05-11T14:00:00Z'),
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          status: 'shipped',
          totalCents: 5000,
          createdAt: new Date('2026-05-11T10:00:00Z'),
        },
      ],
    }),
    useNavigate: () => mockNavigate,
  }),
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
  }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    admin_title: () => 'Admin Dashboard',
    admin_description: () => 'System administration.',
    admin_stats_total_users: () => 'Total Users',
    admin_stats_active_shops: () => 'Active Shops',
    admin_stats_open_disputes: () => 'Open Disputes',
    admin_stats_pending_payouts: () => 'Pending Payouts',
    admin_recent_signups_title: () => 'Recent Signups',
    admin_recent_signups_empty: () => 'No signups yet.',
    admin_recent_orders_title: () => 'Recent Orders',
    admin_recent_orders_empty: () => 'No orders yet.',
    admin_error_load: () => 'Failed to load dashboard data.',
    admin_error_retry: () => 'Retry',
    admin_nav_section: () => 'Quick Links',
    admin_nav_disputes: () => 'Dispute Queue',
    admin_nav_disputes_desc: () => 'Review and resolve open disputes.',
  },
}))

import { AdminDashboard, StatCard } from './index'

describe('AdminDashboard', () => {
  it('renders the dashboard title', () => {
    render(<AdminDashboard />)

    expect(screen.getByText('Admin Dashboard')).toBeDefined()
    expect(screen.getByText('System administration.')).toBeDefined()
  })

  it('renders all four stat cards with correct values', () => {
    render(<AdminDashboard />)

    expect(screen.getByText('Total Users')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('Active Shops')).toBeDefined()
    expect(screen.getByText('7')).toBeDefined()
    expect(screen.getByText('Open Disputes')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('Pending Payouts')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })

  it('renders recent signups with names and emails', () => {
    render(<AdminDashboard />)

    expect(screen.getByText('Recent Signups')).toBeDefined()
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('alice@example.com')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('bob@example.com')).toBeDefined()
  })

  it('renders recent orders with identifiers and status badges', () => {
    render(<AdminDashboard />)

    expect(screen.getByText('Recent Orders')).toBeDefined()
    // Order ID fragments — both start with same prefix, so use getAllByText
    const orderIds = screen.getAllByText('00000000…')
    expect(orderIds).toHaveLength(2)
    // Status badges
    expect(screen.getByText('paid')).toBeDefined()
    expect(screen.getByText('shipped')).toBeDefined()
    // Price formatting
    expect(screen.getByText('€25,00')).toBeDefined()
    expect(screen.getByText('€50,00')).toBeDefined()
  })

  it('renders navigation link to disputes', () => {
    render(<AdminDashboard />)

    expect(screen.getByText('Quick Links')).toBeDefined()
    const disputeLink = screen.getByText('Dispute Queue')
    expect(disputeLink).toBeDefined()
  })

  it('renders zero values as "0"', () => {
    render(
      <StatCard
        icon={<span data-testid='icon' />}
        label='Test Zero'
        value={0}
        iconBgClass='bg-test'
        iconColorClass='text-test'
      />,
    )

    // Zero must render as the string "0", not blank/null/undefined
    expect(screen.getByText('0')).toBeDefined()
    expect(screen.getByText('Test Zero')).toBeDefined()
  })
})
