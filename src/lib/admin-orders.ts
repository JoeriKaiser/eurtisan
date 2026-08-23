import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requireAdminSignInResponse } from './authz'
import type { SafeUser } from './server-auth'
import { requirePrivileged2FA } from './server-auth'

export type {
  AdminOrderDetail,
  AdminOrderListItem,
  PaginatedAdminOrders,
} from './admin-orders.server'

/* -------------------------------------------------------------------------- */
/*                           List All Platform Orders                         */
/* -------------------------------------------------------------------------- */

/**
 * Returns a paginated, searchable list of all platform orders.
 * Admin-only — requires authentication and admin role.
 */
export const listAllPlatformOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      query: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      from: z
        .string()
        .datetime()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      to: z
        .string()
        .datetime()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      statuses: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ listAllPlatformOrdersQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-orders.server'),
      import('./audit-log.server'),
    ])
    const result = await listAllPlatformOrdersQuery(
      data.query,
      data.page,
      data.pageSize,
      data.from,
      data.to,
      data.statuses,
    )

    await emitAdminReadAudit(context.user, 'admin.read.order', 'order', undefined, {
      query: data.query,
      statuses: data.statuses,
      from: data.from?.toISOString(),
      to: data.to?.toISOString(),
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })

    return result
  })

/* -------------------------------------------------------------------------- */
/*                         Get Platform Order Detail                          */
/* -------------------------------------------------------------------------- */

/**
 * Returns the full order tree for a given platform order.
 * Admin-only — requires authentication and admin role.
 */
export const getPlatformOrderDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const [{ getPlatformOrderDetailQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-orders.server'),
      import('./audit-log.server'),
    ])
    const [, result] = await Promise.all([
      requireAdminSignInResponse(context),
      getPlatformOrderDetailQuery(data.orderId),
    ])
    requirePrivileged2FA(context.user as SafeUser)
    if (!result) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await emitAdminReadAudit(context.user, 'admin.read.order', 'order', data.orderId)

    return result
  })
