// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => ({
    flat: [
      {
        id: 'cat-1',
        name: 'Root',
        slug: 'root',
        description: null,
        parentId: null,
        sortOrder: 0,
        createdAt: new Date(),
        depth: 0,
      },
      {
        id: 'cat-2',
        name: 'Child',
        slug: 'child',
        description: null,
        parentId: 'cat-1',
        sortOrder: 1,
        createdAt: new Date(),
        depth: 1,
      },
    ],
    tree: [
      {
        id: 'cat-1',
        name: 'Root',
        slug: 'root',
        description: null,
        parentId: null,
        sortOrder: 0,
        createdAt: new Date(),
        children: [
          {
            id: 'cat-2',
            name: 'Child',
            slug: 'child',
            description: null,
            parentId: 'cat-1',
            sortOrder: 0,
            createdAt: new Date(),
            children: [],
          },
        ],
      },
    ],
  }),
  useNavigate: () => mockNavigate,
  createFileRoute: () => (options: { component?: unknown }) => ({
    options,
    useLoaderData: () => ({
      flat: [
        {
          id: 'cat-1',
          name: 'Root',
          slug: 'root',
          description: null,
          parentId: null,
          sortOrder: 0,
          createdAt: new Date(),
          depth: 0,
        },
        {
          id: 'cat-2',
          name: 'Child',
          slug: 'child',
          description: null,
          parentId: 'cat-1',
          sortOrder: 1,
          createdAt: new Date(),
          depth: 1,
        },
      ],
      tree: [
        {
          id: 'cat-1',
          name: 'Root',
          slug: 'root',
          description: null,
          parentId: null,
          sortOrder: 0,
          createdAt: new Date(),
          children: [
            {
              id: 'cat-2',
              name: 'Child',
              slug: 'child',
              description: null,
              parentId: 'cat-1',
              sortOrder: 0,
              createdAt: new Date(),
              children: [],
            },
          ],
        },
      ],
    }),
    useNavigate: () => mockNavigate,
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

vi.mock('#/lib/admin-categories', () => ({
  listCategoriesAdmin: vi.fn().mockResolvedValue([
    {
      id: 'cat-1',
      name: 'Root',
      slug: 'root',
      description: null,
      parentId: null,
      sortOrder: 0,
      createdAt: new Date(),
      depth: 0,
    },
    {
      id: 'cat-2',
      name: 'Child',
      slug: 'child',
      description: null,
      parentId: 'cat-1',
      sortOrder: 1,
      createdAt: new Date(),
      depth: 1,
    },
  ]),
  moveCategory: vi.fn().mockResolvedValue({ success: true }),
  reorderCategories: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('#/lib/categories', () => ({
  createCategory: vi.fn().mockResolvedValue({
    id: 'cat-3',
    name: 'New',
    slug: 'new',
    description: null,
    parentId: null,
    sortOrder: 0,
    createdAt: new Date(),
  }),
  updateCategory: vi.fn().mockResolvedValue({
    id: 'cat-1',
    name: 'Updated',
    slug: 'updated',
    description: null,
    parentId: null,
  }),
  deleteCategory: vi.fn().mockResolvedValue({ success: true }),
  listCategories: vi.fn().mockResolvedValue([
    {
      id: 'cat-1',
      name: 'Root',
      slug: 'root',
      description: null,
      parentId: null,
      sortOrder: 0,
      createdAt: new Date(),
      children: [
        {
          id: 'cat-2',
          name: 'Child',
          slug: 'child',
          description: null,
          parentId: 'cat-1',
          sortOrder: 0,
          createdAt: new Date(),
          children: [],
        },
      ],
    },
  ]),
}))

import { Route } from './categories'

const AdminCategoriesPage = Route.options.component
if (!AdminCategoriesPage) {
  throw new Error('Route component is not defined')
}

describe('AdminCategoriesPage', () => {
  it('renders the page title', () => {
    render(<AdminCategoriesPage />)
    expect(screen.getByRole('heading', { name: /admin categories title/i })).toBeDefined()
  })

  it('renders category rows', () => {
    render(<AdminCategoriesPage />)
    expect(screen.getByText('Root')).toBeDefined()
    expect(screen.getByText('Child')).toBeDefined()
  })
})
