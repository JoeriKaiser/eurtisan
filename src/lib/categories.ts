import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
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
  description: z.string().max(1000).optional(),
  parentId: z.string().uuid().optional(),
})

export type CategoryTreeNode = {
  id: string
  name: string
  slug: string
  parentId: string | null
  createdAt: Date | null
  children: CategoryTreeNode[]
}

export function buildCategoryTree(
  flatCategories: {
    id: string
    name: string
    slug: string
    parentId: string | null
    createdAt: Date | null
  }[],
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

    const { db } = await import('#/db/index')
    const { categories } = await import('#/db/schema')
    const { eq } = await import('drizzle-orm')

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
        description: data.description?.trim() ?? null,
        parentId: data.parentId ?? null,
      })
      .returning()

    return category
  })

export const listCategories = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ tree: z.boolean().optional() }).optional().default({}))
  .handler(async ({ data }) => {
    const { listCategoriesQuery, listCategoryTreeQuery } = await import('./categories.server')
    if (data.tree) {
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
    const { updateCategoryInternal } = await import('./categories.server')
    return updateCategoryInternal(context.user, data)
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
    const { deleteCategoryInternal } = await import('./categories.server')
    return deleteCategoryInternal(context.user, data)
  })
