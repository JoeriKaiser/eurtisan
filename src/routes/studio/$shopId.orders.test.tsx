// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ shopId: 'shop-1' }),
  useLoaderData: () => ({
    result: {
      orders: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          platformOrderId: 'order-1',
          status: 'paid',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 2000,
          totalCents: 2500,
          trackingNumber: null,
          createdAt: new Date('2026-05-01').toISOString(),
          buyerName: 'Alice',
          buyerEmail: 'a***@example.com',
          itemCount: 2,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          platformOrderId: 'order-2',
          status: 'shipped',
          shippingMethod: 'express',
          shippingCostCents: 1000,
          subtotalCents: 3000,
          totalCents: 4000,
          trackingNumber: 'TRACK123',
          createdAt: new Date('2026-05-02').toISOString(),
          buyerName: 'Bob',
          buyerEmail: 'b***@example.com',
          itemCount: 1,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    },
    status: '',
    searchQuery: '',
  }),
  useNavigate: () => mockNavigate,
  createFileRoute: () => (options: { component?: unknown }) => ({
    options,
    useParams: () => ({ shopId: 'shop-1' }),
    useLoaderData: () => ({
      result: {
        orders: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            platformOrderId: 'order-1',
            status: 'paid',
            shippingMethod: 'standard',
            shippingCostCents: 500,
            subtotalCents: 2000,
            totalCents: 2500,
            trackingNumber: null,
            createdAt: new Date('2026-05-01').toISOString(),
            buyerName: 'Alice',
            buyerEmail: 'a***@example.com',
            itemCount: 2,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            platformOrderId: 'order-2',
            status: 'shipped',
            shippingMethod: 'express',
            shippingCostCents: 1000,
            subtotalCents: 3000,
            totalCents: 4000,
            trackingNumber: 'TRACK123',
            createdAt: new Date('2026-05-02').toISOString(),
            buyerName: 'Bob',
            buyerEmail: 'b***@example.com',
            itemCount: 1,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
      status: '',
      searchQuery: '',
    }),
    useNavigate: () => mockNavigate,
  }),
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
  }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: number; totalPages: number }) =>
      `Page ${page} of ${totalPages}`,
  },
}))

import { Route } from './$shopId.orders'

const ShopOrdersPage = Route.options.component!

describe('ShopOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders order list with buyer info and status badges', () => {
    render(<ShopOrdersPage />)

    expect(screen.getByText('Shop Orders')).toBeDefined()
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('paid')).toBeDefined()
    expect(screen.getByText('shipped')).toBeDefined()
    expect(screen.getByText('€25.00')).toBeDefined()
    expect(screen.getByText('€40.00')).toBeDefined()
    expect(screen.getByText('a***@example.com')).toBeDefined()
    expect(screen.getByText('b***@example.com')).toBeDefined()
  })

  it('has a search input', () => {
    render(<ShopOrdersPage />)
    expect(screen.getByLabelText('Search orders')).toBeDefined()
  })

  it('has a status filter dropdown', () => {
    render(<ShopOrdersPage />)
    expect(screen.getByLabelText('Filter by status')).toBeDefined()
  })

  it('submits search on Enter key', () => {
    render(<ShopOrdersPage />)
    const searchInput = screen.getByLabelText('Search orders')
    fireEvent.change(searchInput, { target: { value: 'Alice' } })
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

    expect(mockNavigate).toHaveBeenCalled()
  })

  it('changes status filter and navigates', () => {
    render(<ShopOrdersPage />)
    const select = screen.getByLabelText('Filter by status')
    fireEvent.change(select, { target: { value: 'paid' } })

    expect(mockNavigate).toHaveBeenCalled()
  })
})
