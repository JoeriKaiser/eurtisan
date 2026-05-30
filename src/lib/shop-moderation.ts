import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { authMiddleware } from './auth-middleware'

export type {
  ModerateAction,
  ModerateShopResult,
  PaginatedShops,
  ShopListItem,
  SuspensionFilter,
} from './shop-moderation.server'

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

const listAllShopsInputSchema = z.object({
  filter: z.enum(['suspended', 'active', 'all']).default('all'),
  query: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'status']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(1000).default(20),
})

const moderateShopInputSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required.'),
  action: z.enum(['suspend', 'unsuspend'], {
    errorMap: () => ({ message: "Action must be 'suspend' or 'unsuspend'." }),
  }),
  note: z.string().max(2000).optional(),
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
 * Lists all shops with owner details, suspension status, and moderation notes.
 * Supports filtering by suspension status (suspended, active, all) and pagination.
 *
 * - Admin-only: returns 403 for non-admin users.
 */
export const listAllShops = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => listAllShopsInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listAllShopsQuery } = await import('./shop-moderation.server')
    return listAllShopsQuery({
      filter: data.filter,
      query: data.query,
      sortBy: data.sortBy,
      sortDir: data.sortDir,
      page: data.page,
      pageSize: data.pageSize,
    })
  })

/**
 * Suspends or unsuspends a shop, optionally recording a moderation note.
 *
 * - Admin-only: returns 403 for non-admin users.
 * - Idempotent: suspending an already-suspended shop succeeds without error.
 * - Invalid shop IDs return a clear error message.
 *
 * @returns The updated shop suspension status and moderation note.
 */
export const moderateShop = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => moderateShopInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdmin(context),
      import('./shop-moderation.server'),
      import('./audit-log.server'),
    ])
    const { moderateShopQuery } = modules[1]
    const { emitAuditEvent } = modules[2]

    try {
      const [result] = await Promise.all([
        moderateShopQuery(data.shopId, data.action, data.note),
        emitAuditEvent(context.user, `shop.${data.action}`, 'shop', data.shopId, {
          note: data.note,
        }),
      ])

      return result
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Shop not found:')) {
        throw new Response(
          JSON.stringify({
            error: 'Not Found',
            message: err.message,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw err
    }
  })
