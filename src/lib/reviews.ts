import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './auth-middleware'

export type {
  CreatedReview,
  ProductReview,
  ProductReviewsResult,
  ReviewableItem,
  ReviewEligibilityResult,
} from './reviews.server'

export const getReviewableItems = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ platformOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getReviewableItemsQuery } = await import('./reviews.server')
    const result = await getReviewableItemsQuery(data.platformOrderId, context.user.id)

    if (!result) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return result
  })

export const getProductReviews = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      productId: z.string().min(1),
      page: z.number().int().min(1).optional().default(1),
      pageSize: z.number().int().min(1).max(100).optional().default(10),
    }),
  )
  .handler(async ({ data }) => {
    const { getProductReviewsQuery } = await import('./reviews.server')
    return getProductReviewsQuery(data.productId, data.page, data.pageSize)
  })

export const createReview = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopOrderId: z.string().uuid(),
      productId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { createReviewQuery } = await import('./reviews.server')
    return createReviewQuery(
      data.shopOrderId,
      data.productId,
      context.user.id,
      data.rating,
      data.comment ?? null,
    )
  })
