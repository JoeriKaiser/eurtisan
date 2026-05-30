import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'

export type { AdminUserListItem, PaginatedUsers } from './admin-users.server'

/* -------------------------------------------------------------------------- */
/*                                 Auth Guard                                 */
/* -------------------------------------------------------------------------- */

async function requireAdmin(context: { user?: SafeUser | null }) {
  if (!context.user) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }
  if (context.user.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

const listUsersInputSchema = z.object({
  query: z.string().optional(),
  role: z.enum(['customer', 'creator', 'admin']).optional(),
  status: z.enum(['all', 'active', 'banned']).optional().default('all'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

const updateUserRoleInputSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['customer', 'creator', 'admin']),
})

const banUserInputSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().max(2000).optional(),
})

const unbanUserInputSchema = z.object({
  userId: z.string().min(1),
})

/* -------------------------------------------------------------------------- */
/*                             Server Functions                               */
/* -------------------------------------------------------------------------- */

export const listUsers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => listUsersInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listUsersQuery } = await import('./admin-users.server')
    return listUsersQuery(data)
  })

export const updateUserRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => updateUserRoleInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdmin(context),
      import('./admin-users.server'),
      import('./audit-log.server'),
    ])
    const { updateUserRoleQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const [result] = await Promise.all([
      updateUserRoleQuery(data.userId, data.role),
      emitAuditEvent(context.user, 'user.change_role', 'user', data.userId, {
        newRole: data.role,
      }),
    ])

    return result
  })

export const banUser = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => banUserInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdmin(context),
      import('./admin-users.server'),
      import('./audit-log.server'),
    ])
    const { banUserQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const [result] = await Promise.all([
      banUserQuery(data.userId, data.reason),
      emitAuditEvent(context.user, 'user.ban', 'user', data.userId, {
        reason: data.reason,
      }),
    ])

    return result
  })

export const unbanUser = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => unbanUserInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdmin(context),
      import('./admin-users.server'),
      import('./audit-log.server'),
    ])
    const { unbanUserQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const [result] = await Promise.all([
      unbanUserQuery(data.userId),
      emitAuditEvent(context.user, 'user.unban', 'user', data.userId),
    ])

    return result
  })
