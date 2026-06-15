import { eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { shop, type user, type userRoleEnum } from '#/db/schema'
import { auth } from './auth'
import { CsrfError, validateCsrf } from './csrf'
import type { SafeUser } from './user-types'

export type UserRole = (typeof userRoleEnum.enumValues)[number]

export interface AuthContext {
  user: typeof user.$inferSelect
  session: {
    id: string
    token: string
    expiresAt: Date
    userId: string
    ipAddress?: string | null
    userAgent?: string | null
    createdAt: Date
    updatedAt: Date
  }
}

export interface SafeAuthContext {
  user: SafeUser
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 0,
  creator: 1,
  admin: 2,
}

export class AuthError extends Error {
  constructor(
    public status: number,
    public body: { error: string; message: string },
  ) {
    super(body.message)
    this.name = 'AuthError'
  }
}

function jsonError(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Catches AuthError instances and converts them to standardized JSON responses.
 * Re-throws all other errors so they can be handled by the framework.
 */
export function withAuthz(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request)
    } catch (err) {
      if (err instanceof AuthError) {
        return jsonError(err.status, err.body.error, err.body.message)
      }
      throw err
    }
  }
}

/**
 * Gate 1: Authentication — verifies the request carries a valid session.
 * Returns an AuthContext with the user and session, or throws AuthError(401).
 */
export async function requireAuth(request: Request): Promise<AuthContext> {
  const result = await auth.api.getSession({ headers: request.headers })
  if (!result) {
    throw new AuthError(401, {
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.',
    })
  }
  if ((result.user as unknown as { bannedAt?: string | null }).bannedAt) {
    throw new AuthError(403, {
      error: 'Forbidden',
      message: 'Account suspended.',
    })
  }
  if ((result.user as unknown as { deletedAt?: string | null }).deletedAt) {
    throw new AuthError(403, {
      error: 'Forbidden',
      message: 'Account deleted.',
    })
  }
  return result as AuthContext
}

/**
 * Gate 2: Role check — verifies the authenticated user meets the minimum role.
 * Returns the context on success, or throws AuthError(403).
 */
export function requireRole(minRole: UserRole) {
  return (ctx: AuthContext): AuthContext => {
    const userLevel = ROLE_HIERARCHY[ctx.user.role as UserRole] ?? -1
    const requiredLevel = ROLE_HIERARCHY[minRole]

    if (userLevel < requiredLevel) {
      throw new AuthError(403, {
        error: 'Forbidden',
        message: `Insufficient role. Required: '${minRole}' or higher.`,
      })
    }
    return ctx
  }
}

/**
 * Gate 3: Ownership check — verifies the authenticated user owns the requested shop.
 * Admin users bypass this check. Returns the context on success,
 * or throws AuthError(403).
 */
export async function requireShopOwnership(ctx: AuthContext, shopId: string): Promise<AuthContext> {
  // Admin bypass — authentication and role checks are still required upstream
  if (ctx.user.role === 'admin') {
    return ctx
  }

  const shopRecord = await db.query.shop.findFirst({
    where: eq(shop.id, shopId),
  })

  if (!shopRecord) {
    throw new AuthError(403, {
      error: 'Forbidden',
      message: 'Shop not found or access denied.',
    })
  }

  if (shopRecord.ownerId !== ctx.user.id) {
    throw new AuthError(403, {
      error: 'Forbidden',
      message: 'You do not have permission to access this shop.',
    })
  }

  return ctx
}

/* -------------------------------------------------------------------------- */
/*                              SafeUser Helpers                              */
/* -------------------------------------------------------------------------- */

/**
 * Role check for the SafeUser shape produced by authMiddleware.
 * Returns the user on success, or throws AuthError(403).
 */
export function requireRoleForUser(minRole: UserRole, user: SafeUser): SafeUser {
  const userLevel = ROLE_HIERARCHY[user.role] ?? -1
  const requiredLevel = ROLE_HIERARCHY[minRole]

  if (userLevel < requiredLevel) {
    throw new AuthError(403, {
      error: 'Forbidden',
      message: `Insufficient role. Required: '${minRole}' or higher.`,
    })
  }
  return user
}

/**
 * Ownership check for the SafeUser shape produced by authMiddleware.
 * Admin users bypass this check. Returns the user on success,
 * or throws AuthError(403).
 */
export async function requireShopOwnershipForUser(
  user: SafeUser,
  shopId: string,
): Promise<SafeUser> {
  if (user.role === 'admin') {
    return user
  }

  const shopRecord = await db.query.shop.findFirst({
    where: eq(shop.id, shopId),
  })

  if (!shopRecord) {
    throw new AuthError(403, {
      error: 'Forbidden',
      message: 'Shop not found or access denied.',
    })
  }

  if (shopRecord.ownerId !== user.id) {
    throw new AuthError(403, {
      error: 'Forbidden',
      message: 'You do not have permission to access this shop.',
    })
  }

  return user
}

/**
 * Composable pipeline that runs authentication gates in sequence.
 * Each gate receives the AuthContext and either returns it or throws AuthError.
 * The final handler receives the fully authorized context.
 */
export async function authPipeline(
  request: Request,
  gates: Array<(ctx: AuthContext) => AuthContext | Promise<AuthContext>>,
  handler: (ctx: AuthContext) => Promise<Response>,
): Promise<Response> {
  try {
    validateCsrf(request)
    let ctx = await requireAuth(request)
    for (const gate of gates) {
      ctx = await gate(ctx)
    }
    return await handler(ctx)
  } catch (err) {
    if (err instanceof CsrfError) {
      return jsonError(403, 'Forbidden', err.message)
    }
    if (err instanceof AuthError) {
      return jsonError(err.status, err.body.error, err.body.message)
    }
    throw err
  }
}
