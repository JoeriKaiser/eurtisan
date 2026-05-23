import { getRouteApi } from '@tanstack/react-router'
import { authClient } from './auth-client'
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
  const rootUser = rootData?.user ?? null

  const { data: session, isPending } = authClient.useSession()

  const activeUser = session?.user
    ? ({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified ?? false,
        image: session.user.image ?? null,
        role: extractRole(session.user),
      } as AuthState['user'])
    : null

  const user = activeUser || (session === null ? null : rootUser)
  const isAuthPending = isPending && !activeUser && !rootUser

  return {
    user,
    isPending: isAuthPending,
    isAuthenticated: !!user,
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
