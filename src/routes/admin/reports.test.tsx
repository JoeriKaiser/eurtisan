// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAdminProductReports: vi.fn(),
  getAdminShopReports: vi.fn(),
  resolveProductReport: vi.fn(),
  resolveShopReport: vi.fn(),
  state: {
    search: {
      content: 'product' as 'product' | 'shop',
      page: 2,
      pageSize: 20,
    },
    loaderData: {} as unknown,
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => mocks.state.loaderData,
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.state.search,
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}))

vi.mock('#/lib/products', () => ({
  getAdminProductReports: mocks.getAdminProductReports,
  resolveProductReport: mocks.resolveProductReport,
}))

vi.mock('#/lib/shop-profile', () => ({
  getAdminShopReports: mocks.getAdminShopReports,
  resolveShopReport: mocks.resolveShopReport,
}))

vi.mock('#/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, key: string) => (params?: Record<string, string | number>) =>
        params
          ? `${key} ${Object.entries(params)
              .map(([name, value]) => `${name}=${value}`)
              .join(' ')}`
          : key,
    },
  ),
}))

import { reportsSearchSchema, Route } from './reports'

const AdminReportsPage = Route.options.component as React.ComponentType
const routeLoader = Route.options.loader as (args: {
  deps: {
    content: 'product' | 'shop'
    page: number
    pageSize: number
  }
}) => Promise<unknown>

function productQueue() {
  return {
    content: 'product' as const,
    queue: {
      reports: [
        {
          id: 'report-1',
          productId: 'product-1',
          productName: 'Stoneware bowl',
          reason: 'illegal' as const,
          details: 'Contains a prohibited substance.',
          reporterUserId: 'user-1',
          createdAt: new Date('2026-07-01T10:00:00Z'),
        },
      ],
      total: 21,
      page: 2,
      pageSize: 20,
    },
  }
}

function shopQueue() {
  return {
    content: 'shop' as const,
    queue: {
      reports: [
        {
          id: 'shop-report-1',
          shopId: 'shop-1',
          shopName: 'North Clay',
          reason: 'fraud' as const,
          details: 'Shop impersonates another maker.',
          reporterUserId: 'user-2',
          createdAt: new Date('2026-07-02T10:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    },
  }
}

beforeEach(() => {
  mocks.navigate.mockReset()
  mocks.getAdminProductReports.mockReset().mockResolvedValue(productQueue().queue)
  mocks.getAdminShopReports.mockReset().mockResolvedValue(shopQueue().queue)
  mocks.resolveProductReport.mockReset().mockResolvedValue({ ok: true })
  mocks.resolveShopReport.mockReset().mockResolvedValue({ ok: true })
  mocks.state.search = {
    content: 'product',
    page: 2,
    pageSize: 20,
  }
  mocks.state.loaderData = productQueue()
})

describe('admin reports search', () => {
  it('validates deep-linked content, page, and page size', () => {
    expect(
      reportsSearchSchema.parse({
        content: 'shop',
        page: '3',
        pageSize: '10',
      }),
    ).toEqual({ content: 'shop', page: 3, pageSize: 10 })
    expect(reportsSearchSchema.parse({})).toEqual({
      content: 'product',
      page: 1,
      pageSize: 20,
    })

    expect(reportsSearchSchema.safeParse({ content: 'reviews' }).success).toBe(false)
    expect(reportsSearchSchema.safeParse({ page: 0 }).success).toBe(false)
    expect(reportsSearchSchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })

  it('loads only the selected shop reports queue', async () => {
    await routeLoader({
      deps: { content: 'shop', page: 3, pageSize: 20 },
    })

    expect(mocks.getAdminShopReports).toHaveBeenCalledWith({
      data: { page: 3, pageSize: 20 },
    })
    expect(mocks.getAdminProductReports).not.toHaveBeenCalled()
  })
})

describe('AdminReportsPage', () => {
  it('switches content with a page reset while preserving page size', () => {
    render(<AdminReportsPage />)

    const productButton = screen.getByRole('button', { name: 'admin_reports_content_product' })
    expect(productButton.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'admin_reports_content_shop' }))

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/admin/reports',
      search: {
        content: 'shop',
        page: 1,
        pageSize: 20,
      },
      replace: true,
    })
  })

  it('upholds a product report after collecting ground and explanation', async () => {
    render(<AdminReportsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'admin_reports_uphold' }))
    const submit = screen.getByRole('button', { name: 'admin_reports_decision_submit' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(
      screen.getByRole('textbox', { name: /admin_reports_decision_explanation_label/ }),
      { target: { value: 'This listing sells a prohibited item.' } },
    )
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)

    await waitFor(() => {
      expect(mocks.resolveProductReport).toHaveBeenCalledWith({
        data: {
          productId: 'product-1',
          restrict: true,
          ground: 'terms',
          explanation: 'This listing sells a prohibited item.',
        },
      })
    })
    await waitFor(() => {
      expect(screen.queryByText('Stoneware bowl')).toBeNull()
    })
  })

  it('dismisses a product report without opening the decision dialog', async () => {
    render(<AdminReportsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'admin_reports_dismiss' }))

    await waitFor(() => {
      expect(mocks.resolveProductReport).toHaveBeenCalledWith({
        data: {
          productId: 'product-1',
          restrict: false,
          ground: 'terms',
          explanation: 'admin_reports_dismiss_explanation',
        },
      })
    })
    expect(screen.queryByRole('button', { name: 'admin_reports_decision_submit' })).toBeNull()
  })

  it('keeps the decision open and announces an uphold failure', async () => {
    mocks.resolveProductReport.mockRejectedValueOnce(new Error('network'))
    render(<AdminReportsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'admin_reports_uphold' }))
    fireEvent.change(
      screen.getByRole('textbox', { name: /admin_reports_decision_explanation_label/ }),
      { target: { value: 'This decision has an explanation.' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'admin_reports_decision_submit' }))

    const error = await screen.findByText('admin_reports_decision_error')
    expect(error.closest('[role="alert"]')).not.toBeNull()
    expect(mocks.resolveProductReport).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Stoneware bowl')).toBeTruthy()
  })
})
