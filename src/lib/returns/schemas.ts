import z from 'zod'

export const DIMINISHED_VALUE_CATEGORIES = [
  'worn_washed',
  'scratched_damaged',
  'missing_packaging',
  'broken_seal',
  'structural_damage',
] as const

export const createReturnRequestSchema = z.object({
  shopOrderId: z.string().uuid(),
  type: z.enum(['withdrawal', 'defective']),
  reason: z.string().trim().min(10).max(2000),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
})

export const updateReturnShipmentSchema = z.object({
  returnRequestId: z.string().uuid(),
  carrier: z.string().trim().min(2).max(100),
  trackingNumber: z.string().trim().min(3).max(200),
})

export const manageReturnRequestSchema = z.object({
  returnRequestId: z.string().uuid(),
  action: z.enum(['authorize', 'reject', 'mark_received', 'refund', 'close']),
  reason: z.string().trim().max(2000).optional(),
  diminishedValueCents: z.number().int().min(0).optional(),
  diminishedValueReason: z.string().trim().max(2000).optional(),
  diminishedValueCategory: z.enum(DIMINISHED_VALUE_CATEGORIES).optional(),
  diminishedValueEvidenceUrls: z.array(z.string().url()).max(10).optional(),
  restockItems: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        restock: z.boolean(),
      }),
    )
    .optional(),
})

export const addReturnMessageSchema = z.object({
  returnRequestId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
})
