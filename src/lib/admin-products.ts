import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'

export type { AdminProductListItem, PaginatedProducts } from './admin-products.server'

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

const listAllProductsInputSchema = z.object({
  query: z.string().optional(),
  shopId: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  minPriceCents: z.number().int().min(0).optional(),
  maxPriceCents: z.number().int().min(0).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

const toggleProductActiveInputSchema = z.object({
  productId: z.string().min(1),
})

/* -------------------------------------------------------------------------- */
/*                             Server Functions                               */
/* -------------------------------------------------------------------------- */

export const listAllProducts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => listAllProductsInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listAllProductsQuery } = await import('./admin-products.server')
    return listAllProductsQuery(data)
  })

export const toggleProductActive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => toggleProductActiveInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdmin(context),
      import('./admin-products.server'),
      import('./audit-log.server'),
    ])
    const { toggleProductActiveQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const result = await toggleProductActiveQuery(data.productId)

    // Sequential: emitAuditEvent depends on result.isActive.
    await emitAuditEvent(context.user, 'product.toggle_active', 'product', data.productId, {
      isActive: result.isActive,
    })

    return result
  })
