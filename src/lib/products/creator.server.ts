import { and, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  categories,
  meilisearchSyncQueue,
  product,
  productImage,
  productVariant,
  shop,
} from '#/db/schema'
import { type ProductImageInput, validateImageKey } from '../image-utils'
import {
  deleteImageFromStorage,
  extractKeyFromUrl,
  isExternalImageUrl,
} from '../image-storage.server'
import { logger } from '../logger.server'
import { isPostgresUniqueViolation } from '../db-errors'
import { sanitizeRichText, validatePlainText } from '../xss'
import { writeAuditLog, type AuditActor } from '../audit-logger'
import { createNotification } from '../notifications.server'

export {
  createProductSchema,
  deleteProductSchema,
  listCreatorProductsSchema,
  toggleProductActiveSchema,
  updateProductSchema,
} from './creator.schema'

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
      status: product.status,
      publishedAt: product.publishedAt,
      vatRateCategory: product.vatRateCategory,
      shopId: product.shopId,
      categoryId: product.categoryId,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
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

  for (const img of images) {
    const extractedKey = extractKeyFromUrl(img.key)
    if (extractedKey) {
      validateImageKey(extractedKey)
    } else if (!isExternalImageUrl(img.key)) {
      throw new Error('Invalid image key format')
    }
  }

  const values = images.map((img, i) => ({
    id: crypto.randomUUID(),
    productId,
    url: img.key,
    altText: img.altText ?? null,
    sortOrder: i,
  }))

  await tx.insert(productImage).values(values)
  return values
}

async function replaceProductImages(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  images: ProductImageInput[],
) {
  if (images.length === 0) {
    await tx.delete(productImage).where(eq(productImage.productId, productId))
    return []
  }

  for (const img of images) {
    const extractedKey = extractKeyFromUrl(img.key)
    if (extractedKey) {
      validateImageKey(extractedKey)
    } else if (!isExternalImageUrl(img.key)) {
      throw new Error('Invalid image key format')
    }
  }

  await tx.delete(productImage).where(eq(productImage.productId, productId))

  const values = images.map((img, i) => ({
    id: crypto.randomUUID(),
    productId,
    url: img.key,
    altText: img.altText ?? null,
    sortOrder: i,
  }))

  await tx.insert(productImage).values(values)
  return values
}

/* -------------------------------------------------------------------------- */
/*                             Internal Queries                               */
/* -------------------------------------------------------------------------- */

export async function createProductInternal(
  data: {
    name: string
    description?: string
    slug: string
    priceCents: number
    stockCount: number
    shopId: string
    categoryId?: string
    isActive?: boolean
    status?: 'draft' | 'published'
    vatRateCategory?: 'standard' | 'reduced' | 'exempt'
    weightGrams?: number
    lengthCm?: number
    widthCm?: number
    heightCm?: number
    images?: ProductImageInput[]
  },
  actor?: AuditActor,
) {
  const categoryValid = await validateCategory(data.categoryId)
  if (!categoryValid) {
    throw new Error('Invalid category_id')
  }

  let newProduct: typeof product.$inferSelect
  try {
    const status = data.status ?? 'draft'
    const isActive = data.isActive ?? true

    newProduct = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(product)
        .values({
          id: crypto.randomUUID(),
          name: validatePlainText(data.name, 'Product name'),
          description: sanitizeRichText(data.description),
          slug: data.slug.trim(),
          priceCents: data.priceCents,
          stockCount: data.stockCount,
          shopId: data.shopId,
          categoryId: data.categoryId ?? null,
          isActive,
          status,
          publishedAt: status === 'published' ? new Date() : null,
          vatRateCategory: data.vatRateCategory ?? 'standard',
          weightGrams: data.weightGrams ?? null,
          lengthCm: data.lengthCm ?? null,
          widthCm: data.widthCm ?? null,
          heightCm: data.heightCm ?? null,
        })
        .returning()

      await insertProductImages(tx, inserted.id, data.images ?? [])

      if (status === 'published' && isActive) {
        await tx.insert(meilisearchSyncQueue).values({
          productId: inserted.id,
          action: 'index',
        })
      }

      return inserted
    })
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'product_shop_slug_published_unique')) {
      throw new Error('DUPLICATE_SLUG')
    }
    throw err
  }

  if (newProduct.status === 'published' && newProduct.isActive) {
    import('../meilisearch-products.server')
      .then(async ({ syncProductToMeilisearch }) => {
        try {
          await syncProductToMeilisearch(newProduct)
          await db
            .update(meilisearchSyncQueue)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(
              and(
                eq(meilisearchSyncQueue.productId, newProduct.id),
                eq(meilisearchSyncQueue.action, 'index'),
              ),
            )
        } catch {
          // ignored, background poller will pick it up
        }
      })
      .catch(() => {})
  }

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_created',
      resourceType: 'product',
      resourceId: newProduct.id,
      metadata: { shopId: newProduct.shopId, name: newProduct.name, status: newProduct.status },
    })
  }

  return newProduct
}

export async function updateProductInternal(
  data: {
    productId: string
    shopId: string
    userId: string
    name?: string
    description?: string
    slug?: string
    priceCents?: number
    stockCount?: number
    categoryId?: string
    isActive?: boolean
    status?: 'draft' | 'published' | 'archived'
    vatRateCategory?: 'standard' | 'reduced' | 'exempt'
    weightGrams?: number
    lengthCm?: number
    widthCm?: number
    heightCm?: number
    images?: ProductImageInput[]
  },
  actor?: AuditActor,
) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  // Ensure the product belongs to the specified shop
  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  const categoryValid = await validateCategory(data.categoryId)
  if (!categoryValid) {
    throw new Error('Invalid category_id')
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = validatePlainText(data.name, 'Product name')
  if (data.description !== undefined) updateData.description = sanitizeRichText(data.description)
  if (data.slug !== undefined) updateData.slug = data.slug.trim()
  if (data.priceCents !== undefined) updateData.priceCents = data.priceCents
  if (data.stockCount !== undefined) updateData.stockCount = data.stockCount
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId ?? null
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.status !== undefined) {
    updateData.status = data.status
    if (data.status === 'published' && productRecord.publishedAt == null) {
      updateData.publishedAt = new Date()
    }
  }
  if (data.vatRateCategory !== undefined) updateData.vatRateCategory = data.vatRateCategory
  if (data.weightGrams !== undefined) updateData.weightGrams = data.weightGrams ?? null
  if (data.lengthCm !== undefined) updateData.lengthCm = data.lengthCm ?? null
  if (data.widthCm !== undefined) updateData.widthCm = data.widthCm ?? null
  if (data.heightCm !== undefined) updateData.heightCm = data.heightCm ?? null

  // Remember old image keys so we can clean them up from S3 after a successful commit
  let oldImageKeys: string[] = []
  if (data.images !== undefined) {
    const oldImages = await db
      .select({ url: productImage.url })
      .from(productImage)
      .where(eq(productImage.productId, data.productId))
    oldImageKeys = oldImages.map((i) => i.url).filter((url): url is string => !!url)
  }

  const finalStatus = data.status ?? productRecord.status
  const finalIsActive = data.isActive ?? productRecord.isActive
  const willBePublished = finalStatus === 'published' && finalIsActive

  let updatedProduct: typeof product.$inferSelect
  try {
    updatedProduct = await db.transaction(async (tx) => {
      const [result] = await tx
        .update(product)
        .set(updateData)
        .where(eq(product.id, data.productId))
        .returning()

      if (data.images !== undefined) {
        await replaceProductImages(tx, data.productId, data.images)
      }

      await tx.insert(meilisearchSyncQueue).values({
        productId: data.productId,
        action: willBePublished ? 'index' : 'delete',
      })

      return result
    })
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'product_shop_slug_published_unique')) {
      throw new Error('DUPLICATE_SLUG')
    }
    throw err
  }

  updatedProduct = await Promise.resolve(updatedProduct).then(async (result) => {
    // Transaction committed — safe to delete old images from S3
    if (data.images !== undefined && oldImageKeys.length > 0) {
      const newKeys = new Set(data.images.map((img) => img.key))
      for (const key of oldImageKeys) {
        if (!newKeys.has(key) && extractKeyFromUrl(key) !== null) {
          try {
            await deleteImageFromStorage(key)
          } catch (err) {
            logger.error(`Failed to delete old product image from S3: ${key}`, err)
          }
        }
      }
    }
    return result
  })

  import('../meilisearch-products.server')
    .then(async ({ syncProductToMeilisearch, removeProductFromMeilisearch }) => {
      try {
        if (updatedProduct.status === 'published' && updatedProduct.isActive) {
          await syncProductToMeilisearch(updatedProduct)
          await db
            .update(meilisearchSyncQueue)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(
              and(
                eq(meilisearchSyncQueue.productId, updatedProduct.id),
                eq(meilisearchSyncQueue.action, 'index'),
              ),
            )
        } else {
          await removeProductFromMeilisearch(updatedProduct.id)
          await db
            .update(meilisearchSyncQueue)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(
              and(
                eq(meilisearchSyncQueue.productId, updatedProduct.id),
                eq(meilisearchSyncQueue.action, 'delete'),
              ),
            )
        }
      } catch {
        // ignored, background poller will pick it up
      }
    })
    .catch(() => {})

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_updated',
      resourceType: 'product',
      resourceId: updatedProduct.id,
      metadata: {
        shopId: updatedProduct.shopId,
        name: updatedProduct.name,
        status: updatedProduct.status,
      },
    })
  }

  if (data.stockCount !== undefined) {
    await notifyLowStockIfNeeded(updatedProduct.id)
  }

  return updatedProduct
}

/* -------------------------------------------------------------------------- */
/*                         Product Lifecycle Helpers                          */
/* -------------------------------------------------------------------------- */

export async function publishProductInternal(
  data: {
    productId: string
    shopId: string
    userId: string
  },
  actor?: AuditActor,
) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  let updatedProduct: typeof product.$inferSelect
  try {
    updatedProduct = await db.transaction(async (tx) => {
      const [result] = await tx
        .update(product)
        .set({
          status: 'published',
          isActive: true,
          publishedAt: sql`coalesce(${product.publishedAt}, now())`,
          updatedAt: new Date(),
        })
        .where(eq(product.id, data.productId))
        .returning()

      await tx.insert(meilisearchSyncQueue).values({
        productId: data.productId,
        action: 'index',
      })

      return result
    })
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'product_shop_slug_published_unique')) {
      throw new Error('SLUG_IN_USE')
    }
    throw err
  }

  import('../meilisearch-products.server')
    .then(async ({ syncProductToMeilisearch }) => {
      try {
        await syncProductToMeilisearch(updatedProduct)
        await db
          .update(meilisearchSyncQueue)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(
            and(
              eq(meilisearchSyncQueue.productId, updatedProduct.id),
              eq(meilisearchSyncQueue.action, 'index'),
            ),
          )
      } catch {
        // ignored, background poller will pick it up
      }
    })
    .catch(() => {})

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_published',
      resourceType: 'product',
      resourceId: updatedProduct.id,
      metadata: { shopId: updatedProduct.shopId, name: updatedProduct.name },
    })
  }

  return updatedProduct
}

export async function unpublishProductInternal(
  data: {
    productId: string
    shopId: string
    userId: string
  },
  actor?: AuditActor,
) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  const updated = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(product)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(product.id, data.productId))
      .returning()

    await tx.insert(meilisearchSyncQueue).values({
      productId: data.productId,
      action: 'delete',
    })

    return result
  })

  import('../meilisearch-products.server')
    .then(async ({ removeProductFromMeilisearch }) => {
      try {
        await removeProductFromMeilisearch(updated.id)
        await db
          .update(meilisearchSyncQueue)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(
            and(
              eq(meilisearchSyncQueue.productId, updated.id),
              eq(meilisearchSyncQueue.action, 'delete'),
            ),
          )
      } catch {
        // ignored, background poller will pick it up
      }
    })
    .catch(() => {})

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_unpublished',
      resourceType: 'product',
      resourceId: updated.id,
      metadata: { shopId: updated.shopId, name: updated.name },
    })
  }

  return updated
}

export async function archiveProductInternal(
  data: {
    productId: string
    shopId: string
    userId: string
  },
  actor?: AuditActor,
) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  const updated = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(product)
      .set({ status: 'archived', isActive: false, updatedAt: new Date() })
      .where(eq(product.id, data.productId))
      .returning()

    await tx.insert(meilisearchSyncQueue).values({
      productId: data.productId,
      action: 'delete',
    })

    return result
  })

  import('../meilisearch-products.server')
    .then(async ({ removeProductFromMeilisearch }) => {
      try {
        await removeProductFromMeilisearch(updated.id)
        await db
          .update(meilisearchSyncQueue)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(
            and(
              eq(meilisearchSyncQueue.productId, updated.id),
              eq(meilisearchSyncQueue.action, 'delete'),
            ),
          )
      } catch {
        // ignored, background poller will pick it up
      }
    })
    .catch(() => {})

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_archived',
      resourceType: 'product',
      resourceId: updated.id,
      metadata: { shopId: updated.shopId, name: updated.name },
    })
  }

  return updated
}

export async function deleteProductInternal(
  data: {
    productId: string
    shopId: string
    hard: boolean
    userId: string
  },
  actor?: AuditActor,
) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  // Ensure the product belongs to the specified shop
  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  if (data.hard) {
    // Collect image keys before deleting so we can clean up S3 afterwards
    const oldImages = await db
      .select({ url: productImage.url })
      .from(productImage)
      .where(eq(productImage.productId, data.productId))
    const oldKeys = oldImages.map((i) => i.url).filter((url): url is string => !!url)

    await db.transaction(async (tx) => {
      await tx.insert(meilisearchSyncQueue).values({
        productId: data.productId,
        action: 'delete',
      })

      await tx.delete(product).where(eq(product.id, data.productId))
    })

    // Delete from S3 after DB transaction succeeds
    if (oldKeys.length > 0) {
      for (const key of oldKeys) {
        if (extractKeyFromUrl(key) === null) continue
        try {
          await deleteImageFromStorage(key)
        } catch (err) {
          logger.error(`Failed to delete product image from S3: ${key}`, err)
        }
      }
    }

    import('../meilisearch-products.server')
      .then(async ({ removeProductFromMeilisearch }) => {
        try {
          await removeProductFromMeilisearch(data.productId)
          await db
            .update(meilisearchSyncQueue)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(
              and(
                eq(meilisearchSyncQueue.productId, data.productId),
                eq(meilisearchSyncQueue.action, 'delete'),
              ),
            )
        } catch {
          // ignored, background poller will pick it up
        }
      })
      .catch(() => {})

    if (actor) {
      await writeAuditLog({
        actor,
        action: 'product_deleted',
        resourceType: 'product',
        resourceId: data.productId,
        metadata: { shopId: productRecord.shopId, name: productRecord.name, hard: true },
      })
    }

    return { deleted: true, hard: true }
  }

  const updated = await db.transaction(async (tx) => {
    const [res] = await tx
      .update(product)
      .set({ status: 'archived', isActive: false, updatedAt: new Date() })
      .where(eq(product.id, data.productId))
      .returning()

    await tx.insert(meilisearchSyncQueue).values({
      productId: data.productId,
      action: 'delete',
    })

    return res
  })

  import('../meilisearch-products.server')
    .then(async ({ removeProductFromMeilisearch }) => {
      try {
        await removeProductFromMeilisearch(updated.id)
        await db
          .update(meilisearchSyncQueue)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(
            and(
              eq(meilisearchSyncQueue.productId, updated.id),
              eq(meilisearchSyncQueue.action, 'delete'),
            ),
          )
      } catch {
        // ignored, background poller will pick it up
      }
    })
    .catch(() => {})

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_deleted',
      resourceType: 'product',
      resourceId: data.productId,
      metadata: {
        shopId: productRecord.shopId,
        name: productRecord.name,
        hard: false,
        status: 'archived',
      },
    })
  }

  return { deleted: true, hard: false }
}

export async function listCreatorProductsInternal(data: {
  shopId: string
  page: number
  pageSize: number
  active: 'true' | 'false' | 'all'
  status?: 'draft' | 'published' | 'archived' | 'all'
  categoryId?: string
  search?: string
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

  if (data.status && data.status !== 'all') {
    conditions.push(eq(product.status, data.status))
  }

  if (data.categoryId) {
    conditions.push(eq(product.categoryId, data.categoryId))
  }

  if (data.search && data.search.trim().length > 0) {
    conditions.push(ilike(product.name, `%${data.search.trim()}%`))
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
      status: product.status,
      publishedAt: product.publishedAt,
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

  // Fetch first image (thumbnail) for each product
  const thumbnailMap = new Map<string, string>()
  if (products.length > 0) {
    const productIds = products.map((p) => p.id)
    const thumbnails = await db
      .select({ productId: productImage.productId, url: productImage.url })
      .from(productImage)
      .where(and(inArray(productImage.productId, productIds), eq(productImage.sortOrder, 0)))
    for (const thumb of thumbnails) {
      thumbnailMap.set(thumb.productId, thumb.url)
    }
  }

  return {
    products: products.map((p) => ({
      ...p,
      imageCount: Number(p.imageCount),
      thumbnailUrl: thumbnailMap.get(p.id) ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/* -------------------------------------------------------------------------- */
/*                            Get Product Detail                              */
/* -------------------------------------------------------------------------- */

export async function getCreatorProductDetailInternal(productId: string, userId: string) {
  const [productRecord, images] = await Promise.all([
    verifyProductOwnership(productId, userId),
    db
      .select({
        id: productImage.id,
        url: productImage.url,
        altText: productImage.altText,
        sortOrder: productImage.sortOrder,
      })
      .from(productImage)
      .where(eq(productImage.productId, productId))
      .orderBy(productImage.sortOrder),
  ])

  return { ...productRecord, images }
}

/* -------------------------------------------------------------------------- */
/*                               Toggle Active                                */
/* -------------------------------------------------------------------------- */

export async function toggleProductActiveInternal(
  data: {
    productId: string
    shopId: string
    userId: string
  },
  actor?: AuditActor,
) {
  const productRecord = await verifyProductOwnership(data.productId, data.userId)

  if (productRecord.shopId !== data.shopId) {
    throw new Error('FORBIDDEN')
  }

  if (productRecord.status !== 'published') {
    throw new Error('NOT_PUBLISHED')
  }

  const newActive = !productRecord.isActive

  const updated = await db.transaction(async (tx) => {
    const [res] = await tx
      .update(product)
      .set({ isActive: newActive, updatedAt: new Date() })
      .where(eq(product.id, data.productId))
      .returning()

    await tx.insert(meilisearchSyncQueue).values({
      productId: data.productId,
      action: newActive ? 'index' : 'delete',
    })

    return res
  })

  import('../meilisearch-products.server')
    .then(async ({ syncProductToMeilisearch, removeProductFromMeilisearch }) => {
      try {
        if (updated.isActive) {
          await syncProductToMeilisearch(updated)
          await db
            .update(meilisearchSyncQueue)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(
              and(
                eq(meilisearchSyncQueue.productId, updated.id),
                eq(meilisearchSyncQueue.action, 'index'),
              ),
            )
        } else {
          await removeProductFromMeilisearch(updated.id)
          await db
            .update(meilisearchSyncQueue)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(
              and(
                eq(meilisearchSyncQueue.productId, updated.id),
                eq(meilisearchSyncQueue.action, 'delete'),
              ),
            )
        }
      } catch {
        // ignored, background poller will pick it up
      }
    })
    .catch(() => {})

  if (actor) {
    await writeAuditLog({
      actor,
      action: updated.isActive ? 'product_activated' : 'product_deactivated',
      resourceType: 'product',
      resourceId: updated.id,
      metadata: { shopId: updated.shopId, name: updated.name },
    })
  }

  return { productId: updated.id, isActive: updated.isActive }
}

/* -------------------------------------------------------------------------- */
/*                              Bulk Operations                               */
/* -------------------------------------------------------------------------- */

export async function bulkToggleProductActiveInternal(
  data: {
    shopId: string
    productIds: string[]
    isActive: boolean
    userId: string
  },
  actor?: AuditActor,
) {
  const ownedProducts = await db
    .select({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      priceCents: product.priceCents,
      stockCount: product.stockCount,
      isActive: product.isActive,
      status: product.status,
      vatRateCategory: product.vatRateCategory,
      shopId: product.shopId,
      categoryId: product.categoryId,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(
      and(
        eq(shop.ownerId, data.userId),
        eq(product.shopId, data.shopId),
        eq(product.status, 'published'),
        inArray(product.id, data.productIds),
      ),
    )

  if (ownedProducts.length === 0) {
    return { updated: 0 }
  }

  const ownedIds = ownedProducts.map((p) => p.id)

  await db.transaction(async (tx) => {
    await tx
      .update(product)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(inArray(product.id, ownedIds))

    await tx.insert(meilisearchSyncQueue).values(
      ownedIds.map((productId) => ({
        productId,
        action: data.isActive ? ('index' as const) : ('delete' as const),
      })),
    )
  })

  import('../meilisearch-products.server')
    .then(async ({ syncProductToMeilisearch, removeProductFromMeilisearch }) => {
      for (const p of ownedProducts) {
        try {
          if (data.isActive) {
            await syncProductToMeilisearch({ ...p, isActive: data.isActive })
          } else {
            await removeProductFromMeilisearch(p.id)
          }
        } catch {
          // ignored, background poller will pick it up
        }
      }
    })
    .catch(() => {})

  if (actor) {
    for (const p of ownedProducts) {
      await writeAuditLog({
        actor,
        action: data.isActive ? 'product_activated' : 'product_deactivated',
        resourceType: 'product',
        resourceId: p.id,
        metadata: { shopId: p.shopId, name: p.name },
      })
    }
  }

  return { updated: ownedIds.length }
}

export async function bulkDeleteProductsInternal(
  data: {
    shopId: string
    productIds: string[]
    hard: boolean
    userId: string
  },
  actor?: AuditActor,
) {
  const ownedProducts = await db
    .select({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      priceCents: product.priceCents,
      stockCount: product.stockCount,
      isActive: product.isActive,
      status: product.status,
      vatRateCategory: product.vatRateCategory,
      shopId: product.shopId,
      categoryId: product.categoryId,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(
      and(
        eq(shop.ownerId, data.userId),
        eq(product.shopId, data.shopId),
        inArray(product.id, data.productIds),
      ),
    )

  if (ownedProducts.length === 0) {
    return { deleted: 0 }
  }

  const ownedIds = ownedProducts.map((p) => p.id)

  if (data.hard) {
    const oldImages = await db
      .select({ productId: productImage.productId, url: productImage.url })
      .from(productImage)
      .where(inArray(productImage.productId, ownedIds))

    await db.transaction(async (tx) => {
      await tx.delete(product).where(inArray(product.id, ownedIds))

      await tx.insert(meilisearchSyncQueue).values(
        ownedIds.map((productId) => ({
          productId,
          action: 'delete' as const,
        })),
      )
    })

    for (const img of oldImages) {
      if (extractKeyFromUrl(img.url) === null) continue
      try {
        await deleteImageFromStorage(img.url)
      } catch (err) {
        logger.error(`Failed to delete product image from S3: ${img.url}`, err)
      }
    }

    import('../meilisearch-products.server')
      .then(async ({ removeProductFromMeilisearch }) => {
        for (const productId of ownedIds) {
          try {
            await removeProductFromMeilisearch(productId)
            await db
              .update(meilisearchSyncQueue)
              .set({ status: 'completed', updatedAt: new Date() })
              .where(
                and(
                  eq(meilisearchSyncQueue.productId, productId),
                  eq(meilisearchSyncQueue.action, 'delete'),
                ),
              )
          } catch {
            // ignored, background poller will pick it up
          }
        }
      })
      .catch(() => {})
  } else {
    await db.transaction(async (tx) => {
      await tx
        .update(product)
        .set({ status: 'archived', isActive: false, updatedAt: new Date() })
        .where(inArray(product.id, ownedIds))

      await tx.insert(meilisearchSyncQueue).values(
        ownedIds.map((productId) => ({
          productId,
          action: 'delete' as const,
        })),
      )
    })

    import('../meilisearch-products.server')
      .then(async ({ removeProductFromMeilisearch }) => {
        for (const p of ownedProducts) {
          try {
            await removeProductFromMeilisearch(p.id)
            await db
              .update(meilisearchSyncQueue)
              .set({ status: 'completed', updatedAt: new Date() })
              .where(
                and(
                  eq(meilisearchSyncQueue.productId, p.id),
                  eq(meilisearchSyncQueue.action, 'delete'),
                ),
              )
          } catch {
            // ignored, background poller will pick it up
          }
        }
      })
      .catch(() => {})
  }

  if (actor) {
    for (const p of ownedProducts) {
      await writeAuditLog({
        actor,
        action: 'product_deleted',
        resourceType: 'product',
        resourceId: p.id,
        metadata: { shopId: p.shopId, name: p.name, hard: data.hard },
      })
    }
  }

  return { deleted: ownedIds.length }
}

/* -------------------------------------------------------------------------- */
/*                              Low Stock Notifications                       */
/* -------------------------------------------------------------------------- */

export async function notifyLowStockIfNeeded(productId: string): Promise<void> {
  const [productRecord] = await db
    .select({
      productId: product.id,
      name: product.name,
      stockCount: product.stockCount,
      lowStockThreshold: product.lowStockThreshold,
      shopId: product.shopId,
      ownerId: shop.ownerId,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(eq(product.id, productId))
    .limit(1)

  if (!productRecord) return

  const variantStockResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${productVariant.stockCount}), 0)` })
    .from(productVariant)
    .where(eq(productVariant.productId, productId))

  const totalVariantStock = Number(variantStockResult[0]?.total ?? 0)
  const totalStock = totalVariantStock > 0 ? totalVariantStock : productRecord.stockCount

  if (totalStock <= productRecord.lowStockThreshold) {
    try {
      await createNotification(productRecord.ownerId, 'low_stock', {
        productId,
        productName: productRecord.name,
        shopId: productRecord.shopId,
        stockCount: totalStock,
        threshold: productRecord.lowStockThreshold,
      })
    } catch (err) {
      logger.error(`Failed to create low-stock notification for product ${productId}`, err, {
        alert: true,
        productId,
      })
    }
  }
}
