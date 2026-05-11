import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/index'
import { shop } from '#/db/schema'
import { authMiddleware } from './auth-middleware'

export type { ShopOrderDetail, ShopOrderItemDetail, ShopOrderListItem } from './shop-orders.server'

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
    let isOwner = false
    if (!isAdmin) {
      const shopRecord = await db.query.shop.findFirst({
        where: eq(shop.id, order.shopId),
      })
      isOwner = shopRecord?.ownerId === context.user.id
    }
    const isBuyer = order.buyer.id === context.user.id

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
    let isOwner = false
    if (!isAdmin) {
      const shopRecord = await db.query.shop.findFirst({
        where: eq(shop.id, order.shopId),
      })
      isOwner = shopRecord?.ownerId === context.user.id
    }

    if (!isAdmin && !isOwner) {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to update this order',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return updateShopOrderStatusQuery(data.shopOrderId, {
      status: data.status,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
    })
  })

export const listShopOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1),
      status: z.string().optional(),
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

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { listShopOrdersQuery } = await import('./shop-orders.server')
    return listShopOrdersQuery(data.shopId, {
      status: data.status,
      page: data.page,
      pageSize: data.pageSize,
    })
  })
