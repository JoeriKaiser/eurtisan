// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminOrdersPage } from './orders'

/* -------------------------------------------------------------------------- */
/*                                    Mocks                                   */
/* -------------------------------------------------------------------------- */

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useLoaderData: () => ({
      orders: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          buyerName: 'Test Buyer',
          buyerEmail: 'buyer@example.com',
          totalCents: 2500,
          status: 'paid',
          shopCount: 1,
          createdAt: new Date('2026-05-10T12:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ query: '', page: 1, pageSize: 20 }),
  }),
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
    admin_orders_title: () => 'Order Inspector',
    admin_orders_description: () => 'Search all platform orders by ID, buyer name, or email.',
    admin_orders_search_placeholder: () => 'Search by order ID, buyer name, or email…',
    admin_orders_search_button: () => 'Search',
    admin_orders_clear_search: () => 'Clear search',
    admin_orders_col_order: () => 'Order',
    admin_orders_col_buyer: () => 'Buyer',
    admin_orders_col_status: () => 'Status',
    admin_orders_col_shops: () => 'Shops',
    admin_orders_col_total: () => 'Total',
    admin_orders_col_date: () => 'Date',
    admin_orders_empty: () => 'No orders found.',
    admin_orders_empty_search: () => 'No orders matching your search. Try a different query.',
    admin_orders_showing: ({ from, to, total }: { from: string; to: string; total: string }) =>
      `Showing ${from}–${to} of ${total}`,
    admin_orders_pagination: () => 'Order pagination',
    admin_orders_page_size_label: () => 'Orders per page',
    admin_orders_error_load: () => 'Failed to load orders.',
    admin_orders_error_retry: () => 'Retry',
    admin_orders_back_to_list: () => 'Back to order list',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: string; totalPages: string }) =>
      `Page ${page} of ${totalPages}`,
  },
}))

vi.mock('#/lib/orders-ui', () => ({
  statusBadgeVariant: (status: string) => {
    if (status === 'delivered' || status === 'completed') return 'success'
    if (status === 'cancelled') return 'error'
    return 'default'
  },
}))

vi.mock('#/lib/pricing', () => ({
  formatPriceEUR: (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(cents / 100),
}))

vi.mock('#/lib/admin-orders', () => ({
  listAllPlatformOrders: vi.fn(),
  getPlatformOrderDetail: vi.fn(),
}))

vi.mock('#/lib/route-guards', () => ({
  guardRole: () => Promise.resolve({ user: { id: 'admin-1', role: 'admin' } }),
  guardAuth: () => Promise.resolve({ user: { id: 'user-1', role: 'customer' } }),
}))

/* -------------------------------------------------------------------------- */
/*                                    Tests                                   */
/* -------------------------------------------------------------------------- */

describe('AdminOrdersPage', () => {
  it('renders the page title', () => {
    render(<AdminOrdersPage />)
    expect(screen.getByRole('heading', { name: 'Order Inspector' })).toBeDefined()
  })

  it('renders the description', () => {
    render(<AdminOrdersPage />)
    expect(
      screen.getByText('Search all platform orders by ID, buyer name, or email.'),
    ).toBeDefined()
  })

  it('renders a search input', () => {
    render(<AdminOrdersPage />)
    const input = screen.getByRole('textbox', {
      name: 'Search by order ID, buyer name, or email…',
    })
    expect(input).toBeDefined()
  })

  it('renders a search button', () => {
    render(<AdminOrdersPage />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeDefined()
  })

  it('renders order data when orders are available', () => {
    render(<AdminOrdersPage />)
    expect(screen.getByText('Test Buyer')).toBeDefined()
    expect(screen.getByText('buyer@example.com')).toBeDefined()
    expect(screen.getByText('paid')).toBeDefined()
  })
})
