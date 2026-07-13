import { eq, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories } from '#/db/schema'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface AdminCategoryItem {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  sortOrder: number
  createdAt: Date | null
  depth: number
}

/* -------------------------------------------------------------------------- */
/*                         List Categories Admin Query                        */
/* -------------------------------------------------------------------------- */

export async function listCategoriesAdminQuery(): Promise<AdminCategoryItem[]> {
  const rows = await db.select().from(categories).orderBy(categories.sortOrder, categories.name)

  const depthMap = new Map<string, number>()

  function getDepth(id: string): number {
    const cached = depthMap.get(id)
    if (cached !== undefined) return cached
    const row = rows.find((r) => r.id === id)
    if (!row?.parentId) {
      depthMap.set(id, 0)
      return 0
    }
    const d = getDepth(row.parentId) + 1
    depthMap.set(id, d)
    return d
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    parentId: r.parentId,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    depth: getDepth(r.id),
  }))
}

/* -------------------------------------------------------------------------- */
/*                            Reorder Categories                              */
/* -------------------------------------------------------------------------- */

export async function reorderCategoriesQuery(orderedIds: string[]): Promise<{ success: boolean }> {
  if (orderedIds.length === 0) return { success: true }

  await db.transaction(async (tx) => {
    for (const [sortOrder, id] of orderedIds.entries()) {
      await tx.update(categories).set({ sortOrder }).where(eq(categories.id, id))
    }
  })

  return { success: true }
}

/* -------------------------------------------------------------------------- */
/*                             Move Category Up/Down                          */
/* -------------------------------------------------------------------------- */

export async function moveCategoryQuery(
  categoryId: string,
  direction: 'up' | 'down',
): Promise<{ success: boolean }> {
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1)
  if (!cat) throw new Error('Category not found')

  const siblings = await db
    .select()
    .from(categories)
    .where(
      cat.parentId ? eq(categories.parentId, cat.parentId) : sql`${categories.parentId} IS NULL`,
    )
    .orderBy(categories.sortOrder, categories.name)

  const idx = siblings.findIndex((s) => s.id === categoryId)
  if (idx === -1) throw new Error('Category not found in sibling list')

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= siblings.length) return { success: true }

  const other = siblings[swapIdx]
  if (!other) return { success: true }

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ sortOrder: other.sortOrder })
      .where(eq(categories.id, categoryId))
    await tx.update(categories).set({ sortOrder: cat.sortOrder }).where(eq(categories.id, other.id))
  })

  return { success: true }
}
