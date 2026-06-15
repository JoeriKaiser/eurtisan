import { eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  product,
  productImage,
  productOption,
  productOptionValue,
  productVariant,
  productVariantOption,
  shop,
} from '#/db/schema'
import { validatePlainText } from './xss'
import type { AuditActor } from './audit-logger'
import { writeAuditLog } from './audit-logger'
import { notifyLowStockIfNeeded } from './creator-products.server'

export interface ProductOptionValueDetail {
  id: string
  value: string
  displayOrder: number
}

export interface ProductOptionDetail {
  id: string
  name: string
  displayOrder: number
  values: ProductOptionValueDetail[]
}

export interface ProductVariantDetail {
  id: string
  productId: string
  name: string
  sku: string | null
  priceAdjustmentCents: number
  stockCount: number
  isActive: boolean
  optionValueIds: string[]
  createdAt: Date
  updatedAt: Date
}

export interface ProductVariantMatrix {
  productId: string
  options: ProductOptionDetail[]
  variants: ProductVariantDetail[]
}

export async function verifyProductOwnershipForVariants(productId: string, userId: string) {
  const [record] = await db
    .select({ productId: product.id, shopId: product.shopId, shopOwnerId: shop.ownerId })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(eq(product.id, productId))
    .limit(1)

  if (!record) {
    throw new Error('NOT_FOUND')
  }

  if (record.shopOwnerId !== userId) {
    throw new Error('FORBIDDEN')
  }

  return record
}

export async function getProductVariantMatrix(productId: string): Promise<ProductVariantMatrix> {
  const [options, variants] = await Promise.all([
    db
      .select({
        id: productOption.id,
        name: productOption.name,
        displayOrder: productOption.displayOrder,
      })
      .from(productOption)
      .where(eq(productOption.productId, productId))
      .orderBy(productOption.displayOrder),
    db
      .select({
        id: productVariant.id,
        productId: productVariant.productId,
        name: productVariant.name,
        sku: productVariant.sku,
        priceAdjustmentCents: productVariant.priceAdjustmentCents,
        stockCount: productVariant.stockCount,
        isActive: productVariant.isActive,
        createdAt: productVariant.createdAt,
        updatedAt: productVariant.updatedAt,
      })
      .from(productVariant)
      .where(eq(productVariant.productId, productId))
      .orderBy(productVariant.createdAt),
  ])

  const optionIds = options.map((o) => o.id)
  const optionValues = optionIds.length
    ? await db
        .select({
          id: productOptionValue.id,
          optionId: productOptionValue.optionId,
          value: productOptionValue.value,
          displayOrder: productOptionValue.displayOrder,
        })
        .from(productOptionValue)
        .where(inArray(productOptionValue.optionId, optionIds))
        .orderBy(productOptionValue.displayOrder)
    : []

  const variantIds = variants.map((v) => v.id)
  const variantOptions = variantIds.length
    ? await db
        .select({
          variantId: productVariantOption.variantId,
          optionValueId: productVariantOption.optionValueId,
        })
        .from(productVariantOption)
        .where(inArray(productVariantOption.variantId, variantIds))
    : []

  const valuesByOption = new Map<string, ProductOptionValueDetail[]>()
  for (const ov of optionValues) {
    const list = valuesByOption.get(ov.optionId) ?? []
    list.push({ id: ov.id, value: ov.value, displayOrder: ov.displayOrder })
    valuesByOption.set(ov.optionId, list)
  }

  const optionValueIdsByVariant = new Map<string, string[]>()
  for (const vo of variantOptions) {
    const list = optionValueIdsByVariant.get(vo.variantId) ?? []
    list.push(vo.optionValueId)
    optionValueIdsByVariant.set(vo.variantId, list)
  }

  return {
    productId,
    options: options.map((o) => ({
      ...o,
      values: valuesByOption.get(o.id) ?? [],
    })),
    variants: variants.map((v) => ({
      ...v,
      optionValueIds: optionValueIdsByVariant.get(v.id) ?? [],
    })),
  }
}

function sanitizeOptionName(name: string): string {
  return validatePlainText(name, 'Option name')
}

function sanitizeOptionValue(value: string): string {
  return validatePlainText(value, 'Option value')
}

export async function createProductOptionQuery(
  productId: string,
  input: { name: string; values: string[] },
  actor?: AuditActor,
) {
  const sanitizedName = sanitizeOptionName(input.name)
  const sanitizedValues = input.values.map(sanitizeOptionValue)

  const created = await db.transaction(async (tx) => {
    const [option] = await tx
      .insert(productOption)
      .values({
        id: crypto.randomUUID(),
        productId,
        name: sanitizedName,
      })
      .returning()

    if (sanitizedValues.length > 0) {
      await tx.insert(productOptionValue).values(
        sanitizedValues.map((value, index) => ({
          id: crypto.randomUUID(),
          optionId: option.id,
          value,
          displayOrder: index,
        })),
      )
    }

    return option
  })

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_option_created',
      resourceType: 'product_option',
      resourceId: created.id,
      metadata: { productId, name: sanitizedName },
    })
  }

  return created
}

export async function updateProductOptionQuery(
  optionId: string,
  input: { name?: string; values?: string[] },
  actor?: AuditActor,
) {
  const existing = await db
    .select({ id: productOption.id, productId: productOption.productId, name: productOption.name })
    .from(productOption)
    .where(eq(productOption.id, optionId))
    .limit(1)

  if (!existing[0]) {
    throw new Error('NOT_FOUND')
  }

  const sanitizedName = input.name ? sanitizeOptionName(input.name) : undefined

  await db.transaction(async (tx) => {
    if (sanitizedName !== undefined) {
      await tx
        .update(productOption)
        .set({ name: sanitizedName })
        .where(eq(productOption.id, optionId))
    }

    if (input.values !== undefined) {
      const sanitizedValues = input.values.map(sanitizeOptionValue)
      await tx.delete(productOptionValue).where(eq(productOptionValue.optionId, optionId))
      if (sanitizedValues.length > 0) {
        await tx.insert(productOptionValue).values(
          sanitizedValues.map((value, index) => ({
            id: crypto.randomUUID(),
            optionId,
            value,
            displayOrder: index,
          })),
        )
      }
    }
  })

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_option_updated',
      resourceType: 'product_option',
      resourceId: optionId,
      metadata: { productId: existing[0].productId, name: sanitizedName ?? existing[0].name },
    })
  }

  return getProductVariantMatrix(existing[0].productId)
}

export async function deleteProductOptionQuery(optionId: string, actor?: AuditActor) {
  const existing = await db
    .select({ id: productOption.id, productId: productOption.productId, name: productOption.name })
    .from(productOption)
    .where(eq(productOption.id, optionId))
    .limit(1)

  if (!existing[0]) {
    throw new Error('NOT_FOUND')
  }

  await db.delete(productOption).where(eq(productOption.id, optionId))

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_option_deleted',
      resourceType: 'product_option',
      resourceId: optionId,
      metadata: { productId: existing[0].productId, name: existing[0].name },
    })
  }

  return getProductVariantMatrix(existing[0].productId)
}

export async function createProductVariantQuery(
  productId: string,
  input: {
    name: string
    sku?: string | null
    priceAdjustmentCents?: number
    stockCount?: number
    isActive?: boolean
    optionValueIds: string[]
  },
  actor?: AuditActor,
) {
  const sanitizedName = validatePlainText(input.name, 'Variant name')
  const sanitizedSku = input.sku ? validatePlainText(input.sku, 'SKU') : input.sku

  const created = await db.transaction(async (tx) => {
    const [variant] = await tx
      .insert(productVariant)
      .values({
        id: crypto.randomUUID(),
        productId,
        name: sanitizedName,
        sku: sanitizedSku ?? null,
        priceAdjustmentCents: input.priceAdjustmentCents ?? 0,
        stockCount: input.stockCount ?? 0,
        isActive: input.isActive ?? true,
      })
      .returning()

    if (input.optionValueIds.length > 0) {
      await tx.insert(productVariantOption).values(
        input.optionValueIds.map((optionValueId) => ({
          variantId: variant.id,
          optionValueId,
        })),
      )
    }

    return variant
  })

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_variant_created',
      resourceType: 'product_variant',
      resourceId: created.id,
      metadata: { productId, name: sanitizedName },
    })
  }

  return created
}

export async function updateProductVariantQuery(
  variantId: string,
  input: {
    name?: string
    sku?: string | null
    priceAdjustmentCents?: number
    stockCount?: number
    isActive?: boolean
    optionValueIds?: string[]
  },
  actor?: AuditActor,
) {
  const existing = await db
    .select()
    .from(productVariant)
    .where(eq(productVariant.id, variantId))
    .limit(1)

  if (!existing[0]) {
    throw new Error('NOT_FOUND')
  }

  const sanitizedName = input.name ? validatePlainText(input.name, 'Variant name') : undefined
  const sanitizedSku =
    input.sku === null ? null : input.sku ? validatePlainText(input.sku, 'SKU') : undefined

  await db.transaction(async (tx) => {
    const updateData: Partial<typeof productVariant.$inferInsert> = { updatedAt: new Date() }
    if (sanitizedName !== undefined) updateData.name = sanitizedName
    if (sanitizedSku !== undefined) updateData.sku = sanitizedSku
    if (input.priceAdjustmentCents !== undefined)
      updateData.priceAdjustmentCents = input.priceAdjustmentCents
    if (input.stockCount !== undefined) updateData.stockCount = input.stockCount
    if (input.isActive !== undefined) updateData.isActive = input.isActive

    await tx.update(productVariant).set(updateData).where(eq(productVariant.id, variantId))

    if (input.optionValueIds !== undefined) {
      await tx.delete(productVariantOption).where(eq(productVariantOption.variantId, variantId))
      if (input.optionValueIds.length > 0) {
        await tx.insert(productVariantOption).values(
          input.optionValueIds.map((optionValueId) => ({
            variantId,
            optionValueId,
          })),
        )
      }
    }
  })

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_variant_updated',
      resourceType: 'product_variant',
      resourceId: variantId,
      metadata: { productId: existing[0].productId, name: sanitizedName ?? existing[0].name },
    })
  }

  if (input.stockCount !== undefined) {
    await notifyLowStockIfNeeded(existing[0].productId)
  }

  return getProductVariantMatrix(existing[0].productId)
}

export async function deleteProductVariantQuery(variantId: string, actor?: AuditActor) {
  const existing = await db
    .select()
    .from(productVariant)
    .where(eq(productVariant.id, variantId))
    .limit(1)

  if (!existing[0]) {
    throw new Error('NOT_FOUND')
  }

  await db.delete(productVariant).where(eq(productVariant.id, variantId))

  if (actor) {
    await writeAuditLog({
      actor,
      action: 'product_variant_deleted',
      resourceType: 'product_variant',
      resourceId: variantId,
      metadata: { productId: existing[0].productId, name: existing[0].name },
    })
  }

  return getProductVariantMatrix(existing[0].productId)
}

/**
 * Generates all missing variant combinations from the current options.
 * Existing variants are left untouched.
 */
export async function ensureVariantMatrixQuery(productId: string, actor?: AuditActor) {
  const matrix = await getProductVariantMatrix(productId)

  const valueIdsByOption = matrix.options.map((option) => option.values.map((v) => v.id))

  function cartesianProduct<T>(arrays: T[][]): T[][] {
    return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]])
  }

  const combinations = cartesianProduct(valueIdsByOption)
  if (combinations.length === 0) {
    return matrix
  }

  const existingSignatures = new Set(
    matrix.variants.map((v) => [...v.optionValueIds].sort().join(',')),
  )

  const missing = combinations.filter(
    (combo) => !existingSignatures.has([...combo].sort().join(',')),
  )

  if (missing.length === 0) {
    return matrix
  }

  const optionValueMap = new Map<string, { optionName: string; value: string }>()
  for (const option of matrix.options) {
    for (const ov of option.values) {
      optionValueMap.set(ov.id, { optionName: option.name, value: ov.value })
    }
  }

  await db.transaction(async (tx) => {
    for (const combo of missing) {
      const name = combo.map((id) => optionValueMap.get(id)?.value ?? id).join(' / ')
      const [variant] = await tx
        .insert(productVariant)
        .values({
          id: crypto.randomUUID(),
          productId,
          name,
          sku: null,
          priceAdjustmentCents: 0,
          stockCount: 0,
          isActive: true,
        })
        .returning()

      await tx.insert(productVariantOption).values(
        combo.map((optionValueId) => ({
          variantId: variant.id,
          optionValueId,
        })),
      )
    }
  })

  if (actor && missing.length > 0) {
    await writeAuditLog({
      actor,
      action: 'product_variants_generated',
      resourceType: 'product',
      resourceId: productId,
      metadata: { generatedCount: missing.length },
    })
  }

  return getProductVariantMatrix(productId)
}

export async function getCreatorProductDetailWithVariantsInternal(
  productId: string,
  userId: string,
) {
  const [productRecord, images, matrix] = await Promise.all([
    verifyProductOwnershipForVariants(productId, userId),
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
    getProductVariantMatrix(productId),
  ])

  return { ...productRecord, images, ...matrix }
}
