// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authClient } from '#/lib/auth-client'
import UserMenu from './UserMenu'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string }) => (
    <a href={props.to}>{props.children}</a>
  ),
  useRouter: () => ({
    invalidate: vi.fn().mockResolvedValue(undefined),
    navigate: mockNavigate,
  }),
}))

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(),
    signOut: vi.fn(),
  },
}))

const mockUseSession = authClient.useSession as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  })
})

describe('UserMenu', () => {
  it('shows sign in link when unauthenticated', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false })

    const { container } = render(<UserMenu />)
    expect(container.textContent).toContain('Sign in')
  })

  it('shows user name and menu when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          role: 'customer',
        },
      },
      isPending: false,
    })

    const { container } = render(<UserMenu />)
    expect(container.textContent).toContain('Alice')
  })

  it('opens menu and shows account link on click', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          role: 'customer',
        },
      },
      isPending: false,
    })

    render(<UserMenu />)
    const button = screen.getByRole('button', { name: /open user menu/i })
    fireEvent.click(button)

    expect(screen.getByRole('menu')).toBeDefined()
    expect(screen.getByText('Account')).toBeDefined()
  })

  it('shows "Become a Creator" for customers', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          role: 'customer',
        },
      },
      isPending: false,
    })

    render(<UserMenu />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))

    expect(screen.getByText('Become a Creator')).toBeDefined()
  })

  it('shows studio link for creators', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          role: 'creator',
        },
      },
      isPending: false,
    })

    render(<UserMenu />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))

    expect(screen.getByText('My Studio')).toBeDefined()
    expect(screen.queryByText('Become a Creator')).toBeNull()
  })

  it('shows admin link for admins', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          role: 'admin',
        },
      },
      isPending: false,
    })

    render(<UserMenu />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))

    expect(screen.getByText('Admin Dashboard')).toBeDefined()
    expect(screen.getByText('My Studio')).toBeDefined()
  })

  it('navigates to /sell when clicking Become a Creator', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          role: 'customer',
        },
      },
      isPending: false,
    })

    render(<UserMenu />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByText('Become a Creator'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/sell' })
    })
  })
})
