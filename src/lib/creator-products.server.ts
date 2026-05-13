import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import z from 'zod'
import { db } from '#/db/index'
import { categories, product, productImage, shop } from '#/db/schema'
import { authMiddleware } from './auth-middleware'
import {
  deleteProductImages,
  type ProductImageInput,
  sanitizeDescription,
  saveProductImages,
} from './image-utils'

/* -------------------------------------------------------------------------- */
/*                                   Schemas                                  */
/* -------------------------------------------------------------------------- */

const productImageInputSchema = z.object({
  dataUrl: z
    .string()
    .min(1)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
      message: 'Invalid image data URL format',
    }),
  altText: z.string().max(500).optional(),
})

export const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Slug must be URL-safe (lowercase letters, numbers, and hyphens only)',
    }),
  priceCents: z.number().int().positive(),
  stockCount: z.number().int().min(0).default(0),
  categoryId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
  images: z.array(productImageInputSchema).max(10).optional().default([]),
})

export const updateProductSchema = createProductSchema.partial().extend({
  productId: z.string().min(1),
  shopId: z.string().min(1),
  images: z.array(productImageInputSchema).max(10).optional(),
})

export const deleteProductSchema = z.object({
  productId: z.string().min(1),
  shopId: z.string().min(1),
  hard: z.boolean().default(false),
})

export const listCreatorProductsSchema = z.object({
  shopId: z.string().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  categoryId: z.string().uuid().optional(),
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

export async function verifyProductOwnership(productId: string, userId: string) {
  const [productRecord] = await db
    .select({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      priceCents: product.priceCents,
      stockCount: product.stockCount,
      isActive: product.isActive,
      shopId: product.shopId,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      shopOwnerId: shop.ownerId,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(eq(product.id, productId))
    .limit(1)

  if (!productRecord) {
    throw new Error('NOT_FOUND')
  }

  if (productRecord.shopOwnerId !== userId) {
    throw new Error('FORBIDDEN')
  }

  return productRecord
}

export async function checkSlugUniqueness(slug: string, shopId: string, excludeProductId?: string) {
  const conditions = [eq(product.slug, slug), eq(product.shopId, shopId)]
  if (excludeProductId) {
    conditions.push(sql`${product.id} != ${excludeProductId}`)
  }

  const existing = await db
    .select()
    .from(product)
    .where(and(...conditions))
    .limit(1)
  return existing.length === 0
}

export async function validateCategory(categoryId: string | undefined) {
  if (!categoryId) return true
  const [categoryRecord] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1)
  return !!categoryRecord
}

async function insertProductImages(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  images: ProductImageInput[],
) {
  if (images.length === 0) return []

  const saved = await saveProductImages(productId, images)

  const values = saved.map((img) => ({
    id: crypto.randomUUID(),
    productId,
    url: img.url,
    altText: img.altText ?? null,
    sortOrder: img.sortOrder,
  }))

  await tx.insert(productImage).values(values)
  return values
}

async function replaceProductImages(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  images: ProductImageInput[],
  oldImageUrls: string[],
) {
  if (images.length === 0) {
    await tx.delete(productImage).where(eq(productImage.productId, productId))
    return { values: [], oldImageUrls }
  }

  // 1. Save new files first (UUID-based names — never conflict with old files)
  const saved = await saveProductImages(productId, images)

  // 2. Delete old DB records
  await tx.delete(productImage).where(eq(productImage.productId, productId))

  // 3. Insert new DB records
  const values = saved.map((img) => ({
    id: crypto.randomUUID(),
    productId,
    url: img.url,
    altText: img.altText ?? null,
    sortOrder: img.sortOrder,
  }))

  await tx.insert(productImage).values(values)
  return { values, oldImageUrls }
}

/* -------------------------------------------------------------------------- */
/*                             Internal Queries                               */
/* -------------------------------------------------------------------------- */

export async function createProductInternal(data: {
  name: string
  description?: string
  slug: string
  priceCents: number
  stockCount: number
  shopId: string
  categoryId?: string
  isActive?: boolean
  images?: ProductImageInput[]
}) {
  const categoryValid = await validateCategory(data.categoryId)
  if (!categoryValid) {
    throw new Error('Invalid category_id')
  }

  const isUnique = await checkSlugUniqueness(data.slug, data.shopId)
  if (!isUnique) {
    throw new Error('DUPLICATE_SLUG')
  }

  const newProduct = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(product)
      .values({
        id: crypto.randomUUID(),
        name: data.name.trim(),
        description: sanitizeDescription(data.description),
        slug: data.slug.trim(),
        priceCents: data.priceCents,
        stockCount: data.stockCount,
        shopId: data.shopId,
        categoryId: data.categoryId ?? null,
        isActive: data.isActive ?? true,
      })
      .returning()

    try {
      await insertProductImages(tx, inserted.id, data.images ?? [])
    } catch (imageErr) {
      // Clean up saved files before re-throwing so the transaction rolls back
      await deleteProductImages(inserted.id)
      throw imageErr
    }

    return inserted
  })

  const { syncProductToMeilisearch } = await import('./meilisearch-products.server')
  await syncProductToMeilisearch(newProduct)

  return newProduct
}

export async function updateProductInternal(data: {
  productId: string
  shopId: string
  userId: string
  name?: string
  description?: string
  slug?: string
  priceCents?: number
  stockCount?: number
  categoryId?: string
  images?: ProductImageInput[]
}) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  // Ensure the product belongs to the specified shop
  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  const categoryValid = await validateCategory(data.categoryId)
  if (!categoryValid) {
    throw new Error('Invalid category_id')
  }

  if (data.slug && data.slug !== productRecord.slug) {
    const isUnique = await checkSlugUniqueness(data.slug, data.shopId, data.productId)
    if (!isUnique) {
      throw new Error('DUPLICATE_SLUG')
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.description !== undefined) updateData.description = sanitizeDescription(data.description)
  if (data.slug !== undefined) updateData.slug = data.slug.trim()
  if (data.priceCents !== undefined) updateData.priceCents = data.priceCents
  if (data.stockCount !== undefined) updateData.stockCount = data.stockCount
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId ?? null

  // Remember old image URLs so we can clean up files after a successful commit
  let oldImageUrls: string[] = []
  if (data.images !== undefined) {
    const oldImages = await db
      .select({ url: productImage.url })
      .from(productImage)
      .where(eq(productImage.productId, data.productId))
    oldImageUrls = oldImages.map((i) => i.url)
  }

  const updatedProduct = await db
    .transaction(async (tx) => {
      const [result] = await tx
        .update(product)
        .set(updateData)
        .where(eq(product.id, data.productId))
        .returning()

      if (data.images !== undefined) {
        await replaceProductImages(tx, data.productId, data.images, oldImageUrls)
      }

      return result
    })
    .then(async (result) => {
      // Transaction committed — safe to delete old files
      for (const url of oldImageUrls) {
        try {
          await rm(join(process.cwd(), 'public', url), { force: true })
        } catch {
          // ignore missing files
        }
      }
      return result
    })

  const { syncProductToMeilisearch } = await import('./meilisearch-products.server')
  await syncProductToMeilisearch(updatedProduct)

  return updatedProduct
}

export async function deleteProductInternal(data: {
  productId: string
  shopId: string
  hard: boolean
  userId: string
}) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  // Ensure the product belongs to the specified shop
  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  if (data.hard) {
    // Delete files first so orphaned uploads don't remain if DB delete fails
    await deleteProductImages(data.productId)
    await db.delete(product).where(eq(product.id, data.productId))

    const { removeProductFromMeilisearch } = await import('./meilisearch-products.server')
    await removeProductFromMeilisearch(data.productId)

    return { deleted: true, hard: true }
  }

  const [updated] = await db
    .update(product)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(product.id, data.productId))
    .returning()

  const { syncProductToMeilisearch } = await import('./meilisearch-products.server')
  await syncProductToMeilisearch(updated)

  return { deleted: true, hard: false }
}

export async function listCreatorProductsInternal(data: {
  shopId: string
  page: number
  pageSize: number
  active: 'true' | 'false' | 'all'
  categoryId?: string
}) {
  const page = Math.max(1, data.page)
  const pageSize = Math.min(100, Math.max(1, data.pageSize))
  const offset = (page - 1) * pageSize

  const conditions = [eq(product.shopId, data.shopId)]

  if (data.active === 'true') {
    conditions.push(eq(product.isActive, true))
  } else if (data.active === 'false') {
    conditions.push(eq(product.isActive, false))
  }

  if (data.categoryId) {
    conditions.push(eq(product.categoryId, data.categoryId))
  }

  const where = and(...conditions)

  const [totalResult] = await db.select({ total: count() }).from(product).where(where)

  const total = totalResult?.total ?? 0

  const products = await db
    .select({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      priceCents: product.priceCents,
      stockCount: product.stockCount,
      isActive: product.isActive,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      imageCount: count(productImage.id),
    })
    .from(product)
    .leftJoin(productImage, eq(productImage.productId, product.id))
    .where(where)
    .groupBy(product.id)
    .orderBy(desc(product.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    products: products.map((p) => ({
      ...p,
      imageCount: Number(p.imageCount),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/* -------------------------------------------------------------------------- */
/*                                Server Functions                            */
/* -------------------------------------------------------------------------- */

export const createProduct = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createProductSchema.extend({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, data.shopId)

    return createProductInternal(data)
  })

export const updateProduct = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateProductSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    return updateProductInternal({ ...data, shopId: data.shopId, userId: context.user.id })
  })

export const deleteProduct = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteProductSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    return deleteProductInternal({ ...data, userId: context.user.id })
  })

export const listCreatorProducts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listCreatorProductsSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, data.shopId)

    return listCreatorProductsInternal(data)
  })
