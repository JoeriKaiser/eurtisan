import z from 'zod'

import { extractKeyFromUrl, isExternalImageUrl } from '../image-url'
import { unitPriceBasisSchema } from './unit-pricing'

const imageKeyRegex = /^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/

export const productImageInputSchema = z.object({
  key: z
    .string()
    .min(1)
    .transform((value) => extractKeyFromUrl(value) ?? value)
    .refine((value) => imageKeyRegex.test(value) || isExternalImageUrl(value), {
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
  returnPolicy: z
    .enum(['standard', 'personalized', 'perishable', 'hygiene_sealed'])
    .optional()
    .default('standard'),
  weightGrams: z.coerce.number().int().positive().optional(),
  lengthCm: z.coerce.number().int().positive().optional(),
  widthCm: z.coerce.number().int().positive().optional(),
  heightCm: z.coerce.number().int().positive().optional(),
  volumeMl: z.coerce.number().int().positive().optional(),
  soldBy: unitPriceBasisSchema.optional(),
  images: z.array(productImageInputSchema).max(10).optional().default([]),
  status: z.enum(['draft', 'published']).default('draft'),
})

export const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
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
  status: z.enum(['all', 'draft', 'published', 'archived']).optional().default('all'),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
})

export const toggleProductActiveSchema = z.object({
  productId: z.string().min(1),
  shopId: z.string().min(1),
})

export const bulkToggleProductActiveSchema = z.object({
  shopId: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(1).max(100),
  isActive: z.boolean(),
})

export const bulkDeleteProductsSchema = z.object({
  shopId: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(1).max(100),
  hard: z.boolean().optional().default(false),
})

export const getCreatorProductDetailSchema = z.object({
  productId: z.string().min(1),
})

export const productLifecycleSchema = z.object({
  productId: z.string().min(1),
  shopId: z.string().min(1),
})
