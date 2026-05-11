import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { shop } from '#/db/schema'
import { authPipeline, requireAuth } from '#/lib/authz'
import { getShopOrderQuery } from '#/lib/shop-orders.server'

export const Route = createFileRoute('/api/shops/$shopId/orders/$shopOrderId')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipeline(request, [requireAuth], async (ctx) => {
          const order = await getShopOrderQuery(params.shopOrderId)

          if (!order) {
            return new Response(
              JSON.stringify({ error: 'Not Found', message: 'Order not found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            )
          }

          if (order.shopId !== params.shopId) {
            return new Response(
              JSON.stringify({ error: 'Not Found', message: 'Order not found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const isAdmin = ctx.user.role === 'admin'
          let isOwner = false
          if (!isAdmin) {
            const shopRecord = await db.query.shop.findFirst({
              where: eq(shop.id, order.shopId),
            })
            isOwner = shopRecord?.ownerId === ctx.user.id
          }
          const isBuyer = order.buyer.id === ctx.user.id

          if (!isAdmin && !isOwner && !isBuyer) {
            return new Response(
              JSON.stringify({
                error: 'Forbidden',
                message: 'You do not have permission to view this order',
              }),
              { status: 403, headers: { 'Content-Type': 'application/json' } },
            )
          }

          return new Response(JSON.stringify(order), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }),
    },
  },
})
