import z from 'zod'

export const openDisputeSchema = z.object({
  shopOrderId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
})

export const addDisputeMessageSchema = z.object({
  disputeId: z.string().uuid(),
  message: z.string().min(1).max(5000),
})

export const resolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  resolution: z.enum(['close', 'partial_refund', 'full_refund']),
  refundCents: z.number().int().min(0).optional().nullable(),
})

export const listOpenDisputesInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(['all', 'open', 'resolved']).optional().default('open'),
  query: z.string().optional(),
})
