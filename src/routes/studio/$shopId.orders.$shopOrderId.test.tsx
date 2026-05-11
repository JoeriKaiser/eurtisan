// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

const mockInvalidate = vi.fn()
const mockMarkShipped = vi.hoisted(() => vi.fn())
const mockMarkDelivered = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useParams: () => ({ shopId: 'shop-1', shopOrderId: '550e8400-e29b-41d4-a716-446655440001' }),
    useLoaderData: () => ({
      order: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        platformOrderId: 'order-1',
        shopId: 'shop-1',
        status: 'paid',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
        trackingNumber: null,
        trackingUrl: null,
        createdAt: new Date('2026-05-01').toISOString(),
        updatedAt: new Date('2026-05-01').toISOString(),
        buyer: { id: 'user-1', name: 'Alice', email: 'a***@example.com' },
        shippingAddress: {
          name: 'Alice',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Vase',
            unitPriceCents: 1000,
            quantity: 2,
            totalCents: 2000,
          },
        ],
      },
    }),
    useNavigate: () => vi.fn(),
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
  notFound: () => new Response('Not Found', { status: 404 }),
  useRouter: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('#/lib/shop-orders', () => ({
  getShopOrderDetail: vi.fn(),
  markShopOrderShipped: (opts: { data: Record<string, unknown> }) => mockMarkShipped(opts.data),
  markShopOrderDelivered: (opts: { data: Record<string, unknown> }) => mockMarkDelivered(opts.data),
}))

vi.mock('#/lib/orders-ui', () => ({
  FULFILLMENT_STATUSES: ['paid', 'processing', 'shipped', 'delivered'],
  isStatusReached: (current: string, step: string) => {
    const order = ['paid', 'processing', 'shipped', 'delivered']
    return order.indexOf(current) >= order.indexOf(step)
  },
  isSupportedShippingCountry: (code: string) => code === 'DE',
  statusTimelineLabel: (status: string) => status.charAt(0).toUpperCase() + status.slice(1),
}))

vi.mock('#/components/ui/primitives/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid='dialog'>{children}</div> : null,
  DialogBackdrop: () => <div data-testid='dialog-backdrop' />,
  DialogPopup: ({ children }: { children: React.ReactNode }) => <div role='dialog'>{children}</div>,
  DialogPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

import { ShopOrderDetailPage } from './$shopId.orders.$shopOrderId'

describe('ShopOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMarkShipped.mockResolvedValue({})
    mockMarkDelivered.mockResolvedValue({})
  })

  it('renders order detail with masked buyer email', () => {
    render(<ShopOrderDetailPage />)

    expect(screen.getByText('Order Detail')).toBeDefined()
    expect(screen.getByText('a***@example.com')).toBeDefined()
    expect(screen.getByText('Vase')).toBeDefined()
  })

  it('shows Mark as Shipped button for paid orders', () => {
    render(<ShopOrderDetailPage />)
    expect(screen.getByRole('button', { name: /Mark as Shipped/i })).toBeDefined()
  })

  it('opens ship dialog when clicking Mark as Shipped', () => {
    render(<ShopOrderDetailPage />)
    fireEvent.click(screen.getAllByRole('button', { name: /Mark as Shipped/i })[0])
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Mark as Shipped' })).toBeDefined()
  })

  it('submits tracking info and invalidates on success', async () => {
    render(<ShopOrderDetailPage />)
    fireEvent.click(screen.getAllByRole('button', { name: /Mark as Shipped/i })[0])

    const trackingInput = screen.getByLabelText('Tracking Number')
    fireEvent.change(trackingInput, { target: { value: 'TRACK123' } })

    const urlInput = screen.getByLabelText('Tracking URL')
    fireEvent.change(urlInput, { target: { value: 'https://track.example.com/123' } })

    const form = screen.getByRole('dialog').querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockMarkShipped).toHaveBeenCalledWith(
        expect.objectContaining({
          shopOrderId: '550e8400-e29b-41d4-a716-446655440001',
          trackingNumber: 'TRACK123',
          trackingUrl: 'https://track.example.com/123',
        }),
      )
    })
  })

  it('shows validation error for invalid tracking URL', async () => {
    render(<ShopOrderDetailPage />)
    fireEvent.click(screen.getAllByRole('button', { name: /Mark as Shipped/i })[0])

    const urlInput = screen.getByLabelText('Tracking URL')
    fireEvent.change(urlInput, { target: { value: 'not-a-url' } })

    const form2 = screen.getByRole('dialog').querySelector('form')!
    fireEvent.submit(form2)

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid URL')).toBeDefined()
    })
  })
})
