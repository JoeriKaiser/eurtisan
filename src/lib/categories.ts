import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'
import { sanitizeRichText, validatePlainText } from './xss'
import { buildCategoryTree, sanitizeSlug, type CategoryTreeNode } from './category-tree'

export { buildCategoryTree, sanitizeSlug, type CategoryTreeNode }

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  parentId: z.string().uuid().optional(),
})

export const createCategory = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(createCategorySchema)
  .handler(async ({ context, data }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw new Error('Unauthorized: admin access required')
    }
    requirePrivileged2FA(context.user as SafeUser)

    const slug = data.slug ? sanitizeSlug(data.slug) : sanitizeSlug(data.name)

    if (!slug || slug.length === 0) {
      throw new Error('Invalid slug: could not generate a valid slug from the provided name')
    }

    const [{ db }, { categories }, { eq }] = await Promise.all([
      import('#/db/index'),
      import('#/db/schema'),
      import('drizzle-orm'),
    ])

    const existingPromise = db.select().from(categories).where(eq(categories.slug, slug))
    const parentPromise = data.parentId
      ? db.select().from(categories).where(eq(categories.id, data.parentId))
      : Promise.resolve([])
    const [existing, parentRows] = await Promise.all([existingPromise, parentPromise])

    if (existing.length > 0) {
      throw new Error(`A category with slug "${slug}" already exists`)
    }

    if (data.parentId) {
      const [parent] = parentRows
      if (!parent) {
        throw new Response(JSON.stringify({ error: 'Parent category not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const [[category], { emitAuditEvent }] = await Promise.all([
      db
        .insert(categories)
        .values({
          name: validatePlainText(data.name, 'Category name'),
          slug,
          description: sanitizeRichText(data.description),
          parentId: data.parentId ?? null,
        })
        .returning(),
      import('./audit-log.server'),
    ])

    const { invalidateServerCache } = await import('./server-cache.server')
    invalidateServerCache('cache:categories:')

    await emitAuditEvent(context.user, 'category.create', 'category', category.id, {
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
    })

    return category
  })

export const listCategories = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ tree: z.boolean().optional() }).optional().default({}))
  .handler(async ({ data }) => {
    const { listCategoriesQuery, listCategoryTreeQuery } = await import('./categories.server')
    if (data?.tree) {
      return listCategoryTreeQuery()
    }
    return listCategoriesQuery()
  })

export const listCategoriesWithCounts = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { listCategoriesWithCountsQuery } = await import('./categories.server')
  return listCategoriesWithCountsQuery()
})

export type CategoryWithDetails = {
  id: string
  name: string
  slug: string
  parentId: string | null
  createdAt: Date | null
  children: {
    id: string
    name: string
    slug: string
    parentId: string | null
    createdAt: Date | null
  }[]
  productCount: number
  breadcrumbs: { id: string; name: string; slug: string }[]
}

export const getCategoryBySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { getCategoryBySlugQuery } = await import('./categories.server')
    return getCategoryBySlugQuery(data.slug)
  })

export const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
})

export const updateCategory = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(updateCategorySchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    requirePrivileged2FA(context.user as SafeUser)
    // False positive from analyzer: the next await uses functions destructured from this Promise.all.
    const [{ updateCategoryInternal }, { emitAuditEvent }] = await Promise.all([
      import('./categories.server'),
      import('./audit-log.server'),
    ])
    // False positive from analyzer: this call uses updateCategoryInternal imported above.
    const result = await updateCategoryInternal(context.user, data)

    // Sequential: emitAuditEvent depends on result fields (name, slug, parentId).
    const { invalidateServerCache } = await import('./server-cache.server')
    invalidateServerCache('cache:categories:')

    await emitAuditEvent(context.user, 'category.update', 'category', data.id, {
      name: result.name,
      slug: result.slug,
      parentId: result.parentId,
    })

    return result
  })

export const deleteCategorySchema = z.object({
  id: z.string().uuid(),
})

export const deleteCategory = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(deleteCategorySchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    requirePrivileged2FA(context.user as SafeUser)
    const [{ deleteCategoryInternal }, { emitAuditEvent }] = await Promise.all([
      import('./categories.server'),
      import('./audit-log.server'),
    ])
    // False positive from analyzer: these calls use functions imported in the preceding Promise.all.
    const [result] = await Promise.all([
      deleteCategoryInternal(context.user, data),
      emitAuditEvent(context.user, 'category.delete', 'category', data.id),
    ])
    const { invalidateServerCache } = await import('./server-cache.server')
    invalidateServerCache('cache:categories:')

    return result
  })
