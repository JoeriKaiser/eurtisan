import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'

export type { AdminCategoryItem } from './admin-categories.server'

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

const moveCategoryInputSchema = z.object({
  categoryId: z.string().uuid(),
  direction: z.enum(['up', 'down']),
})

const reorderCategoriesInputSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
})

/* -------------------------------------------------------------------------- */
/*                             Server Functions                               */
/* -------------------------------------------------------------------------- */

export const listCategoriesAdmin = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context)

    const { listCategoriesAdminQuery } = await import('./admin-categories.server')
    return listCategoriesAdminQuery()
  })

export const moveCategory = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => moveCategoryInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { moveCategoryQuery } = await import('./admin-categories.server')
    const result = await moveCategoryQuery(data.categoryId, data.direction)

    const { emitAuditEvent } = await import('./audit-log.server')
    await emitAuditEvent(context.user, 'category.reorder', 'category', data.categoryId, {
      direction: data.direction,
    })

    return result
  })

export const reorderCategories = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => reorderCategoriesInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { reorderCategoriesQuery } = await import('./admin-categories.server')
    const result = await reorderCategoriesQuery(data.orderedIds)

    const { emitAuditEvent } = await import('./audit-log.server')
    await emitAuditEvent(context.user, 'category.reorder', 'category', undefined, {
      orderedIds: data.orderedIds,
    })

    return result
  })
