import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop, user } from '#/db/schema'
import { validatePlainText } from './xss'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface AdminUserListItem {
  id: string
  name: string
  email: string
  role: string
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
  shopCount: number
}

export interface PaginatedUsers {
  users: AdminUserListItem[]
  total: number
  page: number
  pageSize: number
}

/* -------------------------------------------------------------------------- */
/*                              List Users Query                              */
/* -------------------------------------------------------------------------- */

export async function listUsersQuery(params: {
  query?: string
  role?: 'customer' | 'creator' | 'admin'
  status?: 'all' | 'active' | 'banned'
  page: number
  pageSize: number
}): Promise<PaginatedUsers> {
  const { query, role, status, page, pageSize } = params
  const offset = (page - 1) * pageSize

  const conditions = []

  if (query) {
    const pattern = `%${query}%`
    conditions.push(or(ilike(user.name, pattern), ilike(user.email, pattern)))
  }

  if (role) {
    conditions.push(eq(user.role, role))
  }

  if (status === 'active') {
    conditions.push(sql`${user.bannedAt} IS NULL`)
  } else if (status === 'banned') {
    conditions.push(sql`${user.bannedAt} IS NOT NULL`)
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        bannedAt: user.bannedAt,
        banReason: user.banReason,
        createdAt: user.createdAt,
        shopCount: count(shop.id),
      })
      .from(user)
      .leftJoin(shop, eq(shop.ownerId, user.id))
      .where(where)
      .groupBy(user.id)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(user).where(where),
  ])

  return {
    users: rows.map((r) => ({
      ...r,
      shopCount: Number(r.shopCount),
    })),
    total: Number(totalResult[0]?.count ?? 0),
    page,
    pageSize,
  }
}

/* -------------------------------------------------------------------------- */
/*                            Update User Role                                */
/* -------------------------------------------------------------------------- */

export async function updateUserRoleQuery(
  userId: string,
  role: 'customer' | 'creator' | 'admin',
): Promise<{ id: string; role: string }> {
  const [updated] = await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id, role: user.role })

  if (!updated) {
    throw new Error('User not found')
  }

  return updated
}

/* -------------------------------------------------------------------------- */
/*                              Ban / Unban User                              */
/* -------------------------------------------------------------------------- */

export async function banUserQuery(
  userId: string,
  reason?: string,
): Promise<{ id: string; bannedAt: Date | null }> {
  const [updated] = await db
    .update(user)
    .set({
      bannedAt: new Date(),
      banReason: reason ? validatePlainText(reason, 'Ban reason') : null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning({ id: user.id, bannedAt: user.bannedAt })

  if (!updated) {
    throw new Error('User not found')
  }

  return updated
}

export async function unbanUserQuery(
  userId: string,
): Promise<{ id: string; bannedAt: Date | null }> {
  const [updated] = await db
    .update(user)
    .set({
      bannedAt: null,
      banReason: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning({ id: user.id, bannedAt: user.bannedAt })

  if (!updated) {
    throw new Error('User not found')
  }

  return updated
}
