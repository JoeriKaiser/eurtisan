import { describe, expect, it, vi } from 'vitest'

import { authClient } from './auth-client'
import { useAuth, useCanAccess, useHasRole } from './auth-hooks'

vi.mock('./auth-client', () => ({
  authClient: {
    useSession: vi.fn(),
  },
}))

const mockUseSession = authClient.useSession as unknown as ReturnType<typeof vi.fn>

function makeSessionUser(role: string, overrides?: Partial<{ name: string; email: string }>) {
  return {
    id: 'user-1',
    name: overrides?.name ?? 'Test User',
    email: overrides?.email ?? 'test@example.com',
    emailVerified: true,
    image: null,
    role,
  }
}

describe('useAuth', () => {
  it('returns isPending while loading', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true })

    const state = useAuth()
    expect(state.isPending).toBe(true)
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('returns user when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: { user: makeSessionUser('customer') },
      isPending: false,
    })

    const state = useAuth()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user?.role).toBe('customer')
    expect(state.user?.name).toBe('Test User')
  })

  it('returns null when unauthenticated', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false })

    const state = useAuth()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })
})

describe('useCanAccess', () => {
  it('returns false while loading', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true })
    expect(useCanAccess('creator')).toBe(false)
  })

  it('returns false for unauthenticated user', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false })
    expect(useCanAccess('creator')).toBe(false)
  })

  it('returns false when user role is insufficient', () => {
    mockUseSession.mockReturnValue({
      data: { user: makeSessionUser('customer') },
      isPending: false,
    })
    expect(useCanAccess('creator')).toBe(false)
    expect(useCanAccess('admin')).toBe(false)
  })

  it('returns true when user role meets minimum', () => {
    mockUseSession.mockReturnValue({
      data: { user: makeSessionUser('creator') },
      isPending: false,
    })
    expect(useCanAccess('creator')).toBe(true)
    expect(useCanAccess('customer')).toBe(true)
  })

  it('returns true when user role exceeds minimum', () => {
    mockUseSession.mockReturnValue({
      data: { user: makeSessionUser('admin') },
      isPending: false,
    })
    expect(useCanAccess('creator')).toBe(true)
    expect(useCanAccess('admin')).toBe(true)
  })
})

describe('useHasRole', () => {
  it('returns false while loading', () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true })
    expect(useHasRole('admin')).toBe(false)
  })

  it('returns true for exact role match', () => {
    mockUseSession.mockReturnValue({
      data: { user: makeSessionUser('creator') },
      isPending: false,
    })
    expect(useHasRole('creator')).toBe(true)
    expect(useHasRole('admin')).toBe(false)
  })
})
