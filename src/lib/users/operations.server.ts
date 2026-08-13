import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

import { db } from '#/db/index'
import { user } from '#/db/schema'

import type { PaginatedUsers, SafeUser } from './types'

/* -------------------------------------------------------------------------- */
/*                               User List Query                              */
/* -------------------------------------------------------------------------- */

/**
 * Returns a paginated list of users with optional name/email search.
 * Results are sorted by createdAt descending (newest first).
 */
export async function listUsersQuery(params: {
  query?: string
  page: number
  pageSize: number
}): Promise<PaginatedUsers> {
  const { query, page, pageSize } = params
  const offset = (page - 1) * pageSize

  const searchFilter =
    query && query.trim().length > 0
      ? or(ilike(user.name, `%${query.trim()}%`), ilike(user.email, `%${query.trim()}%`))
      : undefined

  const where = searchFilter ? and(searchFilter) : undefined

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(user).where(where),
  ])

  return {
    users: rows,
    total: Number(totalResult[0]?.count ?? 0),
    page,
    pageSize,
  }
}

/* -------------------------------------------------------------------------- */
/*                             User Detail Query                              */
/* -------------------------------------------------------------------------- */

/**
 * Returns the full profile for a single user by ID, or null if not found.
 */
export async function getUserDetailQuery(userId: string): Promise<SafeUser | null> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return rows[0] ?? null
}
