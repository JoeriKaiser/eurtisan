import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'
import { requirePrivileged2FA } from './server-auth'
import {
  addReturnMessageSchema,
  createReturnRequestSchema,
  manageReturnRequestSchema,
  updateReturnShipmentSchema,
} from './returns/schemas'

export type { ReturnRequestStatus, ReturnRequestSummary } from './returns/types'
export { createReturnRequestSchema, updateReturnShipmentSchema } from './returns/schemas'

async function resolveBuyerAccess(
  returnRequestId: string,
  userId?: string,
): Promise<{ buyerUserId: string; platformOrderId: string }> {
  const { getReturnAccessContextQuery } = await import('./returns.server')
  const access = await getReturnAccessContextQuery(returnRequestId)
  if (!access) throw new Response(null, { status: 404 })
  const { canAccessOrder } = await import('./checkout/guest-access.server')
  if (!(await canAccessOrder(access.platformOrderId, userId))) {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return access
}

export const createReturnRequest = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createReturnRequestSchema)
  .handler(async ({ context, data }) => {
    const { getShopOrderPlatformOrderId, getOrderOwnerId } = await import('./orders.server')
    const platformOrderId = await getShopOrderPlatformOrderId(data.shopOrderId)
    if (!platformOrderId) throw new Response(null, { status: 404 })
    const { canAccessOrder } = await import('./checkout/guest-access.server')
    if (!(await canAccessOrder(platformOrderId, context.user?.id))) {
      throw new Response(null, { status: 403 })
    }
    const buyerUserId = await getOrderOwnerId(platformOrderId)
    if (!buyerUserId) throw new Response(null, { status: 404 })
    const { createReturnRequestQuery } = await import('./returns.server')
    return createReturnRequestQuery(data, buyerUserId)
  })

export const getReturnRequest = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ returnRequestId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (context.user?.role === 'admin' || context.user?.role === 'creator') {
      requirePrivileged2FA(context.user as SafeUser)
      const { getReturnRequestQuery } = await import('./returns.server')
      return getReturnRequestQuery(data.returnRequestId, context.user.id, context.user.role)
    }
    const access = await resolveBuyerAccess(data.returnRequestId, context.user?.id)
    const { getReturnRequestQuery } = await import('./returns.server')
    return getReturnRequestQuery(data.returnRequestId, access.buyerUserId, 'customer')
  })

export const listOrderReturns = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ platformOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { canAccessOrder } = await import('./checkout/guest-access.server')
    if (!(await canAccessOrder(data.platformOrderId, context.user?.id))) {
      throw new Response(null, { status: 403 })
    }
    const { getOrderOwnerId } = await import('./orders.server')
    const buyerUserId = await getOrderOwnerId(data.platformOrderId)
    if (!buyerUserId) throw new Response(null, { status: 404 })
    const { listOrderReturnsQuery } = await import('./returns.server')
    return listOrderReturnsQuery(data.platformOrderId, buyerUserId)
  })

export const listShopOrderReturns = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user || !['creator', 'admin'].includes(context.user.role)) {
      throw new Response(null, { status: 403 })
    }
    requirePrivileged2FA(context.user as SafeUser)
    const { listShopOrderReturnsQuery } = await import('./returns.server')
    return listShopOrderReturnsQuery(data.shopOrderId, {
      userId: context.user.id,
      role: context.user.role,
    })
  })

export const updateReturnShipment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateReturnShipmentSchema)
  .handler(async ({ context, data }) => {
    const access = await resolveBuyerAccess(data.returnRequestId, context.user?.id)
    const { updateReturnShipmentQuery } = await import('./returns.server')
    return updateReturnShipmentQuery(data, access.buyerUserId)
  })

export const manageReturnRequest = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(manageReturnRequestSchema)
  .handler(async ({ context, data }) => {
    if (!context.user || !['creator', 'admin'].includes(context.user.role)) {
      throw new Response(null, { status: 403 })
    }
    requirePrivileged2FA(context.user as SafeUser)
    const { manageReturnRequestQuery } = await import('./returns.server')
    return manageReturnRequestQuery(data, {
      userId: context.user.id,
      role: context.user.role,
    })
  })

export const addReturnMessage = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(addReturnMessageSchema)
  .handler(async ({ context, data }) => {
    if (context.user?.role === 'creator' || context.user?.role === 'admin') {
      requirePrivileged2FA(context.user as SafeUser)
      const { addReturnMessageQuery } = await import('./returns.server')
      return addReturnMessageQuery(data, {
        userId: context.user.id,
        role: context.user.role,
      })
    }
    const access = await resolveBuyerAccess(data.returnRequestId, context.user?.id)
    const { addReturnMessageQuery } = await import('./returns.server')
    return addReturnMessageQuery(data, { userId: access.buyerUserId, role: 'customer' })
  })
