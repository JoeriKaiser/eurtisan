// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockInvalidate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useParams: () => ({ disputeId: 'd1' }),
    useLoaderData: () => ({
      dispute: {
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
        buyer: { id: 'u1', name: 'Alice' },
        shop: { id: 'u2', name: 'Bob' },
        order: {
          id: 'so1',
          shopId: 'shop-1',
          shopName: 'Ceramics Co',
          status: 'disputed',
          subtotalCents: 2000,
          shippingCostCents: 500,
          totalCents: 2500,
        },
        messages: [
          {
            id: 'm1',
            senderName: 'Alice',
            message: 'The vase is cracked',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
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
  notFound: () => new Error('NotFound'),
  useRouter: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('#/lib/disputes', () => ({
  getDisputeDetail: vi.fn(),
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

  it('renders message thread', () => {
    render(<AdminDisputeDetailPage />)

    expect(screen.getByText('Message Thread')).toBeDefined()
    expect(screen.getByText('The vase is cracked')).toBeDefined()
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
})
