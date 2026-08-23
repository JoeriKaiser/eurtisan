import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requireAdminResponse } from './authz'
import type { SafeUser } from './server-auth'
import { requirePrivileged2FA } from './server-auth'

export type { AdminCategoryItem } from './admin-categories.server'

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

const moveCategoryInputSchema = z.object({
  categoryId: z.string().uuid(),
  direction: z.enum(['up', 'down']),
})

export const reorderCategoriesInputSchema = z.object({
  orderedIds: z.array(z.string().uuid()).max(500),
})

/* -------------------------------------------------------------------------- */
/*                             Server Functions                               */
/* -------------------------------------------------------------------------- */

export const listCategoriesAdmin = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ listCategoriesAdminQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-categories.server'),
      import('./audit-log.server'),
    ])
    const result = await listCategoriesAdminQuery()

    await emitAdminReadAudit(context.user, 'admin.read.category', 'category', undefined, {
      count: result.length,
    })

    return result
  })

export const moveCategory = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => moveCategoryInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdminResponse(context),
      import('./admin-categories.server'),
      import('./audit-log.server'),
    ])
    requirePrivileged2FA(context.user as SafeUser)
    const { moveCategoryQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const [result] = await Promise.all([
      moveCategoryQuery(data.categoryId, data.direction),
      emitAuditEvent(context.user, 'category.reorder', 'category', data.categoryId, {
        direction: data.direction,
      }),
    ])

    const { invalidateServerCache } = await import('./server-cache.server')
    invalidateServerCache('cache:categories:')
    return result
  })

export const reorderCategories = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => reorderCategoriesInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdminResponse(context),
      import('./admin-categories.server'),
      import('./audit-log.server'),
    ])
    requirePrivileged2FA(context.user as SafeUser)
    const { reorderCategoriesQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const [result] = await Promise.all([
      reorderCategoriesQuery(data.orderedIds),
      emitAuditEvent(context.user, 'category.reorder', 'category', undefined, {
        orderedIds: data.orderedIds,
      }),
    ])

    const { invalidateServerCache } = await import('./server-cache.server')
    invalidateServerCache('cache:categories:')
    return result
  })
