import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { isValidOrderNumber } from './order-numbers'

export type {
  BuyerOrderListItem,
  BuyerOrderShopSummary,
  OrderDetail,
  OrderItemDetail,
  OrderShopGroup,
  OrderStatus,
} from './orders.server'

export const getBuyerOrderDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getBuyerOrderDetailQuery, getOrderOwnerId } = await import('./orders.server')
    const result = await getBuyerOrderDetailQuery(data.orderId, context.user.id)

    if (!result) {
      const ownerId = await getOrderOwnerId(data.orderId)
      if (ownerId && ownerId !== context.user.id) {
        throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return result
  })

export const getBuyerOrderDetailByOrderNumber = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orderNumber: z
        .string()
        .min(1)
        .refine(isValidOrderNumber, { message: 'Invalid order number' }),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getBuyerOrderDetailByOrderNumberQuery } = await import('./orders.server')
    const result = await getBuyerOrderDetailByOrderNumberQuery(data.orderNumber, context.user.id)

    if (!result) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return result
  })

export const listBuyerOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { listBuyerOrdersQuery } = await import('./orders.server')
    return listBuyerOrdersQuery(context.user.id, data.limit, data.offset)
  })
