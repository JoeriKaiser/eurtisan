// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component?: unknown }) => ({
    options,
    useLoaderData: () => ({
      products: {
        products: [
          {
            id: 'prod-1',
            name: 'Vase',
            slug: 'vase',
            priceCents: 1000,
            stockCount: 5,
            isActive: true,
            shopId: 'shop-1',
            shopName: 'Test Shop',
            categoryId: 'cat-1',
            categoryName: 'Pottery',
            createdAt: new Date(),
            thumbnailUrl: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      shops: [
        {
          id: 'shop-1',
          name: 'Test Shop',
          slug: 'test-shop',
          ownerName: 'Owner',
          ownerEmail: 'o@example.com',
          status: 'active',
          isSuspended: false,
          moderationNote: null,
          createdAt: new Date(),
        },
      ],
      categories: [
        {
          id: 'cat-1',
          name: 'Pottery',
          slug: 'pottery',
          description: null,
          parentId: null,
          sortOrder: 0,
          createdAt: new Date(),
          children: [],
        },
      ],
    }),
    useNavigate: () => mockNavigate,
    useSearch: () => ({
      query: '',
      shopId: undefined,
      categoryId: undefined,
      status: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      page: 1,
      pageSize: 20,
    }),
  }),
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
      get: (_target, key: string) => {
        return (params?: Record<string, string | number>) => {
          const base = key.replace(/_/g, ' ')
          if (!params) return base
          return `${base} ${Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')}`
        }
      },
    },
  ),
}))

vi.mock('#/lib/admin-products', () => ({
  listAllProducts: vi.fn().mockResolvedValue({
    products: [
      {
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 1000,
        stockCount: 5,
        isActive: true,
        shopId: 'shop-1',
        shopName: 'Test Shop',
        categoryId: 'cat-1',
        categoryName: 'Pottery',
        createdAt: new Date(),
        thumbnailUrl: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  }),
  toggleProductActive: vi.fn().mockResolvedValue({ id: 'prod-1', isActive: false }),
}))

vi.mock('#/lib/shop-moderation', () => ({
  listAllShops: vi.fn().mockResolvedValue({
    shops: [
      {
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerName: 'Owner',
        ownerEmail: 'o@example.com',
        status: 'active',
        isSuspended: false,
        moderationNote: null,
        createdAt: new Date(),
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  }),
}))

vi.mock('#/lib/categories', () => ({
  listCategories: vi.fn().mockResolvedValue([
    {
      id: 'cat-1',
      name: 'Pottery',
      slug: 'pottery',
      description: null,
      parentId: null,
      sortOrder: 0,
      createdAt: new Date(),
      children: [],
    },
  ]),
}))

import { Route } from './products'

const AdminProductsPage = Route.options.component!

describe('AdminProductsPage', () => {
  it('renders the page title', () => {
    render(<AdminProductsPage />)
    expect(screen.getByRole('heading', { name: /admin products title/i })).toBeDefined()
  })

  it('renders product data', () => {
    render(<AdminProductsPage />)
    expect(screen.getByText('Vase')).toBeDefined()
    expect(screen.getAllByText('Test Shop').length).toBeGreaterThanOrEqual(1)
  })
})
