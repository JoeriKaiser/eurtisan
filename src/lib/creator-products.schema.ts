import z from 'zod'

export const productImageInputSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/, {
      message: 'Invalid image key format',
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
  priceCents: z.number().int().positive().max(1_000_000_00),
  stockCount: z.number().int().min(0).default(0),
  categoryId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
  vatRateCategory: z.enum(['standard', 'reduced', 'exempt']).optional().default('standard'),
  weightGrams: z.coerce.number().int().positive().optional(),
  lengthCm: z.coerce.number().int().positive().optional(),
  widthCm: z.coerce.number().int().positive().optional(),
  heightCm: z.coerce.number().int().positive().optional(),
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
  search: z.string().max(200).optional(),
})

export const toggleProductActiveSchema = z.object({
  productId: z.string().min(1),
  shopId: z.string().min(1),
})

export const getCreatorProductDetailSchema = z.object({
  productId: z.string().min(1),
})
