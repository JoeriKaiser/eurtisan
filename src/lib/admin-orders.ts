import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './auth-middleware'

export type {
  AdminOrderDetail,
  AdminOrderListItem,
  PaginatedAdminOrders,
} from './admin-orders.server'

/* -------------------------------------------------------------------------- */
/*                               Auth Guard                                   */
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
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listAllPlatformOrdersQuery } = await import('./admin-orders.server')
    return listAllPlatformOrdersQuery(data.query, data.page, data.pageSize)
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
    await requireAdmin(context)

    const { getPlatformOrderDetailQuery } = await import('./admin-orders.server')

    const result = await getPlatformOrderDetailQuery(data.orderId)
    if (!result) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return result
  })
