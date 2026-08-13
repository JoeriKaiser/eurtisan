import { getRouteApi, useHydrated } from '@tanstack/react-router'
import { authClient } from './client'
import type { UserRole } from './authz'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 0,
  creator: 1,
  admin: 2,
}

export interface AuthState {
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    role: UserRole
    isAnonymous: boolean
  } | null
  isPending: boolean
  isAuthenticated: boolean
}

function extractRole(user: unknown): UserRole {
  if (typeof user === 'object' && user !== null && 'role' in user) {
    return (user as { role: string }).role as UserRole
  }
  return 'customer'
}

/**
 * Hook that returns the current auth state with role helpers.
 * Uses better-auth's useSession under the hood.
 */
export function useAuth(): AuthState {
  const rootData = getRouteApi('__root__').useLoaderData()
  const rootUser = rootData?.user
    ? ({ ...rootData.user, isAnonymous: rootData.user.isAnonymous === true } as AuthState['user'])
    : null

  const { data: session, isPending } = authClient.useSession()
  const hydrated = useHydrated()

  const activeUser = session?.user
    ? ({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified ?? false,
        image: session.user.image ?? null,
        role: extractRole(session.user),
        isAnonymous:
          typeof session.user === 'object' &&
          session.user !== null &&
          'isAnonymous' in session.user &&
          session.user.isAnonymous === true,
      } as AuthState['user'])
    : null

  // During SSR and initial client hydration render, use rootUser to avoid hydration mismatch.
  const user = hydrated ? activeUser || (session === null ? null : rootUser) : rootUser
  const isAuthPending = isPending && !activeUser && !rootUser

  return {
    user,
    isPending: isAuthPending,
    isAuthenticated: !!user && !user.isAnonymous,
  }
}

/**
 * Check if the current user meets a minimum role requirement.
 * Returns false while auth is pending or user is unauthenticated.
 */
export function useCanAccess(minRole: UserRole): boolean {
  const { user, isPending } = useAuth()
  if (isPending || !user) return false
  const userLevel = ROLE_HIERARCHY[user.role] ?? -1
  const requiredLevel = ROLE_HIERARCHY[minRole]
  return userLevel >= requiredLevel
}

/**
 * Check if the current user has an exact role.
 * Returns false while auth is pending.
 */
export function useHasRole(role: UserRole): boolean {
  const { user, isPending } = useAuth()
  if (isPending || !user) return false
  return user.role === role
}
