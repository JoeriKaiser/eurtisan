// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

// Shared mutable state for loader data
let mockLoaderData: {
  disputes: Array<{
    id: string
    shopOrderId: string
    buyerName: string
    creatorName: string
    reason: string
    status: string
    createdAt: string
    orderTotalCents: number
  }>
  total: number
  page: number
  pageSize: number
} = {
  disputes: [
    {
      id: 'd1',
      shopOrderId: 'so1',
      buyerName: 'Alice',
      creatorName: 'CeramicAdam',
      reason: 'damaged',
      status: 'open',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      orderTotalCents: 2500,
    },
    {
      id: 'd2',
      shopOrderId: 'so2',
      buyerName: 'Bob',
      creatorName: 'WoodWendy',
      reason: 'not_as_described',
      status: 'open',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      orderTotalCents: 5000,
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
}

let mockSearch: Record<string, unknown> = { page: 1 }

vi.mock('#/lib/disputes', () => ({
  listOpenDisputes: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useLoaderData: () => mockLoaderData,
    useSearch: () => mockSearch,
    useNavigate: () => mockNavigate,
  }),
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
    search?: Record<string, unknown>
    disabled?: boolean
    'aria-label'?: string
    'aria-disabled'?: boolean
  }) => (
    <a
      href={`${props.to}${props.search ? `?page=${props.search.page}` : ''}`}
      className={props.className}
      aria-label={props['aria-label']}
      aria-disabled={props['aria-disabled']}
    >
      {props.children}
    </a>
  ),
}))

import { AdminDisputesPage } from './disputes'

describe('AdminDisputesPage', () => {
  beforeEach(() => {
    // Reset to default mock state
    mockLoaderData = {
      disputes: [
        {
          id: 'd1',
          shopOrderId: 'so1',
          buyerName: 'Alice',
          creatorName: 'CeramicAdam',
          reason: 'damaged',
          status: 'open',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          orderTotalCents: 2500,
        },
        {
          id: 'd2',
          shopOrderId: 'so2',
          buyerName: 'Bob',
          creatorName: 'WoodWendy',
          reason: 'not_as_described',
          status: 'open',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          orderTotalCents: 5000,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    }
    mockSearch = { page: 1 }
  })

  it('renders dispute queue with correct columns', () => {
    render(<AdminDisputesPage />)

    expect(screen.getByText('Dispute Queue')).toBeDefined()
    expect(screen.getByText('2 open disputes')).toBeDefined()
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('CeramicAdam')).toBeDefined()
    expect(screen.getByText('WoodWendy')).toBeDefined()
    // Use getAllByText since "Open" appears in both the table header badge and row badges
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(2)
  })

  it('renders links to dispute detail pages', () => {
    render(<AdminDisputesPage />)

    const links = screen.getAllByRole('link')
    // Back to dashboard + 2 dispute rows, no pagination links
    expect(links.length).toBeGreaterThanOrEqual(2)

    const detailLinks = links.filter((l) => l.getAttribute('href')?.includes('/admin/disputes/'))
    expect(detailLinks.length).toBe(2)
  })

  it('shows empty state when no open disputes', () => {
    mockLoaderData = {
      disputes: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }

    render(<AdminDisputesPage />)

    expect(screen.getByText('No open disputes')).toBeDefined()
    expect(screen.getByText('When buyers open disputes, they will appear here.')).toBeDefined()
  })

  it('renders pagination when multiple pages exist', () => {
    mockLoaderData = {
      disputes: Array.from({ length: 20 }, (_, i) => ({
        id: `d${i}`,
        shopOrderId: `so${i}`,
        buyerName: `Buyer ${i}`,
        creatorName: `Creator ${i}`,
        reason: 'damaged',
        status: 'open',
        createdAt: new Date().toISOString(),
        orderTotalCents: 1000,
      })),
      total: 50,
      page: 1,
      pageSize: 20,
    }

    render(<AdminDisputesPage />)

    expect(screen.getByText('Page 1 of 3')).toBeDefined()
    expect(screen.getByLabelText('Next page')).toBeDefined()
  })

  it('renders previous page link as disabled on first page', () => {
    mockLoaderData = {
      disputes: Array.from({ length: 20 }, (_, i) => ({
        id: `d${i}`,
        shopOrderId: `so${i}`,
        buyerName: `Buyer ${i}`,
        creatorName: `Creator ${i}`,
        reason: 'damaged',
        status: 'open',
        createdAt: new Date().toISOString(),
        orderTotalCents: 1000,
      })),
      total: 50,
      page: 1,
      pageSize: 20,
    }

    render(<AdminDisputesPage />)

    const prevLink = screen.getByLabelText('Previous page')
    expect(prevLink).toBeDefined()
    expect(prevLink.getAttribute('aria-disabled')).toBe('true')
  })
})
