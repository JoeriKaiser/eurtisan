// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useLoaderData: () => ({
      disputes: [
        {
          id: 'd1',
          shopOrderId: 'so1',
          buyerName: 'Alice',
          shopName: 'Ceramics Co',
          reason: 'damaged',
          status: 'open',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          orderTotalCents: 2500,
        },
        {
          id: 'd2',
          shopOrderId: 'so2',
          buyerName: 'Bob',
          shopName: 'Woodworks',
          reason: 'not_as_described',
          status: 'open',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          orderTotalCents: 5000,
        },
      ],
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
}))

import { AdminDisputesPage } from './disputes'

describe('AdminDisputesPage', () => {
  it('renders dispute queue with correct columns', () => {
    render(<AdminDisputesPage />)

    expect(screen.getByText('Dispute Queue')).toBeDefined()
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('Ceramics Co')).toBeDefined()
    expect(screen.getByText('Woodworks')).toBeDefined()
    expect(screen.getByText('€25,00')).toBeDefined()
    expect(screen.getByText('€50,00')).toBeDefined()
  })

  it('renders links to dispute detail pages', () => {
    render(<AdminDisputesPage />)

    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThanOrEqual(2)
  })
})
