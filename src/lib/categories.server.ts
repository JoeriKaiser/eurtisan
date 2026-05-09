import { count, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '#/db/index'
import { categories, product } from '#/db/schema'
import type { deleteCategorySchema, updateCategorySchema } from './categories'
import { buildCategoryTree } from './categories'
import type { SafeUser } from './server-auth'

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

export async function listCategoriesQuery() {
  return db.select().from(categories).where(isNull(categories.parentId))
}

export async function listCategoryTreeQuery() {
  const all = await db.select().from(categories)
  return buildCategoryTree(all)
}

export async function listCategoriesWithCountsQuery() {
  const result = await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id, id AS root_id
      FROM category
      WHERE parent_id IS NULL
      UNION ALL
      SELECT c.id, d.root_id
      FROM category c
      INNER JOIN descendants d ON c.parent_id = d.id
    )
    SELECT
      cat.id,
      cat.name,
      cat.slug,
      cat.description,
      cat.parent_id AS "parentId",
      cat.created_at AS "createdAt",
      COUNT(p.id)::int AS "productCount"
    FROM category cat
    LEFT JOIN descendants d ON cat.id = d.root_id
    LEFT JOIN product p ON p.category_id = d.id
    WHERE cat.parent_id IS NULL
    GROUP BY cat.id, cat.name, cat.slug, cat.description, cat.parent_id, cat.created_at
    ORDER BY cat.name
  `)

  return result.rows as {
    id: string
    name: string
    slug: string
    description: string | null
    parentId: null
    createdAt: Date | null
    productCount: number
  }[]
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

export async function getCategoryBySlugQuery(slug: string) {
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

  const { sanitizeSlug } = await import('./categories')
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
  if (data.description !== undefined) updateValues.description = data.description?.trim() ?? null
  if (data.parentId !== undefined) updateValues.parentId = data.parentId

  const [updated] = await db
    .update(categories)
    .set(updateValues)
    .where(eq(categories.id, data.id))
    .returning()

  return updated
}

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
