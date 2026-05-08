import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { categories } from '#/db/schema'
import { createCategorySchema, listCategoriesQuery, sanitizeSlug } from './categories'

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

describe('listCategories', () => {
  beforeEach(async () => {
    await db.delete(categories)
  })

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

describe('category database constraints', () => {
  beforeEach(async () => {
    await db.delete(categories)
  })

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
