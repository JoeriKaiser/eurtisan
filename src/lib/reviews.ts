import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type {
  CreatedReview,
  ProductReview,
  ProductReviewsResult,
  ReviewableItem,
  ReviewEligibilityResult,
  AdminReview,
  AdminReviewsResult,
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

export const reportReview = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      reviewId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { reportReviewQuery } = await import('./reviews.server')
    await reportReviewQuery(data.reviewId, context.user.id)
    return { success: true }
  })

export const getAdminReviews = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      status: z.enum(['all', 'approved', 'flagged', 'hidden']).default('all'),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (context.user.role !== 'admin') {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { getAdminReviewsQuery } = await import('./reviews.server')
    return getAdminReviewsQuery(data.status, data.page, data.pageSize)
  })

export const updateReviewModerationStatus = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      reviewId: z.string().uuid(),
      status: z.enum(['approved', 'flagged', 'hidden']),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (context.user.role !== 'admin') {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { updateReviewModerationStatusQuery } = await import('./reviews.server')
    await updateReviewModerationStatusQuery(data.reviewId, data.status)
    return { success: true }
  })
