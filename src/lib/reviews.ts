import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'
import { requirePrivileged2FA } from './server-auth'

export type {
  AdminSellerReply,
  AdminSellerRepliesResult,
  AdminReview,
  AdminReviewsResult,
  CreatedReview,
  ProductReview,
  ProductReviewsResult,
  ReviewableItem,
  ReviewEligibilityResult,
  ReviewSort,
  SellerReply,
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
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      productId: z.string().min(1),
      page: z.number().int().min(1).optional().default(1),
      pageSize: z.number().int().min(1).max(100).optional().default(10),
      sort: z.enum(['newest', 'highest', 'lowest', 'helpful']).optional().default('newest'),
      rating: z.number().int().min(1).max(5).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    // Query modules access the database and must remain outside the client RPC bundle.
    const { getProductReviewsQuery } = await import('./reviews.server')
    return getProductReviewsQuery(
      data.productId,
      data.page,
      data.pageSize,
      data.sort,
      data.rating,
      context.user?.id,
    )
  })

export const setReviewHelpful = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ reviewId: z.string().uuid(), helpful: z.boolean() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    // Query modules access the database and must remain outside the client RPC bundle.

    const { setReviewHelpfulQuery } = await import('./reviews.server')
    return setReviewHelpfulQuery(data.reviewId, context.user.id, data.helpful)
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
      // DSA Article 16(2) requires a notice to carry a substantiated
      // explanation, so a ground is mandatory rather than optional. `details`
      // is where the substantiation goes when the ground alone is not enough.
      reason: z.enum(['not_authentic', 'offensive', 'spam', 'personal_data', 'other']),
      details: z.string().max(2000).nullable().optional(),
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
    return reportReviewQuery(data.reviewId, context.user.id, data.reason, data.details ?? null)
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
    requirePrivileged2FA(context.user as SafeUser)

    const [{ getAdminReviewsQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./reviews.server'),
      import('./audit-log.server'),
    ])
    const result = await getAdminReviewsQuery(data.status, data.page, data.pageSize)

    await emitAdminReadAudit(context.user, 'admin.read.review', 'review', undefined, {
      status: data.status,
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })

    return result
  })

export const updateReviewModerationStatus = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      reviewId: z.string().uuid(),
      status: z.enum(['approved', 'flagged', 'hidden']),
      // Required, not optional: without a ground and an explanation the DSA
      // Article 17(3) statement of reasons cannot be produced, and the decision
      // would go out with nothing to justify it.
      ground: z.enum(['illegal', 'terms']),
      explanation: z.string().min(1).max(2000),
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
    requirePrivileged2FA(context.user as SafeUser)

    const [{ updateReviewModerationStatusQuery }, { emitAuditEvent }] = await Promise.all([
      import('./reviews.server'),
      import('./audit-log.server'),
    ])
    await updateReviewModerationStatusQuery(data.reviewId, data.status, {
      ground: data.ground,
      explanation: data.explanation,
      actorUserId: context.user.id,
    })

    await emitAuditEvent(context.user, 'review.moderate', 'review', data.reviewId, {
      status: data.status,
      ground: data.ground,
    })

    return { success: true }
  })

export const createSellerReply = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ reviewId: z.string().uuid(), body: z.string().min(1).max(2000) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)
    const { createSellerReplyQuery } = await import('./reviews.server')
    await createSellerReplyQuery(data.reviewId, context.user.id, data.body)
    return { success: true }
  })

export const updateSellerReply = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ replyId: z.string().uuid(), body: z.string().min(1).max(2000) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)
    const { updateSellerReplyQuery } = await import('./reviews.server')
    await updateSellerReplyQuery(data.replyId, context.user.id, data.body)
    return { success: true }
  })

export const deleteSellerReply = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ replyId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)
    const { deleteSellerReplyQuery } = await import('./reviews.server')
    await deleteSellerReplyQuery(data.replyId, context.user.id)
    return { success: true }
  })

export const reportSellerReply = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      replyId: z.string().uuid(),
      reason: z.enum(['not_authentic', 'offensive', 'spam', 'personal_data', 'other']),
      details: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { reportSellerReplyQuery } = await import('./reviews.server')
    return reportSellerReplyQuery(data.replyId, context.user.id, data.reason, data.details ?? null)
  })

export const getAdminSellerReplies = createServerFn({ method: 'GET' })
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
    requirePrivileged2FA(context.user as SafeUser)
    const [{ getAdminSellerRepliesQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./reviews.server'),
      import('./audit-log.server'),
    ])
    const result = await getAdminSellerRepliesQuery(data.status, data.page, data.pageSize)
    await emitAdminReadAudit(context.user, 'admin.read.seller_reply', 'seller_reply', undefined, {
      status: data.status,
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })
    return result
  })

export const updateSellerReplyModerationStatus = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      replyId: z.string().uuid(),
      status: z.enum(['approved', 'flagged', 'hidden']),
      ground: z.enum(['illegal', 'terms']),
      legalBasis: z.string().min(1).max(2000),
      explanation: z.string().min(1).max(2000),
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
    requirePrivileged2FA(context.user as SafeUser)
    const [{ updateSellerReplyModerationStatusQuery }, { emitAuditEvent }] = await Promise.all([
      import('./reviews.server'),
      import('./audit-log.server'),
    ])
    await updateSellerReplyModerationStatusQuery(data.replyId, data.status, {
      ground: data.ground,
      legalBasis: data.legalBasis,
      explanation: data.explanation,
      actorUserId: context.user.id,
    })
    await emitAuditEvent(context.user, 'seller_reply.moderate', 'seller_reply', data.replyId, {
      status: data.status,
      ground: data.ground,
      legalBasis: data.legalBasis,
    })
    return { success: true }
  })
