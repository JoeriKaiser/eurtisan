import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { categories } from '#/db/schema'
import { reorderCategoriesInputSchema } from './admin-categories'
import {
  listCategoriesAdminQuery,
  moveCategoryQuery,
  reorderCategoriesQuery,
} from './admin-categories.server'

beforeEach(async () => {
  await db.delete(categories)
})

describe('listCategoriesAdminQuery', () => {
  it('returns flat list with depth', async () => {
    const [root] = await db
      .insert(categories)
      .values({ name: 'Root', slug: 'root', sortOrder: 0 })
      .returning()
    const [child] = await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: root.id, sortOrder: 1 })
      .returning()
    await db
      .insert(categories)
      .values({ name: 'Grandchild', slug: 'grandchild', parentId: child.id, sortOrder: 2 })
      .returning()

    const result = await listCategoriesAdminQuery()
    expect(result).toHaveLength(3)
    expect(result[0].depth).toBe(0)
    expect(result[1].depth).toBe(1)
    expect(result[2].depth).toBe(2)
  })

  it('returns empty array when no categories', async () => {
    const result = await listCategoriesAdminQuery()
    expect(result).toEqual([])
  })
})

describe('moveCategoryQuery', () => {
  it('swaps sort order with sibling above', async () => {
    const [a] = await db
      .insert(categories)
      .values({ name: 'A', slug: 'a', sortOrder: 0 })
      .returning()
    const [b] = await db
      .insert(categories)
      .values({ name: 'B', slug: 'b', sortOrder: 1 })
      .returning()

    await moveCategoryQuery(b.id, 'up')

    const rows = await db.select().from(categories).orderBy(categories.id)
    expect(rows.find((r) => r.id === a.id)?.sortOrder).toBe(1)
    expect(rows.find((r) => r.id === b.id)?.sortOrder).toBe(0)
  })

  it('swaps sort order with sibling below', async () => {
    const [a] = await db
      .insert(categories)
      .values({ name: 'A', slug: 'a', sortOrder: 0 })
      .returning()
    const [b] = await db
      .insert(categories)
      .values({ name: 'B', slug: 'b', sortOrder: 1 })
      .returning()

    await moveCategoryQuery(a.id, 'down')

    const rows = await db.select().from(categories).orderBy(categories.id)
    expect(rows.find((r) => r.id === a.id)?.sortOrder).toBe(1)
    expect(rows.find((r) => r.id === b.id)?.sortOrder).toBe(0)
  })

  it('does nothing when moving first item up', async () => {
    const [a] = await db
      .insert(categories)
      .values({ name: 'A', slug: 'a', sortOrder: 0 })
      .returning()

    const result = await moveCategoryQuery(a.id, 'up')
    expect(result.success).toBe(true)
  })
})

describe('reorderCategoriesQuery', () => {
  it('sets sort order by provided ids', async () => {
    const [a] = await db.insert(categories).values({ name: 'A', slug: 'a' }).returning()
    const [b] = await db.insert(categories).values({ name: 'B', slug: 'b' }).returning()
    const [c] = await db.insert(categories).values({ name: 'C', slug: 'c' }).returning()

    await reorderCategoriesQuery([c.id, a.id, b.id])

    const rows = await db.select().from(categories).orderBy(categories.sortOrder)
    expect(rows[0].id).toBe(c.id)
    expect(rows[1].id).toBe(a.id)
    expect(rows[2].id).toBe(b.id)
  })
})

describe('reorderCategoriesInputSchema', () => {
  it('rejects arrays larger than 500 items', () => {
    const orderedIds = Array.from({ length: 501 }, () => crypto.randomUUID())
    const result = reorderCategoriesInputSchema.safeParse({ orderedIds })
    expect(result.success).toBe(false)
  })

  it('accepts arrays of exactly 500 items', () => {
    const orderedIds = Array.from({ length: 500 }, () => crypto.randomUUID())
    const result = reorderCategoriesInputSchema.safeParse({ orderedIds })
    expect(result.success).toBe(true)
  })
})
