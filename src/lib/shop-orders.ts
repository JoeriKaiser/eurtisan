import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'

export type { ShopOrderDetail, ShopOrderItemDetail, ShopOrderListItem } from './shop-orders.server'

const isShopOwner = createServerOnlyFn(async (shopId: string, userId: string): Promise<boolean> => {
  const [{ db }, { shop }, { eq }] = await Promise.all([
    import('#/db/index'),
    import('#/db/schema'),
    import('drizzle-orm'),
  ])
  const record = await db.query.shop.findFirst({
    where: eq(shop.id, shopId),
  })
  return record?.ownerId === userId
})

export const getShopOrder = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery } = await import('./shop-orders.server')
    const order = await getShopOrderQuery(data.shopOrderId)

    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)
    const isBuyer = order.buyer.id === context.user.id

    if (isAdmin || isOwner) {
      requirePrivileged2FA(context.user as SafeUser)
    }

    if (!isAdmin && !isOwner && !isBuyer) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to view this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return order
  })

export const updateShopOrderStatus = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopOrderId: z.string().uuid(),
      status: z.enum([
        'pending_payment',
        'paid',
        'processing',
        'shipped',
        'delivered',
        'completed',
        'cancelled',
        'refunded',
        'disputed',
      ]),
      trackingNumber: z.string().optional().nullable(),
      trackingUrl: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery, updateShopOrderStatusQuery } = await import('./shop-orders.server')

    const order = await getShopOrderQuery(data.shopOrderId)
    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to update this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return updateShopOrderStatusQuery(data.shopOrderId, {
      status: data.status,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
    })
  })

export const getShopOrderDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderDetailQuery } = await import('./shop-orders.server')
    const order = await getShopOrderDetailQuery(data.shopOrderId)

    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to view this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return order
  })

export const markShopOrderShipped = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopOrderId: z.string().uuid(),
      trackingNumber: z.string().optional().nullable(),
      trackingUrl: z.string().url().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery, markShopOrderShippedQuery } = await import('./shop-orders.server')

    const order = await getShopOrderQuery(data.shopOrderId)
    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to update this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return markShopOrderShippedQuery(data.shopOrderId, {
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
    })
  })

export const markShopOrderShippedWithLabel = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery, markShopOrderShippedWithLabelQuery } = await import(
      './shop-orders.server'
    )

    const order = await getShopOrderQuery(data.shopOrderId)
    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to update this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return markShopOrderShippedWithLabelQuery(data.shopOrderId)
  })

export const markShopOrderDelivered = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery, markShopOrderDeliveredQuery } = await import('./shop-orders.server')

    const order = await getShopOrderQuery(data.shopOrderId)
    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to update this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return markShopOrderDeliveredQuery(data.shopOrderId)
  })

export const refundShopOrder = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { refundShopOrderQuery } = await import('./shop-orders.server')
    requirePrivileged2FA(context.user as SafeUser)
    return refundShopOrderQuery(context.user.id, data.shopOrderId)
  })

export const cancelShopOrder = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopOrderId: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery, cancelShopOrderQuery } = await import('./shop-orders.server')

    const order = await getShopOrderQuery(data.shopOrderId)
    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to cancel this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return cancelShopOrderQuery(data.shopOrderId, { reason: data.reason })
  })

export const updateShopOrderTracking = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopOrderId: z.string().uuid(),
      trackingNumber: z.string().max(255).optional().nullable(),
      trackingUrl: z.string().url().max(2048).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery, updateShopOrderTrackingQuery } = await import('./shop-orders.server')

    const order = await getShopOrderQuery(data.shopOrderId)
    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to update this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return updateShopOrderTrackingQuery(data.shopOrderId, {
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
    })
  })

export const resolveShopOrderManualReview = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopOrderId: z.string().uuid(),
      resolution: z.enum(['paid', 'cancelled']),
      reason: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShopOrderQuery, resolveManualReviewQuery } = await import('./shop-orders.server')

    const order = await getShopOrderQuery(data.shopOrderId)
    if (!order) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = context.user.role === 'admin'
    const isOwner = isAdmin ? false : await isShopOwner(order.shopId, context.user.id)

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to resolve this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    requirePrivileged2FA(context.user as SafeUser)

    return resolveManualReviewQuery(data.shopOrderId, {
      resolution: data.resolution,
      reason: data.reason,
    })
  })

export const listShopOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1),
      status: z.string().optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { listShopOrdersQuery } = await import('./shop-orders.server')
    return listShopOrdersQuery(data.shopId, {
      status: data.status,
      search: data.search,
      page: data.page,
      pageSize: data.pageSize,
    })
  })
