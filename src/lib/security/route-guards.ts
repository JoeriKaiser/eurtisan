import { redirect } from '@tanstack/react-router'
import type { UserRole } from '../authz'
import type { SafeUser } from '../server-auth'
import {
  getCurrentUser,
  requireAuthUser,
  requireRoleUser,
  verifyShopOwnership,
} from '../server-auth'

export interface AuthRouteContext {
  user: SafeUser | null
}

function isAuthError(err: unknown): err is Error {
  return err instanceof Error && (err.message === 'UNAUTHENTICATED' || err.message === 'FORBIDDEN')
}

/**
 * beforeLoad guard: redirects unauthenticated users to /signin.
 * Returns the authenticated user on success.
 * @param redirectTo - optional path to redirect back to after sign-in
 */
export async function guardAuth(redirectTo?: string): Promise<AuthRouteContext> {
  try {
    const user = await requireAuthUser()
    return { user }
  } catch (err) {
    if (isAuthError(err) && err.message === 'UNAUTHENTICATED') {
      throw redirect({
        to: '/signin',
        search: redirectTo ? { redirect: redirectTo } : undefined,
      })
    }
    throw err
  }
}

/**
 * beforeLoad guard: redirects unauthenticated users to /signin
 * and users with insufficient role to /forbidden.
 * Returns the authenticated user on success.
 * @param minRole - minimum required role
 * @param redirectTo - optional path to redirect back to after sign-in
 */
export async function guardRole(minRole: UserRole, redirectTo?: string): Promise<AuthRouteContext> {
  try {
    const user = await requireRoleUser({ data: { minRole } })
    return { user }
  } catch (err) {
    if (isAuthError(err)) {
      if (err.message === 'UNAUTHENTICATED') {
        throw redirect({
          to: '/signin',
          search: redirectTo ? { redirect: redirectTo } : undefined,
        })
      }
      throw redirect({ to: '/forbidden' })
    }
    throw err
  }
}

/**
 * Requires minimum role and two-factor authentication for creator/admin areas.
 */
export async function guardPrivilegedRole(
  minRole: UserRole,
  redirectTo?: string,
): Promise<AuthRouteContext> {
  const ctx = await guardRole(minRole, redirectTo)
  const { user } = ctx
  if (!user) {
    throw redirect({ to: '/signin' })
  }
  const isDevOrTest =
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'development' ||
      process.env.E2E_TEST === 'true' ||
      process.env.VITEST === 'true')
  if (
    (user.role === 'creator' || user.role === 'admin') &&
    !user.twoFactorEnabled &&
    !isDevOrTest
  ) {
    throw redirect({ to: '/account/security' })
  }
  return { user }
}

/**
 * beforeLoad guard for shop ownership routes.
 * Redirects unauthenticated to /signin, unauthorized to /forbidden.
 * Returns the authenticated user on success.
 * @param shopId - shop to verify ownership for
 * @param redirectTo - optional path to redirect back to after sign-in
 */
export async function guardShopOwnership(
  shopId: string,
  redirectTo?: string,
): Promise<AuthRouteContext> {
  try {
    const user = await verifyShopOwnership({ data: { shopId } })
    return { user }
  } catch (err) {
    if (isAuthError(err)) {
      if (err.message === 'UNAUTHENTICATED') {
        throw redirect({
          to: '/signin',
          search: redirectTo ? { redirect: redirectTo } : undefined,
        })
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
