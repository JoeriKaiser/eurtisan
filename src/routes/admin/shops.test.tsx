// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/* -------------------------------------------------------------------------- */
/*                          Hoisted data for mock factories                   */
/* -------------------------------------------------------------------------- */

const { mockModerateShop, mockNavigateFn } = vi.hoisted(() => ({
  mockModerateShop: vi.fn(),
  mockNavigateFn: vi.fn(),
}))

/* -------------------------------------------------------------------------- */
/*                              Module mocks                                  */
/* -------------------------------------------------------------------------- */

const goodShopsData = {
  shops: [
    {
      id: 'shop-1',
      name: 'Ceramics Co',
      slug: 'ceramics-co',
      ownerName: 'Alice',
      ownerEmail: 'alice@example.com',
      isSuspended: false,
      moderationNote: null,
      createdAt: new Date('2026-01-15').toISOString(),
    },
    {
      id: 'shop-2',
      name: 'Woodworks Ltd',
      slug: 'woodworks-ltd',
      ownerName: 'Bob',
      ownerEmail: 'bob@example.com',
      isSuspended: true,
      moderationNote: 'Contains prohibited items',
      createdAt: new Date('2026-02-20').toISOString(),
    },
    {
      id: 'shop-3',
      name: 'Textile Art',
      slug: 'textile-art',
      ownerName: 'Carol',
      ownerEmail: 'carol@example.com',
      isSuspended: false,
      moderationNote: null,
      createdAt: new Date('2026-03-10').toISOString(),
    },
    {
      id: 'shop-4',
      name: 'Pottery Place',
      slug: 'pottery-place',
      ownerName: 'Dave',
      ownerEmail: 'dave@example.com',
      isSuspended: false,
      moderationNote: null,
      createdAt: new Date('2026-03-10').toISOString(),
    },
    {
      id: 'shop-5',
      name: 'Glass Studio',
      slug: 'glass-studio',
      ownerName: 'Eve',
      ownerEmail: 'eve@example.com',
      isSuspended: false,
      moderationNote: null,
      createdAt: new Date('2026-03-10').toISOString(),
    },
  ],
  total: 5,
  page: 1,
  pageSize: 20,
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => {
    const routeObj = {
      useLoaderData: () => goodShopsData,
      useSearch: () => ({ filter: 'all', page: 1, pageSize: 20 }),
      useNavigate: () => mockNavigateFn,
    }
    return () => routeObj
  },
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_, key: string) => {
        return (...args: unknown[]) => {
          const firstArg = args[0] as Record<string, string | number> | undefined
          if (firstArg && typeof firstArg === 'object') {
            let str = String(key)
            for (const [k, v] of Object.entries(firstArg)) {
              str = str.replace(`{${k}}`, String(v))
            }
            return str
          }
          return String(key)
        }
      },
    },
  ),
}))

vi.mock('#/lib/shop-moderation', () => ({
  listAllShops: vi.fn(),
  moderateShop: mockModerateShop,
}))

vi.mock('#/lib/route-guards', () => ({
  guardRole: vi.fn().mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } }),
}))

import { AdminShopsPage } from './shops'

/* -------------------------------------------------------------------------- */
/*                               Initial Render                               */
/* -------------------------------------------------------------------------- */

describe('AdminShopsPage — initial render', () => {
  it('renders the page title', () => {
    render(<AdminShopsPage />)
    expect(screen.getByText('admin_shops_title')).toBeDefined()
  })

  it('renders all shops in the table', () => {
    render(<AdminShopsPage />)

    expect(screen.getByText('Ceramics Co')).toBeDefined()
    expect(screen.getByText('Woodworks Ltd')).toBeDefined()
    expect(screen.getByText('Textile Art')).toBeDefined()
  })

  it('renders owner names', () => {
    render(<AdminShopsPage />)

    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carol').length).toBeGreaterThan(0)
  })

  it('renders correct status badges', () => {
    render(<AdminShopsPage />)

    const activeBadges = screen.getAllByText('admin_shops_status_active')
    const suspendedBadges = screen.getAllByText('admin_shops_status_suspended')

    // 4 active (shops 1,3,4,5), 1 suspended (shop 2)
    expect(activeBadges.length).toBe(4)
    expect(suspendedBadges.length).toBe(1)
  })

  it('renders moderation notes for suspended shops', () => {
    render(<AdminShopsPage />)
    expect(screen.getByText('Contains prohibited items')).toBeDefined()
  })

  it('renders Suspend button for active shops', () => {
    render(<AdminShopsPage />)

    const suspendButtons = screen.getAllByText('admin_shops_suspend')
    expect(suspendButtons.length).toBe(4)
  })

  it('renders Unsuspend button for suspended shops', () => {
    render(<AdminShopsPage />)

    const unsuspendButtons = screen.getAllByText('admin_shops_unsuspend')
    expect(unsuspendButtons.length).toBe(1)
  })

  it('renders filter tabs', () => {
    render(<AdminShopsPage />)

    expect(screen.getByRole('tab', { name: 'admin_shops_filter_all' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'admin_shops_filter_active' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'admin_shops_filter_suspended' })).toBeDefined()
  })

  it('marks the All filter tab as selected by default', () => {
    render(<AdminShopsPage />)

    const allTab = screen.getByRole('tab', { name: 'admin_shops_filter_all' })
    expect(allTab.getAttribute('aria-selected')).toBe('true')
  })

  it('renders showing text', () => {
    render(<AdminShopsPage />)
    expect(screen.getByText('admin_shops_showing')).toBeDefined()
  })
})

/* -------------------------------------------------------------------------- */
/*                             Filter Tab Clicks                              */
/* -------------------------------------------------------------------------- */

describe('AdminShopsPage — filter tabs', () => {
  beforeEach(() => {
    mockNavigateFn.mockClear()
  })

  it('navigates to Active filter when Active tab is clicked', () => {
    render(<AdminShopsPage />)

    const activeTab = screen.getByRole('tab', { name: 'admin_shops_filter_active' })
    fireEvent.click(activeTab)

    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/admin/shops',
        search: expect.objectContaining({ filter: 'active', page: 1 }),
        replace: true,
      }),
    )
  })

  it('navigates to Suspended filter when Suspended tab is clicked', () => {
    render(<AdminShopsPage />)

    const suspendedTab = screen.getByRole('tab', { name: 'admin_shops_filter_suspended' })
    fireEvent.click(suspendedTab)

    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/admin/shops',
        search: expect.objectContaining({ filter: 'suspended', page: 1 }),
        replace: true,
      }),
    )
  })

  it('navigates to All filter when All tab is clicked', () => {
    render(<AdminShopsPage />)

    const allTab = screen.getByRole('tab', { name: 'admin_shops_filter_all' })
    fireEvent.click(allTab)

    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/admin/shops',
        search: expect.objectContaining({ filter: 'all', page: 1 }),
        replace: true,
      }),
    )
  })
})

/* -------------------------------------------------------------------------- */
/*                            Suspend Flow (Happy)                            */
/* -------------------------------------------------------------------------- */

describe('AdminShopsPage — suspend flow', () => {
  beforeEach(() => {
    mockModerateShop.mockClear()
  })

  it('opens the suspend confirmation dialog when Suspend is clicked', () => {
    render(<AdminShopsPage />)

    const suspendButtons = screen.getAllByText('admin_shops_suspend')
    fireEvent.click(suspendButtons[0])

    // Dialog should appear
    expect(screen.getByText('admin_shops_suspend_dialog_title')).toBeDefined()
    expect(screen.getByText('admin_shops_suspend_dialog_description')).toBeDefined()
    // Moderation note textarea
    expect(screen.getByLabelText('admin_shops_suspend_note_label')).toBeDefined()
    // Cancel and confirm buttons
    expect(screen.getByText('admin_shops_cancel')).toBeDefined()
    expect(screen.getByText('admin_shops_confirm_suspend')).toBeDefined()
  })

  it('closes the dialog when Cancel is clicked', () => {
    render(<AdminShopsPage />)

    const suspendButtons = screen.getAllByText('admin_shops_suspend')
    fireEvent.click(suspendButtons[0])

    expect(screen.getByText('admin_shops_suspend_dialog_title')).toBeDefined()

    fireEvent.click(screen.getByText('admin_shops_cancel'))

    // Dialog should be gone
    expect(screen.queryByText('admin_shops_suspend_dialog_title')).toBeNull()
  })

  it('shows success feedback after a successful suspend', async () => {
    mockModerateShop.mockResolvedValueOnce({
      id: 'shop-1',
      name: 'Ceramics Co',
      isSuspended: true,
      moderationNote: 'Violation',
    })

    render(<AdminShopsPage />)

    const suspendButtons = screen.getAllByText('admin_shops_suspend')
    fireEvent.click(suspendButtons[0])

    // Confirm the suspension
    fireEvent.click(screen.getByText('admin_shops_confirm_suspend'))

    await waitFor(() => {
      expect(screen.getByText('admin_shops_suspended_success')).toBeDefined()
    })

    // Dialog should be closed after success
    expect(screen.queryByText('admin_shops_suspend_dialog_title')).toBeNull()
  })

  it('shows error feedback after a failed suspend', async () => {
    mockModerateShop.mockRejectedValueOnce(new Error('Network error'))

    render(<AdminShopsPage />)

    const suspendButtons = screen.getAllByText('admin_shops_suspend')
    fireEvent.click(suspendButtons[0])

    fireEvent.click(screen.getByText('admin_shops_confirm_suspend'))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined()
    })
  })
})

/* -------------------------------------------------------------------------- */
/*                           Unsuspend Flow (Happy)                           */
/* -------------------------------------------------------------------------- */

describe('AdminShopsPage — unsuspend flow', () => {
  beforeEach(() => {
    mockModerateShop.mockClear()
  })

  it('calls moderateShop immediately when Unsuspend is clicked (no dialog)', async () => {
    mockModerateShop.mockResolvedValueOnce({
      id: 'shop-2',
      name: 'Woodworks Ltd',
      isSuspended: false,
      moderationNote: null,
    })

    render(<AdminShopsPage />)

    const unsuspendButtons = screen.getAllByText('admin_shops_unsuspend')
    fireEvent.click(unsuspendButtons[0])

    // Should call moderateShop with unsuspend action
    await waitFor(() => {
      expect(mockModerateShop).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shopId: 'shop-2',
            action: 'unsuspend',
          }),
        }),
      )
    })
  })

  it('shows success feedback after a successful unsuspend', async () => {
    mockModerateShop.mockResolvedValueOnce({
      id: 'shop-2',
      name: 'Woodworks Ltd',
      isSuspended: false,
      moderationNote: null,
    })

    render(<AdminShopsPage />)

    const unsuspendButtons = screen.getAllByText('admin_shops_unsuspend')
    fireEvent.click(unsuspendButtons[0])

    await waitFor(() => {
      expect(screen.getByText('admin_shops_unsuspended_success')).toBeDefined()
    })
  })

  it('shows error feedback after a failed unsuspend', async () => {
    mockModerateShop.mockRejectedValueOnce(new Error('Network error'))

    render(<AdminShopsPage />)

    const unsuspendButtons = screen.getAllByText('admin_shops_unsuspend')
    fireEvent.click(unsuspendButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined()
    })
  })
})

/* -------------------------------------------------------------------------- */
/*                               Pagination                                   */
/* -------------------------------------------------------------------------- */

describe('AdminShopsPage — pagination', () => {
  beforeEach(() => {
    mockNavigateFn.mockClear()
  })

  it('shows page size select with 10, 20, 50 options', () => {
    render(<AdminShopsPage />)

    const pageSizeSelect = screen.getByLabelText('admin_shops_page_size_label') as HTMLSelectElement
    expect(pageSizeSelect).toBeDefined()

    const options = Array.from(pageSizeSelect.options).map((o) => o.value)
    expect(options).toContain('10')
    expect(options).toContain('20')
    expect(options).toContain('50')
  })

  it('navigates with new pageSize when page size is changed', () => {
    render(<AdminShopsPage />)

    const pageSizeSelect = screen.getByLabelText('admin_shops_page_size_label')
    fireEvent.change(pageSizeSelect, { target: { value: '10' } })

    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/admin/shops',
        search: expect.objectContaining({ pageSize: 10, page: 1 }),
        replace: true,
      }),
    )
  })
})
