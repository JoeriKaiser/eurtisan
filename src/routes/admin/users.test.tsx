// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => ({
    users: [
      {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'customer',
        bannedAt: null,
        banReason: null,
        createdAt: new Date(),
        shopCount: 0,
      },
      {
        id: 'user-2',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'admin',
        bannedAt: new Date(),
        banReason: 'Spam',
        createdAt: new Date(),
        shopCount: 2,
      },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  }),
  useNavigate: () => mockNavigate,
  useSearch: () => ({
    query: '',
    role: undefined,
    status: 'all',
    page: 1,
    pageSize: 20,
  }),
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ navigate: mockNavigate }),
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

vi.mock('#/lib/admin-users', () => ({
  listUsers: vi.fn().mockResolvedValue({
    users: [
      {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'customer',
        bannedAt: null,
        banReason: null,
        createdAt: new Date(),
        shopCount: 0,
      },
      {
        id: 'user-2',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'admin',
        bannedAt: new Date(),
        banReason: 'Spam',
        createdAt: new Date(),
        shopCount: 2,
      },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  }),
  updateUserRole: vi.fn().mockResolvedValue({ id: 'user-1', role: 'creator' }),
  banUser: vi.fn().mockResolvedValue({ id: 'user-1', bannedAt: new Date() }),
  unbanUser: vi.fn().mockResolvedValue({ id: 'user-2', bannedAt: null }),
}))

import { AdminUsersPage } from '#/route-components/admin/users'

describe('AdminUsersPage', () => {
  it('renders the page title', () => {
    render(<AdminUsersPage />)
    expect(screen.getByRole('heading', { name: /admin users title/i })).toBeDefined()
  })

  it('renders user data', () => {
    render(<AdminUsersPage />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('alice@example.com')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('bob@example.com')).toBeDefined()
  })
})
