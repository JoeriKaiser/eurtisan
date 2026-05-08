import { createServerFn } from '@tanstack/react-start'
import { eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/index'
import { categories } from '#/db/schema'
import { authMiddleware } from './auth-middleware'

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

export const listCategories = createServerFn({
  method: 'GET',
}).handler(async () => {
  return listCategoriesQuery()
})

export async function getCategoryBySlugQuery(slug: string) {
  const [category] = await db.select().from(categories).where(eq(categories.slug, slug))
  return category ?? null
}

export const getCategoryBySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    return getCategoryBySlugQuery(data.slug)
  })
