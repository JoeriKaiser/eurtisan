import z from 'zod'

export const productVariantOptionValueSchema = z.object({
  optionId: z.string().min(1),
  optionValueId: z.string().min(1),
})

export const createProductOptionSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(100),
  values: z.array(z.string().min(1).max(100)).min(1).max(50),
})

export const updateProductOptionSchema = z.object({
  optionId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  values: z.array(z.string().min(1).max(100)).min(1).max(50).optional(),
})

export const deleteProductOptionSchema = z.object({
  optionId: z.string().min(1),
})

export const createProductVariantSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(255),
  sku: z.string().max(255).optional().nullable(),
  priceAdjustmentCents: z.number().int().min(-100_000_000).optional().default(0),
  stockCount: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  optionValueIds: z.array(z.string().min(1)).min(1),
})

export const updateProductVariantSchema = z.object({
  variantId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  sku: z.string().max(255).optional().nullable(),
  priceAdjustmentCents: z.number().int().min(-100_000_000).optional(),
  stockCount: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  optionValueIds: z.array(z.string().min(1)).min(1).optional(),
})

export const deleteProductVariantSchema = z.object({
  variantId: z.string().min(1),
})

export const getProductVariantDetailSchema = z.object({
  productId: z.string().min(1),
})

export const ensureVariantMatrixSchema = z.object({
  productId: z.string().min(1),
})
