// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockLoaderData: { shops: Array<{ id: string; name: string }> } = { shops: [] }

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode
    to: string
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  Navigate: ({ to, params }: { to: string; params?: Record<string, string> }) => (
    <div data-testid='mock-navigate' data-to={to} data-params={JSON.stringify(params)} />
  ),
  createFileRoute:
    () =>
    (config: {
      component: React.ComponentType
      loader?: () => unknown
      beforeLoad?: () => unknown
    }) => ({
      options: config,
      ...config,
      useLoaderData: () => mockLoaderData,
    }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    studio_no_shops_title: () => 'Creator Studio',
    studio_no_shops_description: () =>
      'You do not have any shops yet. Create your first shop to start selling.',
    studio_no_shops_cta: () => 'Open your shop',
  },
}))

vi.mock('#/lib/route-guards', () => ({
  guardPrivilegedRole: vi.fn(),
}))

vi.mock('#/lib/creator-dashboard', () => ({
  getCreatorShops: vi.fn(),
}))

import { Route } from './index'

const StudioComponent = Route.options.component
if (!StudioComponent) {
  throw new Error('Route component is not defined')
}

describe('Studio index route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state with localized copy and link to /sell when creator has no shops', () => {
    mockLoaderData = { shops: [] }

    render(<StudioComponent />)

    expect(screen.getByRole('heading', { level: 1, name: 'Creator Studio' })).toBeDefined()
    expect(
      screen.getByText('You do not have any shops yet. Create your first shop to start selling.'),
    ).toBeDefined()

    const link = screen.getByRole('link', { name: 'Open your shop' })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('/sell')
  })

  it('navigates to the first shop studio when shops exist', () => {
    mockLoaderData = {
      shops: [
        { id: 'shop-abc-123', name: 'Artisan Workshop' },
        { id: 'shop-def-456', name: 'Second Workshop' },
      ],
    }

    render(<StudioComponent />)

    const navigate = screen.getByTestId('mock-navigate')
    expect(navigate).toBeDefined()
    expect(navigate.getAttribute('data-to')).toBe('/studio/$shopId')
    expect(navigate.getAttribute('data-params')).toBe(JSON.stringify({ shopId: 'shop-abc-123' }))
  })
})
