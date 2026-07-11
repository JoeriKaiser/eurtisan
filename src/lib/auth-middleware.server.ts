import { eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { user as userTable } from '#/db/schema'
import { CsrfError, validateCsrf } from './csrf'
import { toSafeUser, type SafeUser } from './user-types'

export async function loadAuthMiddlewareUser(request: Request): Promise<SafeUser | null> {
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
      user = toSafeUser(result.user)
    }
  }

  if (user?.bannedAt) {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Account suspended.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return user
}
