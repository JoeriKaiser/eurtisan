// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockLoaderData = {
  entries: [
    {
      id: 'audit-1',
      actorId: 'u-1',
      actorName: 'Admin One',
      action: 'shop.suspend',
      resourceType: 'shop',
      resourceId: 'shop-1',
      metadata: { reason: 'Violation' },
      createdAt: new Date('2026-05-20T14:00:00Z'),
    },
    {
      id: 'audit-2',
      actorId: 'u-2',
      actorName: 'Admin Two',
      action: 'user.ban',
      resourceType: 'user',
      resourceId: 'user-1',
      metadata: {},
      createdAt: new Date('2026-05-19T10:00:00Z'),
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
}

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => mockLoaderData,
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
  createFileRoute: () => (options: { component?: unknown }) => ({
    options,
    useLoaderData: () => mockLoaderData,
    useNavigate: () => vi.fn(),
    useSearch: () => ({}),
  }),
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    admin_audit_log_title: () => 'Audit Log',
    admin_audit_log_description: () => 'Review all administrative actions.',
    admin_audit_log_filter_action: () => 'Action',
    admin_audit_log_filter_action_all: () => 'All actions',
    admin_audit_log_filter_actor: () => 'Actor',
    admin_audit_log_filter_resource_type: () => 'Resource',
    admin_audit_log_filter_resource_all: () => 'All resources',
    admin_audit_log_filter_date_from: () => 'From',
    admin_audit_log_filter_date_to: () => 'To',
    admin_audit_log_filter_actor_placeholder: () => 'User ID...',
    admin_audit_log_empty: () => 'No audit entries found.',
    admin_audit_log_expand: () => 'Expand details',
    admin_audit_log_collapse: () => 'Collapse details',
    admin_audit_log_resource_shop: () => 'Shop',
    admin_audit_log_resource_user: () => 'User',
    admin_audit_log_resource_dispute: () => 'Dispute',
    admin_audit_log_resource_payout: () => 'Payout',
    admin_audit_log_resource_order: () => 'Order',
    admin_audit_log_resource_category: () => 'Category',
    admin_audit_log_resource_product: () => 'Product',
    admin_common_search: () => 'Search',
    admin_common_clear_filters: () => 'Clear filters',
    admin_shops_showing: () => 'Showing 1–2 of 2',
    admin_shops_page_size_label: () => 'Per page',
    admin_shops_pagination: () => 'Pagination',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: () => 'Page 1 of 1',
    time_days_ago: () => '1 day ago',
  },
}))

import { Route } from './audit-log'

const AdminAuditLogPage = Route.options.component!

describe('AdminAuditLogPage', () => {
  it('renders title and description', () => {
    render(<AdminAuditLogPage />)
    expect(screen.getByText('Audit Log')).toBeDefined()
    expect(screen.getByText('Review all administrative actions.')).toBeDefined()
  })

  it('renders audit entries with actions and actors', () => {
    render(<AdminAuditLogPage />)
    const shopSuspend = screen.getAllByText('shop.suspend')
    expect(shopSuspend.length).toBeGreaterThanOrEqual(1)
    const userBan = screen.getAllByText('user.ban')
    expect(userBan.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Admin One')).toBeDefined()
    expect(screen.getByText('Admin Two')).toBeDefined()
  })

  it('renders resource types and IDs', () => {
    render(<AdminAuditLogPage />)
    expect(screen.getByText('shop')).toBeDefined()
    expect(screen.getByText('user')).toBeDefined()
  })

  it('renders expand button for entries with metadata', () => {
    render(<AdminAuditLogPage />)
    expect(screen.getByText('Expand details')).toBeDefined()
  })
})
