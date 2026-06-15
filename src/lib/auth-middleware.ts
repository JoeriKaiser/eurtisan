import { createMiddleware } from '@tanstack/react-start'

import { db } from '#/db/index'
import { user as userTable } from '#/db/schema'
import { eq } from 'drizzle-orm'

import type { UserRole } from './authz'
import { CsrfError, validateCsrf } from './csrf'
import type { SafeUser } from './user-types'

export interface AuthMiddlewareContext {
  user: SafeUser | null
}

export const authMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    try {
      validateCsrf(request)
    } catch (err) {
      if (err instanceof CsrfError) {
        throw new Response(JSON.stringify({ error: 'Forbidden', message: err.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }

    const { auth } = await import('./auth')
    const result = await auth.api.getSession({ headers: request.headers })

    let user: SafeUser | null = null

    if (result) {
      const deletedAt = await db
        .select({ deletedAt: userTable.deletedAt })
        .from(userTable)
        .where(eq(userTable.id, result.user.id))
        .then((rows) => rows[0]?.deletedAt ?? null)

      if (!deletedAt) {
        user = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
          image: result.user.image ?? null,
          role: (result.user as unknown as { role: string }).role as UserRole,
          bannedAt: (result.user as unknown as { bannedAt: string | null }).bannedAt
            ? new Date((result.user as unknown as { bannedAt: string | null }).bannedAt as string)
            : null,
          deletedAt: null,
          twoFactorEnabled: Boolean(
            (result.user as unknown as { twoFactorEnabled?: boolean }).twoFactorEnabled,
          ),
        }
      }
    }

    if (user?.bannedAt) {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Account suspended.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return next({ context: { user } satisfies AuthMiddlewareContext })
  },
)
