import { redirect } from '@tanstack/react-router'
import type { UserRole } from './authz'
import type { SafeUser } from './server-auth'
import {
  getCurrentUser,
  requireAuthUser,
  requireRoleUser,
  verifyShopOwnership,
} from './server-auth'

export interface AuthRouteContext {
  user: SafeUser | null
}

function isAuthError(err: unknown): err is Error {
  return err instanceof Error && (err.message === 'UNAUTHENTICATED' || err.message === 'FORBIDDEN')
}

/**
 * beforeLoad guard: redirects unauthenticated users to /signin.
 * Returns the authenticated user on success.
 */
export async function guardAuth(): Promise<AuthRouteContext> {
  try {
    const user = await requireAuthUser()
    return { user }
  } catch (err) {
    if (isAuthError(err) && err.message === 'UNAUTHENTICATED') {
      throw redirect({ to: '/signin' })
    }
    throw err
  }
}

/**
 * beforeLoad guard: redirects unauthenticated users to /signin
 * and users with insufficient role to /forbidden.
 * Returns the authenticated user on success.
 */
export async function guardRole(minRole: UserRole): Promise<AuthRouteContext> {
  try {
    const user = await requireRoleUser({ data: { minRole } })
    return { user }
  } catch (err) {
    if (isAuthError(err)) {
      if (err.message === 'UNAUTHENTICATED') {
        throw redirect({ to: '/signin' })
      }
      throw redirect({ to: '/forbidden' })
    }
    throw err
  }
}

/**
 * beforeLoad guard for shop ownership routes.
 * Redirects unauthenticated to /signin, unauthorized to /forbidden.
 * Returns the authenticated user on success.
 */
export async function guardShopOwnership(shopId: string): Promise<AuthRouteContext> {
  try {
    const user = await verifyShopOwnership({ data: { shopId } })
    return { user }
  } catch (err) {
    if (isAuthError(err)) {
      if (err.message === 'UNAUTHENTICATED') {
        throw redirect({ to: '/signin' })
      }
      throw redirect({ to: '/forbidden' })
    }
    throw err
  }
}

/**
 * beforeLoad helper that redirects authenticated users away from public-only routes.
 * e.g. the sign-in page.
 */
export async function guardGuest(): Promise<void> {
  const user = await getCurrentUser()
  if (user) {
    throw redirect({ to: '/' })
  }
}

/**
 * beforeLoad helper that makes auth user available to the route.
 * Does not redirect — safe for mixed-access pages.
 */
export async function guardOptionalAuth(): Promise<AuthRouteContext> {
  const user = await getCurrentUser()
  return { user }
}
