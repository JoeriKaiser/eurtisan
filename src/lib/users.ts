import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { authMiddleware } from './auth-middleware'

export type { PaginatedUsers, SafeUser } from './users.server'

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

const listUsersInputSchema = z.object({
  query: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

const getUserDetailInputSchema = z.object({
  userId: z.string().min(1),
})

/* -------------------------------------------------------------------------- */
/*                                 Auth Guard                                 */
/* -------------------------------------------------------------------------- */

/**
 * Shared admin auth guard — throws 401/403 if not authenticated or not admin.
 */
async function requireAdmin(context: { user?: { id: string; role: string } | null }) {
  if (!context.user) {
    throw new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (context.user.role !== 'admin') {
    throw new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Admin access required.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                             Server Functions                               */
/* -------------------------------------------------------------------------- */

/**
 * List users with optional search and pagination.
 * Admin-only: returns 403 for non-admin users.
 */
export const listUsers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => listUsersInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listUsersQuery } = await import('./users.server')
    return listUsersQuery({
      query: data.query,
      page: data.page,
      pageSize: data.pageSize,
    })
  })

/**
 * Get full profile details for a single user by ID.
 * Admin-only: returns 403 for non-admin users.
 */
export const getUserDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => getUserDetailInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { getUserDetailQuery } = await import('./users.server')
    return getUserDetailQuery(data.userId)
  })
