import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import z from 'zod'

import { db } from '#/db/index'
import { shop, shopOrder } from '#/db/schema'
import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'
import { getShopOrderQuery, updateShopOrderStatusQuery } from '#/lib/shop-orders.server'
import { validatePlainText } from '#/lib/xss'

export const Route = createFileRoute('/api/shops/$shopId/orders/$shopOrderId')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipeline(request, [], async (ctx) => {
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

      POST: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            let body: unknown
            try {
              body = await request.json()
            } catch {
              return new Response(
                JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              )
            }

            const schema = z.object({
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
            })

            const parsed = schema.safeParse(body)
            if (!parsed.success) {
              return new Response(
                JSON.stringify({
                  error: 'Bad Request',
                  message: parsed.error.errors.map((e) => e.message).join(', '),
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              )
            }

            const order = await getShopOrderQuery(params.shopOrderId)
            if (!order || order.shopId !== params.shopId) {
              return new Response(
                JSON.stringify({ error: 'Not Found', message: 'Order not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } },
              )
            }

            try {
              const updated = await updateShopOrderStatusQuery(params.shopOrderId, parsed.data)
              return new Response(JSON.stringify(updated), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            } catch (err) {
              if (err instanceof Response) {
                return err
              }
              throw err
            }
          },
        ),

      PUT: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            let body: unknown
            try {
              body = await request.json()
            } catch {
              return new Response(
                JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              )
            }

            const schema = z.object({
              trackingNumber: z.string().optional().nullable(),
              trackingUrl: z.string().url().optional().nullable(),
            })

            const parsed = schema.safeParse(body)
            if (!parsed.success) {
              return new Response(
                JSON.stringify({
                  error: 'Bad Request',
                  message: parsed.error.errors.map((e) => e.message).join(', '),
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              )
            }

            const order = await getShopOrderQuery(params.shopOrderId)
            if (!order || order.shopId !== params.shopId) {
              return new Response(
                JSON.stringify({ error: 'Not Found', message: 'Order not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } },
              )
            }

            const validatedTrackingNumber = parsed.data.trackingNumber
              ? validatePlainText(parsed.data.trackingNumber, 'Tracking number')
              : (parsed.data.trackingNumber ?? null)

            await db
              .update(shopOrder)
              .set({
                trackingNumber: validatedTrackingNumber,
                trackingUrl: parsed.data.trackingUrl ?? null,
                updatedAt: new Date(),
              })
              .where(eq(shopOrder.id, params.shopOrderId))

            const updated = await getShopOrderQuery(params.shopOrderId)
            return new Response(JSON.stringify(updated), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        ),
    },
  },
})
