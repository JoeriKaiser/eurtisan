// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockInvalidate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useParams: () => ({ disputeId: 'd1' }),
    useLoaderData: () => {
      const dispute = {
        id: 'd1',
        shopOrderId: 'so1',
        buyerUserId: 'u1',
        reason: 'damaged',
        description: 'Item arrived broken',
        status: 'open',
        resolution: null,
        refundCents: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        buyer: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
        shop: { id: 'u2', name: 'Bob', email: 'bob@example.com' },
        order: {
          id: 'so1',
          platformOrderId: 'po1',
          shopId: 'shop-1',
          shopName: 'Ceramics Co',
          status: 'disputed',
          subtotalCents: 2000,
          shippingCostCents: 500,
          totalCents: 2500,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            {
              id: 'oi1',
              productId: 'p1',
              productName: 'Ceramic Vase',
              unitPriceCents: 1000,
              quantity: 2,
              totalCents: 2000,
            },
          ],
        },
        messages: [
          {
            id: 'm1',
            senderName: 'Alice',
            message: 'The vase is cracked',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      }
      return { dispute }
    },
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
  notFound: () => new Error('NotFound'),
  useRouter: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('#/lib/disputes', () => ({
  getDisputeDetail: vi.fn(),
  addDisputeMessage: vi.fn().mockResolvedValue({}),
  resolveDispute: vi.fn().mockResolvedValue({}),
}))

import { AdminDisputeDetailPage } from './$disputeId'

describe('AdminDisputeDetailPage', () => {
  it('renders dispute detail with order summary', () => {
    render(<AdminDisputeDetailPage />)

    expect(screen.getByText('Order Summary')).toBeDefined()
    expect(screen.getByText('Ceramics Co')).toBeDefined()
    expect(screen.getByText('Participants')).toBeDefined()
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('Dispute Description')).toBeDefined()
    expect(screen.getByText('Item arrived broken')).toBeDefined()
  })

  it('renders order items', () => {
    render(<AdminDisputeDetailPage />)

    expect(screen.getByText('Items Purchased')).toBeDefined()
    expect(screen.getByText('Ceramic Vase')).toBeDefined()
    // €20,00 appears in both subtotal and item total — verify at least one exists
    expect(screen.getAllByText('€20,00').length).toBeGreaterThanOrEqual(1)
  })

  it('renders participant emails', () => {
    render(<AdminDisputeDetailPage />)

    expect(screen.getByText('alice@example.com')).toBeDefined()
    expect(screen.getByText('bob@example.com')).toBeDefined()
  })

  it('renders message thread', () => {
    render(<AdminDisputeDetailPage />)

    expect(screen.getByText('Message Thread')).toBeDefined()
    expect(screen.getByText('The vase is cracked')).toBeDefined()
  })

  it('renders admin message input for open disputes', () => {
    render(<AdminDisputeDetailPage />)

    expect(screen.getByText('Send a message')).toBeDefined()
    expect(screen.getByLabelText('Admin message')).toBeDefined()
    expect(screen.getByText('Send')).toBeDefined()
  })

  it('renders resolution form with dropdown', () => {
    render(<AdminDisputeDetailPage />)

    expect(screen.getByText('Resolve Dispute')).toBeDefined()
    expect(screen.getByLabelText('Resolution')).toBeDefined()
    expect(screen.getByText('Submit Resolution')).toBeDefined()
  })

  it('shows refund input when partial refund is selected', () => {
    render(<AdminDisputeDetailPage />)

    const select = screen.getByLabelText('Resolution')
    fireEvent.change(select, { target: { value: 'partial_refund' } })

    expect(screen.getByLabelText('Refund amount (EUR)')).toBeDefined()
  })

  it('full_refund option is not disabled when order is not refunded', () => {
    render(<AdminDisputeDetailPage />)

    const select = screen.getByLabelText('Resolution')
    const fullRefundOption = select.querySelector(
      'option[value="full_refund"]',
    ) as HTMLOptionElement
    expect(fullRefundOption).toBeDefined()
    expect(fullRefundOption.disabled).toBe(false)
  })
})
