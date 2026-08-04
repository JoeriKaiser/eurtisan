import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '#/db/index'
import { categories, product, shop } from '#/db/schema'
import { buildCategoryTree, sanitizeSlug } from './categories-tree'
import type { deleteCategorySchema, updateCategorySchema } from '../categories'
import type { SafeUser } from '../server-auth'
import { isPostgresUniqueViolation } from '../db-errors'
import { categoryViewsTotal } from '../metrics.server'
import { withServerCache } from '../server-cache.server'
import { sanitizeRichText, validatePlainText } from '../xss'

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

const CATEGORY_ROOTS_CACHE_KEY = 'cache:categories:roots'
const CATEGORY_TREE_CACHE_KEY = 'cache:categories:tree'
const CATEGORY_CACHE_TTL_MS = 5 * 60_000

export async function listCategoriesQuery() {
  return withServerCache(CATEGORY_ROOTS_CACHE_KEY, CATEGORY_CACHE_TTL_MS, () =>
    db.select().from(categories).where(isNull(categories.parentId)),
  )
}

export async function listCategoryTreeQuery() {
  return withServerCache(CATEGORY_TREE_CACHE_KEY, CATEGORY_CACHE_TTL_MS, async () => {
    const all = await db.select().from(categories)
    return buildCategoryTree(all)
  })
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

    queue = rows.reduce<string[]>((acc, r) => {
      if (!ids.has(r.id)) acc.push(r.id)
      return acc
    }, [])
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

/**
 * Every slug on the path from a category to its root, leaf included. Unit
 * pricing scope is decided against this chain at write time.
 */
export async function getCategoryChainSlugs(categoryId: string | null): Promise<string[]> {
  if (!categoryId) return []
  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, slug, parent_id
      FROM category
      WHERE id = ${categoryId}
      UNION ALL
      SELECT c.id, c.slug, c.parent_id
      FROM category c
      INNER JOIN ancestors a ON c.id = a.parent_id
    )
    SELECT slug FROM ancestors
  `)
  return (result.rows as { slug: string }[]).map((row) => row.slug)
}

/**
 * A category's direct children, each with the number of products a buyer can
 * actually reach beneath it — its own plus every descendant's.
 *
 * One recursive query rather than a count per child: the subcategory grid is on
 * a hot anonymous page, and the number of children is not bounded.
 *
 * `COUNT(s.id)` rather than `COUNT(p.id)`: the shop join carries the visibility
 * predicate, so counting the product side would include products whose shop was
 * filtered out.
 */
export async function getChildCategoriesWithCounts(parentId: string) {
  const result = await db.execute(sql`
    WITH RECURSIVE child_tree AS (
      SELECT id, id AS root_id FROM category WHERE parent_id = ${parentId}
      UNION ALL
      SELECT c.id, ct.root_id
      FROM category c
      INNER JOIN child_tree ct ON c.parent_id = ct.id
    )
    SELECT
      cat.id,
      cat.name,
      cat.slug,
      cat.description,
      cat.parent_id AS "parentId",
      cat.created_at AS "createdAt",
      COUNT(s.id)::int AS "productCount"
    FROM category cat
    LEFT JOIN child_tree ct ON ct.root_id = cat.id
    LEFT JOIN product p
      ON p.category_id = ct.id AND p.status = 'published' AND p.is_active = true
    LEFT JOIN shop s
      ON s.id = p.shop_id AND s.status = 'active' AND s.is_suspended = false
    WHERE cat.parent_id = ${parentId}
    GROUP BY cat.id, cat.name, cat.slug, cat.description, cat.parent_id, cat.created_at
    ORDER BY cat.name
  `)

  return result.rows as {
    id: string
    name: string
    slug: string
    description: string | null
    parentId: string | null
    createdAt: Date | null
    productCount: number
  }[]
}

export async function getCategoryBySlugQuery(slug: string) {
  const [category] = await db.select().from(categories).where(eq(categories.slug, slug))
  if (!category) return null

  // Counted here rather than in the route loader: this is server-only, so a
  // client-side navigation cannot inflate it, and a miss is not a view. The
  // label is the resolved slug from the database, never the raw URL segment,
  // so an unknown slug cannot mint a new series.
  categoryViewsTotal.inc({ category_slug: category.slug })

  const [children, descendantIds] = await Promise.all([
    getChildCategoriesWithCounts(category.id),
    getDescendantCategoryIds(category.id),
  ])

  // Counts only what a buyer can actually reach. Without the publication and
  // shop-visibility filters this counted drafts, deactivated products, and
  // products belonging to suspended shops — so the heading claimed more
  // products than the grid below it could ever show.
  const productCountResult = await db
    .select({ count: count() })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(
      and(
        inArray(product.categoryId, descendantIds),
        eq(product.status, 'published'),
        eq(product.isActive, true),
        eq(shop.status, 'active'),
        eq(shop.isSuspended, false),
      ),
    )

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

  const slug = data.slug ? sanitizeSlug(data.slug) : undefined

  const updateValues: Partial<typeof categories.$inferInsert> = {}
  if (data.name !== undefined) updateValues.name = validatePlainText(data.name, 'Category name')
  if (slug !== undefined) updateValues.slug = slug
  if (data.description !== undefined) updateValues.description = sanitizeRichText(data.description)
  if (data.parentId !== undefined) updateValues.parentId = data.parentId

  try {
    const [updated] = await db
      .update(categories)
      .set(updateValues)
      .where(eq(categories.id, data.id))
      .returning()

    return updated
  } catch (err) {
    if (isPostgresUniqueViolation(err)) {
      throw new Response(
        JSON.stringify({
          error: 'Conflict',
          message: slug
            ? `A category with slug "${slug}" already exists`
            : 'A category with this slug already exists',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
    throw err
  }
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
