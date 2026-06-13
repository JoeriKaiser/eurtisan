// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ShopDashboard } from './$shopId'

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ shopId: 'shop-1' }),
  useLoaderData: () => ({
    stats: {
      pendingOrdersCount: 3,
      lowStockProductCount: 2,
      revenueThisMonthCents: 12500,
      totalActiveProducts: 7,
    },
  }),
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
    className?: string
  }) => (
    <a
      href={props.to}
      className={props.className}
      data-params={JSON.stringify(props.params)}
      data-search={JSON.stringify(props.search)}
    >
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    studio_dashboard_title: () => 'Shop Dashboard',
    studio_dashboard_description: () => 'Manage your shop and track performance.',
    studio_nav_orders: () => 'Orders',
    studio_nav_orders_desc: () => 'Manage and fulfill orders.',
    studio_nav_products: () => 'Products',
    studio_nav_products_desc: () => 'Edit your product catalog.',
    studio_nav_payouts: () => 'Payouts',
    studio_nav_payouts_desc: () => 'Connect Mollie and view payouts.',
    studio_nav_settings: () => 'Settings',
    studio_nav_settings_desc: () => 'Shop profile, VAT, and shipping origin.',
    studio_metric_pending_orders: () => 'Pending orders',
    studio_metric_low_stock: () => 'Low stock',
    studio_metric_revenue_this_month: () => 'Revenue this month',
    studio_metric_active_products: () => 'Active products',
  },
}))

vi.mock('#/lib/pricing', () => ({
  formatPriceEUR: (cents: number) => `€${(cents / 100).toFixed(2)}`,
}))

describe('ShopDashboard', () => {
  it('renders title and description', () => {
    render(<ShopDashboard />)
    expect(screen.getByText('Shop Dashboard')).toBeDefined()
    expect(screen.getByText('Manage your shop and track performance.')).toBeDefined()
  })

  it('renders metrics from loader data', () => {
    render(<ShopDashboard />)
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('€125.00')).toBeDefined()
    expect(screen.getByText('7')).toBeDefined()
  })

  it('links navigation cards to the correct routes', () => {
    render(<ShopDashboard />)

    const ordersLink = screen.getByRole('link', { name: /orders/i })
    expect(ordersLink.getAttribute('href')).toBe('/studio/$shopId/orders')
    expect(ordersLink.getAttribute('data-params')).toBe(JSON.stringify({ shopId: 'shop-1' }))

    const productsLink = screen.getByRole('link', { name: /products/i })
    expect(productsLink.getAttribute('href')).toBe('/creator/products')
    expect(productsLink.getAttribute('data-search')).toBe(JSON.stringify({ shopId: 'shop-1' }))

    const payoutsLink = screen.getByRole('link', { name: /payouts/i })
    expect(payoutsLink.getAttribute('href')).toBe('/creator/payouts')
    expect(payoutsLink.getAttribute('data-search')).toBe(JSON.stringify({ shopId: 'shop-1' }))

    const settingsLink = screen.getByRole('link', { name: /settings/i })
    expect(settingsLink.getAttribute('href')).toBe('/creator/shop')
    expect(settingsLink.getAttribute('data-search')).toBe(JSON.stringify({ shopId: 'shop-1' }))
  })
})
