import { createServerFn } from '@tanstack/react-start'
import { count, eq, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/index'
import { categories, product } from '#/db/schema'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().optional(),
})

export type CategoryTreeNode = typeof categories.$inferSelect & {
  children: CategoryTreeNode[]
}

export function buildCategoryTree(
  flatCategories: (typeof categories.$inferSelect)[],
): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>()

  for (const cat of flatCategories) {
    map.set(cat.id, { ...cat, children: [] })
  }

  const roots: CategoryTreeNode[] = []
  for (const cat of flatCategories) {
    const node = map.get(cat.id)
    if (!node) continue
    if (cat.parentId) {
      const parent = map.get(cat.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  return roots
}

export async function detectCircularReference(
  categoryId: string | null,
  parentId: string,
): Promise<boolean> {
  let currentId: string | null = parentId
  while (currentId) {
    if (currentId === categoryId) return true
    const [parent] = await db
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, currentId))
    if (!parent) break
    currentId = parent.parentId
  }
  return false
}

export const createCategory = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(createCategorySchema)
  .handler(async ({ context, data }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw new Error('Unauthorized: admin access required')
    }

    const slug = data.slug ? sanitizeSlug(data.slug) : sanitizeSlug(data.name)

    if (!slug || slug.length === 0) {
      throw new Error('Invalid slug: could not generate a valid slug from the provided name')
    }

    const existing = await db.select().from(categories).where(eq(categories.slug, slug))

    if (existing.length > 0) {
      throw new Error(`A category with slug "${slug}" already exists`)
    }

    if (data.parentId) {
      const [parent] = await db.select().from(categories).where(eq(categories.id, data.parentId))
      if (!parent) {
        throw new Response(JSON.stringify({ error: 'Parent category not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const [category] = await db
      .insert(categories)
      .values({
        name: data.name.trim(),
        slug,
        parentId: data.parentId ?? null,
      })
      .returning()

    return category
  })

export async function listCategoriesQuery() {
  return db.select().from(categories).where(isNull(categories.parentId))
}

export async function listCategoryTreeQuery(): Promise<CategoryTreeNode[]> {
  const all = await db.select().from(categories)
  return buildCategoryTree(all)
}

export const listCategories = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ tree: z.boolean().optional() }).optional().default({}))
  .handler(async ({ data }) => {
    if (data.tree) {
      return listCategoryTreeQuery()
    }
    return listCategoriesQuery()
  })

export type CategoryWithDetails = typeof categories.$inferSelect & {
  children: (typeof categories.$inferSelect)[]
  productCount: number
  breadcrumbs: { id: string; name: string; slug: string }[]
}

export async function getDescendantCategoryIds(categoryId: string): Promise<string[]> {
  const ids = new Set<string>([categoryId])
  let queue = [categoryId]

  while (queue.length > 0) {
    const rows = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.parentId, queue))

    queue = rows.map((r) => r.id).filter((id) => !ids.has(id))
    for (const id of queue) ids.add(id)
  }

  return Array.from(ids)
}

export async function getCategoryBreadcrumbs(
  categoryId: string,
): Promise<{ id: string; name: string; slug: string }[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, slug, parent_id
      FROM category
      WHERE id = ${categoryId}
      UNION ALL
      SELECT c.id, c.name, c.slug, c.parent_id
      FROM category c
      INNER JOIN ancestors a ON c.id = a.parent_id
    )
    SELECT id, name, slug FROM ancestors WHERE id != ${categoryId}
  `)

  const rows = result.rows as { id: string; name: string; slug: string }[]
  return rows.reverse()
}

export async function getCategoryBySlugQuery(slug: string): Promise<CategoryWithDetails | null> {
  const [category] = await db.select().from(categories).where(eq(categories.slug, slug))
  if (!category) return null

  const children = await db.select().from(categories).where(eq(categories.parentId, category.id))

  const descendantIds = await getDescendantCategoryIds(category.id)
  const productCountResult = await db
    .select({ count: count() })
    .from(product)
    .where(inArray(product.categoryId, descendantIds))

  const productCount = productCountResult[0]?.count ?? 0
  const breadcrumbs = await getCategoryBreadcrumbs(category.id)

  return { ...category, children, productCount, breadcrumbs }
}

export const getCategoryBySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    return getCategoryBySlugQuery(data.slug)
  })

export const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().optional().nullable(),
})

export async function updateCategoryInternal(
  user: SafeUser | null,
  data: z.infer<typeof updateCategorySchema>,
) {
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: admin access required')
  }

  const [existing] = await db.select().from(categories).where(eq(categories.id, data.id))

  if (!existing) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Category not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (data.parentId !== undefined && data.parentId !== null) {
    if (await detectCircularReference(data.id, data.parentId)) {
      throw new Response(JSON.stringify({ error: 'Circular parent reference detected' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const slug = data.slug ? sanitizeSlug(data.slug) : undefined

  if (slug !== undefined) {
    const slugExists = await db.select().from(categories).where(eq(categories.slug, slug))
    if (slugExists.some((c) => c.id !== data.id)) {
      throw new Response(
        JSON.stringify({
          error: 'Conflict',
          message: `A category with slug "${slug}" already exists`,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const updateValues: Partial<typeof categories.$inferInsert> = {}
  if (data.name !== undefined) updateValues.name = data.name.trim()
  if (slug !== undefined) updateValues.slug = slug
  if (data.parentId !== undefined) updateValues.parentId = data.parentId

  const [updated] = await db
    .update(categories)
    .set(updateValues)
    .where(eq(categories.id, data.id))
    .returning()

  return updated
}

export const updateCategory = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(updateCategorySchema)
  .handler(async ({ context, data }) => {
    return updateCategoryInternal(context.user, data)
  })

export const deleteCategorySchema = z.object({
  id: z.string().uuid(),
})

export async function deleteCategoryInternal(
  user: SafeUser | null,
  data: z.infer<typeof deleteCategorySchema>,
) {
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: admin access required')
  }

  const [existing] = await db.select().from(categories).where(eq(categories.id, data.id))

  if (!existing) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Category not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const descendantIds = await getDescendantCategoryIds(data.id)
  const productCountResult = await db
    .select({ count: count() })
    .from(product)
    .where(inArray(product.categoryId, descendantIds))

  const productCount = productCountResult[0]?.count ?? 0

  if (productCount > 0) {
    throw new Response(
      JSON.stringify({
        error: 'Conflict',
        message: `Cannot delete category: ${productCount} product(s) reference this category or its descendants. Reassign or remove the products first.`,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  await db.delete(categories).where(eq(categories.id, data.id))

  return { success: true, id: data.id }
}

export const deleteCategory = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(deleteCategorySchema)
  .handler(async ({ context, data }) => {
    return deleteCategoryInternal(context.user, data)
  })
