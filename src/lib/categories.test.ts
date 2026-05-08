import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import { categories, product, shop, user } from '#/db/schema'
import {
  buildCategoryTree,
  createCategorySchema,
  detectCircularReference,
  getCategoryBreadcrumbs,
  getCategoryBySlugQuery,
  getDescendantCategoryIds,
  listCategoriesQuery,
  listCategoryTreeQuery,
  sanitizeSlug,
} from './categories'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
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
      parentId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
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

describe('buildCategoryTree', () => {
  it('builds a tree from flat categories', () => {
    const flat = [
      { id: '1', name: 'Root', slug: 'root', parentId: null, createdAt: null },
      { id: '2', name: 'Child', slug: 'child', parentId: '1', createdAt: null },
      { id: '3', name: 'Grandchild', slug: 'grandchild', parentId: '2', createdAt: null },
    ] as typeof categories.$inferSelect[]

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
    ] as typeof categories.$inferSelect[]

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
    ] as typeof categories.$inferSelect[]

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
    const [root] = await db
      .insert(categories)
      .values({ name: 'Root', slug: 'root' })
      .returning()
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

describe('getCategoryBySlugQuery', () => {
  it('returns category with children and product count', async () => {
    const [root] = await db
      .insert(categories)
      .values({ name: 'Root', slug: 'root' })
      .returning()
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
      price: '29.99',
      shopId: s.id,
      categoryId: cat.id,
    })

    await db.insert(product).values({
      id: 'prod-2',
      name: 'Bowl',
      slug: 'bowl',
      price: '19.99',
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
      price: '29.99',
      shopId: s.id,
      categoryId: parent.id,
    })

    await db.insert(product).values({
      id: 'prod-2',
      name: 'Tall Vase',
      slug: 'tall-vase',
      price: '39.99',
      shopId: s.id,
      categoryId: child.id,
    })

    const result = await getCategoryBySlugQuery('pottery')

    expect(result).not.toBeNull()
    if (!result) throw new Error('result is null')
    expect(result.productCount).toBe(2)
  })

  it('returns breadcrumbs for nested category', async () => {
    const [root] = await db
      .insert(categories)
      .values({ name: 'Root', slug: 'root' })
      .returning()
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
    const [root] = await db
      .insert(categories)
      .values({ name: 'Root', slug: 'root' })
      .returning()
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
    const [root] = await db
      .insert(categories)
      .values({ name: 'Root', slug: 'root' })
      .returning()

    const breadcrumbs = await getCategoryBreadcrumbs(root.id)

    expect(breadcrumbs).toEqual([])
  })
})

describe('detectCircularReference', () => {
  it('detects direct self-reference', async () => {
    const [cat] = await db
      .insert(categories)
      .values({ name: 'A', slug: 'a' })
      .returning()

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

describe('category database constraints', () => {
  it('rejects duplicate slug', async () => {
    await db.insert(categories).values({ name: 'Books', slug: 'books' })

    await expect(db.insert(categories).values({ name: 'Books 2', slug: 'books' })).rejects.toThrow()
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
