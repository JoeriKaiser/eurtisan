import { count, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import {
  categories,
  product,
  shop,
  user,
  orderItem,
  shopOrder,
  platformOrder,
  review,
  dispute,
  payout,
  cartItem,
  cart,
  inventoryReservation,
} from '#/db/schema'
import {
  buildCategoryTree,
  createCategorySchema,
  deleteCategorySchema,
  sanitizeSlug,
  updateCategorySchema,
} from './categories'
import {
  deleteCategoryInternal,
  detectCircularReference,
  getCategoryBreadcrumbs,
  getCategoryBySlugQuery,
  getDescendantCategoryIds,
  listCategoriesQuery,
  listCategoriesWithCountsQuery,
  listCategoryTreeQuery,
  updateCategoryInternal,
} from './categories.server'
import { clearServerCacheForTests } from './server-cache.server'
import type { SafeUser } from './server-auth'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  clearServerCacheForTests()
  await db.delete(dispute)
  await db.delete(payout)
  await db.delete(review)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(inventoryReservation)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(product)
  await db.delete(categories)
  await db.delete(shop)
  await db.delete(user)
})

describe('sanitizeSlug', () => {
  it('lowercases input', () => {
    expect(sanitizeSlug('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(sanitizeSlug('foo bar baz')).toBe('foo-bar-baz')
  })

  it('removes special characters', () => {
    expect(sanitizeSlug('Café & Books!')).toBe('caf-books')
  })

  it('trims whitespace', () => {
    expect(sanitizeSlug('  hello  ')).toBe('hello')
  })

  it('collapses multiple hyphens', () => {
    expect(sanitizeSlug('hello---world')).toBe('hello-world')
  })

  it('handles empty string', () => {
    expect(sanitizeSlug('')).toBe('')
  })

  it('handles string that becomes empty after sanitization', () => {
    expect(sanitizeSlug('!!!')).toBe('')
  })
})

describe('createCategorySchema', () => {
  it('accepts valid input with name only', () => {
    const result = createCategorySchema.safeParse({ name: 'Books' })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with all fields', () => {
    const result = createCategorySchema.safeParse({
      name: 'Books',
      slug: 'books',
      description: 'All kinds of books',
      parentId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects description exceeding 1000 chars', () => {
    const result = createCategorySchema.safeParse({
      name: 'Books',
      description: 'a'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = createCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 255 chars', () => {
    const result = createCategorySchema.safeParse({ name: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid parentId', () => {
    const result = createCategorySchema.safeParse({ name: 'Books', parentId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('updateCategorySchema', () => {
  it('accepts valid input with id only', () => {
    const result = updateCategorySchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with all fields', () => {
    const result = updateCategorySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated Books',
      slug: 'updated-books',
      description: 'Updated description',
      parentId: '660e8400-e29b-41d4-a716-446655440001',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null description', () => {
    const result = updateCategorySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      description: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts null parentId', () => {
    const result = updateCategorySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      parentId: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid id', () => {
    const result = updateCategorySchema.safeParse({ id: 'not-a-uuid', name: 'Books' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = updateCategorySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid parentId', () => {
    const result = updateCategorySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      parentId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

describe('deleteCategorySchema', () => {
  it('accepts valid id', () => {
    const result = deleteCategorySchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid id', () => {
    const result = deleteCategorySchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing id', () => {
    const result = deleteCategorySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('buildCategoryTree', () => {
  it('builds a tree from flat categories', () => {
    const flat = [
      { id: '1', name: 'Root', slug: 'root', parentId: null, createdAt: null },
      { id: '2', name: 'Child', slug: 'child', parentId: '1', createdAt: null },
      { id: '3', name: 'Grandchild', slug: 'grandchild', parentId: '2', createdAt: null },
    ] as (typeof categories.$inferSelect)[]

    const tree = buildCategoryTree(flat)

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('1')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].id).toBe('2')
    expect(tree[0].children[0].children).toHaveLength(1)
    expect(tree[0].children[0].children[0].id).toBe('3')
  })

  it('handles multiple roots', () => {
    const flat = [
      { id: '1', name: 'Root A', slug: 'root-a', parentId: null, createdAt: null },
      { id: '2', name: 'Root B', slug: 'root-b', parentId: null, createdAt: null },
    ] as (typeof categories.$inferSelect)[]

    const tree = buildCategoryTree(flat)

    expect(tree).toHaveLength(2)
    expect(tree[0].id).toBe('1')
    expect(tree[1].id).toBe('2')
  })

  it('returns empty array for empty input', () => {
    expect(buildCategoryTree([])).toEqual([])
  })

  it('ignores orphaned children when parent is missing', () => {
    const flat = [
      { id: '1', name: 'Root', slug: 'root', parentId: null, createdAt: null },
      { id: '2', name: 'Orphan', slug: 'orphan', parentId: '999', createdAt: null },
    ] as (typeof categories.$inferSelect)[]

    const tree = buildCategoryTree(flat)

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('1')
  })
})

describe('listCategories', () => {
  it('returns only root categories', async () => {
    const [root1] = await db
      .insert(categories)
      .values({ name: 'Root 1', slug: 'root-1' })
      .returning()
    const [_root2] = await db
      .insert(categories)
      .values({ name: 'Root 2', slug: 'root-2' })
      .returning()
    await db.insert(categories).values({ name: 'Child 1', slug: 'child-1', parentId: root1.id })

    const result = await listCategoriesQuery()

    expect(result).toHaveLength(2)
    expect(result.map((c) => c.slug)).toContain('root-1')
    expect(result.map((c) => c.slug)).toContain('root-2')
    expect(result.map((c) => c.slug)).not.toContain('child-1')
  })

  it('returns empty array when no root categories exist', async () => {
    const result = await listCategoriesQuery()
    expect(result).toEqual([])
  })
})

describe('listCategoryTreeQuery', () => {
  it('returns a tree of categories', async () => {
    const [root] = await db.insert(categories).values({ name: 'Root', slug: 'root' }).returning()
    const [child] = await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: root.id })
      .returning()
    await db
      .insert(categories)
      .values({ name: 'Grandchild', slug: 'grandchild', parentId: child.id })
      .returning()

    const tree = await listCategoryTreeQuery()

    expect(tree).toHaveLength(1)
    expect(tree[0].slug).toBe('root')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].slug).toBe('child')
    expect(tree[0].children[0].children).toHaveLength(1)
    expect(tree[0].children[0].children[0].slug).toBe('grandchild')
  })

  it('returns empty array when no categories exist', async () => {
    const tree = await listCategoryTreeQuery()
    expect(tree).toEqual([])
  })
})

describe('listCategoriesWithCountsQuery', () => {
  it('returns root categories with product counts', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [root] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    const [child] = await db
      .insert(categories)
      .values({ name: 'Vases', slug: 'vases', parentId: root.id })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: root.id,
    })

    await db.insert(product).values({
      id: 'prod-2',
      name: 'Tall Vase',
      slug: 'tall-vase',
      priceCents: 3999,
      shopId: s.id,
      categoryId: child.id,
    })

    const result = await listCategoriesWithCountsQuery()

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('pottery')
    expect(result[0].productCount).toBe(2)
  })

  it('returns description when present', async () => {
    await db
      .insert(categories)
      .values({ name: 'Books', slug: 'books', description: 'All kinds of books' })
      .returning()

    const result = await listCategoriesWithCountsQuery()

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('books')
    expect(result[0].description).toBe('All kinds of books')
  })

  it('returns zero product count when no products exist', async () => {
    const [root] = await db.insert(categories).values({ name: 'Books', slug: 'books' }).returning()

    await db
      .insert(categories)
      .values({ name: 'Fiction', slug: 'fiction', parentId: root.id })
      .returning()

    const result = await listCategoriesWithCountsQuery()

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('books')
    expect(result[0].productCount).toBe(0)
  })

  it('returns empty array when no categories exist', async () => {
    const result = await listCategoriesWithCountsQuery()
    expect(result).toEqual([])
  })

  it('excludes child categories from top-level list', async () => {
    const [root] = await db.insert(categories).values({ name: 'Root', slug: 'root' }).returning()

    await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: root.id })
      .returning()

    const result = await listCategoriesWithCountsQuery()

    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('root')
    expect(result.map((c) => c.slug)).not.toContain('child')
  })
})

describe('getCategoryBySlugQuery', () => {
  it('returns category with children and product count', async () => {
    const [root] = await db.insert(categories).values({ name: 'Root', slug: 'root' }).returning()
    await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: root.id })
      .returning()

    const result = await getCategoryBySlugQuery('root')

    expect(result).not.toBeNull()
    if (!result) throw new Error('result is null')
    expect(result.slug).toBe('root')
    expect(result.children).toHaveLength(1)
    expect(result.children[0].slug).toBe('child')
    expect(result.productCount).toBe(0)
    expect(result.breadcrumbs).toEqual([])
  })

  it('returns correct product count', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: cat.id,
    })

    await db.insert(product).values({
      id: 'prod-2',
      name: 'Bowl',
      slug: 'bowl',
      priceCents: 1999,
      shopId: s.id,
      categoryId: cat.id,
    })

    const result = await getCategoryBySlugQuery('pottery')

    expect(result).not.toBeNull()
    if (!result) throw new Error('result is null')
    expect(result.productCount).toBe(2)
  })

  it('counts products recursively in descendant categories', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [parent] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    const [child] = await db
      .insert(categories)
      .values({ name: 'Vases', slug: 'vases', parentId: parent.id })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: parent.id,
    })

    await db.insert(product).values({
      id: 'prod-2',
      name: 'Tall Vase',
      slug: 'tall-vase',
      priceCents: 3999,
      shopId: s.id,
      categoryId: child.id,
    })

    const result = await getCategoryBySlugQuery('pottery')

    expect(result).not.toBeNull()
    if (!result) throw new Error('result is null')
    expect(result.productCount).toBe(2)
  })

  it('returns breadcrumbs for nested category', async () => {
    const [root] = await db.insert(categories).values({ name: 'Root', slug: 'root' }).returning()
    const [child] = await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: root.id })
      .returning()
    await db
      .insert(categories)
      .values({ name: 'Grandchild', slug: 'grandchild', parentId: child.id })
      .returning()

    const result = await getCategoryBySlugQuery('grandchild')

    expect(result).not.toBeNull()
    if (!result) throw new Error('result is null')
    expect(result.breadcrumbs).toHaveLength(2)
    expect(result.breadcrumbs[0].slug).toBe('root')
    expect(result.breadcrumbs[1].slug).toBe('child')
  })

  it('returns null for nonexistent slug', async () => {
    const result = await getCategoryBySlugQuery('nonexistent')
    expect(result).toBeNull()
  })
})

describe('getDescendantCategoryIds', () => {
  it('returns self and all descendants', async () => {
    const [a] = await db.insert(categories).values({ name: 'A', slug: 'a' }).returning()
    const [b] = await db
      .insert(categories)
      .values({ name: 'B', slug: 'b', parentId: a.id })
      .returning()
    const [c] = await db
      .insert(categories)
      .values({ name: 'C', slug: 'c', parentId: b.id })
      .returning()

    const ids = await getDescendantCategoryIds(a.id)

    expect(ids).toHaveLength(3)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
    expect(ids).toContain(c.id)
  })

  it('returns only self when no children exist', async () => {
    const [a] = await db.insert(categories).values({ name: 'A', slug: 'a' }).returning()

    const ids = await getDescendantCategoryIds(a.id)

    expect(ids).toHaveLength(1)
    expect(ids).toContain(a.id)
  })
})

describe('getCategoryBreadcrumbs', () => {
  it('returns ancestor chain in root-to-current order', async () => {
    const [root] = await db.insert(categories).values({ name: 'Root', slug: 'root' }).returning()
    const [child] = await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: root.id })
      .returning()
    const [grandchild] = await db
      .insert(categories)
      .values({ name: 'Grandchild', slug: 'grandchild', parentId: child.id })
      .returning()

    const breadcrumbs = await getCategoryBreadcrumbs(grandchild.id)

    expect(breadcrumbs).toHaveLength(2)
    expect(breadcrumbs[0].slug).toBe('root')
    expect(breadcrumbs[1].slug).toBe('child')
  })

  it('returns empty array for root category', async () => {
    const [root] = await db.insert(categories).values({ name: 'Root', slug: 'root' }).returning()

    const breadcrumbs = await getCategoryBreadcrumbs(root.id)

    expect(breadcrumbs).toEqual([])
  })
})

describe('detectCircularReference', () => {
  it('detects direct self-reference', async () => {
    const [cat] = await db.insert(categories).values({ name: 'A', slug: 'a' }).returning()

    const result = await detectCircularReference(cat.id, cat.id)
    expect(result).toBe(true)
  })

  it('detects indirect circular reference', async () => {
    const [a] = await db.insert(categories).values({ name: 'A', slug: 'a' }).returning()
    const [b] = await db
      .insert(categories)
      .values({ name: 'B', slug: 'b', parentId: a.id })
      .returning()
    const [c] = await db
      .insert(categories)
      .values({ name: 'C', slug: 'c', parentId: b.id })
      .returning()
    // Make A's parent C to create a cycle: A -> B -> C -> A
    await db.update(categories).set({ parentId: c.id }).where(eq(categories.id, a.id))

    const result = await detectCircularReference(c.id, a.id)
    expect(result).toBe(true)
  })

  it('returns false for valid parent', async () => {
    const [parent] = await db
      .insert(categories)
      .values({ name: 'Parent', slug: 'parent' })
      .returning()
    const [child] = await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: parent.id })
      .returning()

    const result = await detectCircularReference(child.id, parent.id)
    expect(result).toBe(false)
  })

  it('returns false when parent has no parent', async () => {
    const [parent] = await db
      .insert(categories)
      .values({ name: 'Parent', slug: 'parent' })
      .returning()

    const result = await detectCircularReference('some-id', parent.id)
    expect(result).toBe(false)
  })
})

describe('category update operations', () => {
  it('updates a category name', async () => {
    const [cat] = await db
      .insert(categories)
      .values({ name: 'Original', slug: 'original' })
      .returning()

    await db.update(categories).set({ name: 'Updated' }).where(eq(categories.id, cat.id))

    const [updated] = await db.select().from(categories).where(eq(categories.id, cat.id))
    expect(updated.name).toBe('Updated')
    expect(updated.slug).toBe('original')
  })

  it('updates a category slug', async () => {
    const [cat] = await db
      .insert(categories)
      .values({ name: 'Original', slug: 'original' })
      .returning()

    await db.update(categories).set({ slug: 'updated' }).where(eq(categories.id, cat.id))

    const [updated] = await db.select().from(categories).where(eq(categories.id, cat.id))
    expect(updated.slug).toBe('updated')
  })

  it('updates a category parent', async () => {
    const [parent] = await db
      .insert(categories)
      .values({ name: 'Parent', slug: 'parent' })
      .returning()
    const [child] = await db.insert(categories).values({ name: 'Child', slug: 'child' }).returning()

    await db.update(categories).set({ parentId: parent.id }).where(eq(categories.id, child.id))

    const [updated] = await db.select().from(categories).where(eq(categories.id, child.id))
    expect(updated.parentId).toBe(parent.id)
  })

  it('rejects updating to a duplicate slug', async () => {
    await db.insert(categories).values({ name: 'First', slug: 'first' })
    const [second] = await db
      .insert(categories)
      .values({ name: 'Second', slug: 'second' })
      .returning()

    await expect(
      (async () =>
        db.update(categories).set({ slug: 'first' }).where(eq(categories.id, second.id)))(),
    ).rejects.toThrow()
  })

  it('blocks circular parent reference via detectCircularReference', async () => {
    const [a] = await db.insert(categories).values({ name: 'A', slug: 'a' }).returning()
    const [b] = await db
      .insert(categories)
      .values({ name: 'B', slug: 'b', parentId: a.id })
      .returning()
    const [c] = await db
      .insert(categories)
      .values({ name: 'C', slug: 'c', parentId: b.id })
      .returning()

    // Trying to make A's parent C would create a cycle
    const isCircular = await detectCircularReference(a.id, c.id)
    expect(isCircular).toBe(true)
  })
})

describe('category delete operations', () => {
  it('deletes a category with no products', async () => {
    const [cat] = await db
      .insert(categories)
      .values({ name: 'Deletable', slug: 'deletable' })
      .returning()

    await db.delete(categories).where(eq(categories.id, cat.id))

    const result = await db.select().from(categories).where(eq(categories.id, cat.id))
    expect(result).toHaveLength(0)
  })

  it('detects products blocking deletion', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: cat.id,
    })

    const descendantIds = await getDescendantCategoryIds(cat.id)
    const productCountResult = await db
      .select({ count: count() })
      .from(product)
      .where(eq(product.categoryId, cat.id))

    expect(productCountResult[0]?.count).toBe(1)
    expect(descendantIds).toContain(cat.id)
  })

  it('detects products in descendant categories blocking deletion', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [parent] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    const [child] = await db
      .insert(categories)
      .values({ name: 'Vases', slug: 'vases', parentId: parent.id })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: child.id,
    })

    const descendantIds = await getDescendantCategoryIds(parent.id)
    const productCountResult = await db
      .select({ count: count() })
      .from(product)
      .where(eq(product.categoryId, child.id))

    expect(productCountResult[0]?.count).toBe(1)
    expect(descendantIds).toContain(child.id)
  })

  it('allows deletion after reassigning all products', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: cat.id,
    })

    // Reassign product out of category
    await db.update(product).set({ categoryId: null }).where(eq(product.id, 'prod-1'))

    const productCountResult = await db
      .select({ count: count() })
      .from(product)
      .where(eq(product.categoryId, cat.id))

    expect(productCountResult[0]?.count).toBe(0)

    // Now deletion should succeed
    await db.delete(categories).where(eq(categories.id, cat.id))

    const result = await db.select().from(categories).where(eq(categories.id, cat.id))
    expect(result).toHaveLength(0)
  })
})

function makeAdminUser(id = 'admin-1'): SafeUser {
  return {
    id,
    name: 'Admin',
    email: 'admin@example.com',
    emailVerified: true,
    image: null,
    role: 'admin',
    bannedAt: null,
    twoFactorEnabled: true,
  }
}

function makeCustomerUser(id = 'customer-1'): SafeUser {
  return {
    id,
    name: 'Customer',
    email: 'customer@example.com',
    emailVerified: true,
    image: null,
    role: 'customer',
    bannedAt: null,
    twoFactorEnabled: false,
  }
}

describe('updateCategoryInternal', () => {
  it('rejects unauthenticated user', async () => {
    await expect(
      (async () => updateCategoryInternal(null, { id: '550e8400-e29b-41d4-a716-446655440000' }))(),
    ).rejects.toThrow('Unauthorized: admin access required')
  })

  it('rejects non-admin user', async () => {
    await expect(
      (async () =>
        updateCategoryInternal(makeCustomerUser(), {
          id: '550e8400-e29b-41d4-a716-446655440000',
        }))(),
    ).rejects.toThrow('Unauthorized: admin access required')
  })

  it('returns 404 for missing category', async () => {
    try {
      await updateCategoryInternal(makeAdminUser(), {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'New Name',
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('returns 400 for circular parent reference', async () => {
    const [a] = await db.insert(categories).values({ name: 'A', slug: 'a' }).returning()
    const [b] = await db
      .insert(categories)
      .values({ name: 'B', slug: 'b', parentId: a.id })
      .returning()
    const [c] = await db
      .insert(categories)
      .values({ name: 'C', slug: 'c', parentId: b.id })
      .returning()

    try {
      await updateCategoryInternal(makeAdminUser(), {
        id: a.id,
        parentId: c.id,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('returns 409 for duplicate slug', async () => {
    await db.insert(categories).values({ name: 'First', slug: 'first' })
    const [second] = await db
      .insert(categories)
      .values({ name: 'Second', slug: 'second' })
      .returning()

    try {
      await updateCategoryInternal(makeAdminUser(), {
        id: second.id,
        slug: 'first',
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('updates successfully as admin', async () => {
    const [cat] = await db
      .insert(categories)
      .values({ name: 'Original', slug: 'original' })
      .returning()

    const result = await updateCategoryInternal(makeAdminUser(), {
      id: cat.id,
      name: 'Updated',
    })

    expect(result.name).toBe('Updated')
    expect(result.slug).toBe('original')
  })
})

describe('deleteCategoryInternal', () => {
  it('rejects unauthenticated user', async () => {
    await expect(
      (async () => deleteCategoryInternal(null, { id: '550e8400-e29b-41d4-a716-446655440000' }))(),
    ).rejects.toThrow('Unauthorized: admin access required')
  })

  it('rejects non-admin user', async () => {
    await expect(
      (async () =>
        deleteCategoryInternal(makeCustomerUser(), {
          id: '550e8400-e29b-41d4-a716-446655440000',
        }))(),
    ).rejects.toThrow('Unauthorized: admin access required')
  })

  it('returns 404 for missing category', async () => {
    try {
      await deleteCategoryInternal(makeAdminUser(), {
        id: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('returns 409 when products reference the category', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: cat.id,
    })

    try {
      await deleteCategoryInternal(makeAdminUser(), { id: cat.id })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('returns 409 when products reference a descendant category', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [parent] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    const [child] = await db
      .insert(categories)
      .values({ name: 'Vases', slug: 'vases', parentId: parent.id })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      categoryId: child.id,
    })

    try {
      await deleteCategoryInternal(makeAdminUser(), { id: parent.id })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('deletes successfully as admin when no products exist', async () => {
    const [cat] = await db
      .insert(categories)
      .values({ name: 'Deletable', slug: 'deletable' })
      .returning()

    const result = await deleteCategoryInternal(makeAdminUser(), { id: cat.id })

    expect(result.success).toBe(true)
    expect(result.id).toBe(cat.id)

    const remaining = await db.select().from(categories).where(eq(categories.id, cat.id))
    expect(remaining).toHaveLength(0)
  })
})

describe('category database constraints', () => {
  it('rejects duplicate slug', async () => {
    await db.insert(categories).values({ name: 'Books', slug: 'books' })

    await expect(
      (async () => db.insert(categories).values({ name: 'Books 2', slug: 'books' }))(),
    ).rejects.toThrow()
  })

  it('allows null parentId', async () => {
    const [category] = await db
      .insert(categories)
      .values({ name: 'Root', slug: 'root' })
      .returning()

    expect(category.parentId).toBeNull()
  })

  it('allows child category with valid parentId', async () => {
    const [parent] = await db
      .insert(categories)
      .values({ name: 'Parent', slug: 'parent' })
      .returning()

    const [child] = await db
      .insert(categories)
      .values({ name: 'Child', slug: 'child', parentId: parent.id })
      .returning()

    expect(child.parentId).toBe(parent.id)
  })
})
