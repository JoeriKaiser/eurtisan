import { createFileRoute } from '@tanstack/react-router'

import { authPipelinePrivileged, requireRole, requireShopOwnership } from '#/lib/authz'
import { updateShopSchema } from '#/lib/shop-settings'
import { getCreatorShopQuery } from '#/lib/creator-dashboard.server'
import { SlugCollisionError, updateShopInternal } from '#/lib/shop-settings.server'

export const Route = createFileRoute('/api/shops/$shopId/settings')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipelinePrivileged(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async (ctx) => {
            const shop = await getCreatorShopQuery(ctx.user.id, params.shopId)
            if (!shop) {
              return new Response(JSON.stringify({ error: 'Not Found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              })
            }
            return new Response(JSON.stringify(shop), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        ),
      PATCH: async ({ request, params }) =>
        authPipelinePrivileged(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const raw = await request.json().catch(() => ({}))
            const parsed = updateShopSchema.safeParse({ ...raw, shopId: params.shopId })
            if (!parsed.success) {
              return new Response(
                JSON.stringify({ error: 'Bad Request', issues: parsed.error.issues }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              )
            }

            try {
              const { shopId, ...input } = parsed.data
              const record = await updateShopInternal(shopId, input)
              const response = {
                id: record.id,
                name: record.name,
                slug: record.slug,
                description: record.description,
                image: record.image,
                ownerId: record.ownerId,
                shippingOrigin:
                  (record.shippingOrigin as {
                    street: string
                    city: string
                    postalCode: string
                    country: string
                  } | null) ?? null,
                isVatRegistered: record.isVatRegistered,
                vatId: record.vatId,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
              }
              return new Response(JSON.stringify(response), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            } catch (err) {
              if (err instanceof SlugCollisionError) {
                return new Response(JSON.stringify({ error: 'Conflict', message: err.message }), {
                  status: 409,
                  headers: { 'Content-Type': 'application/json' },
                })
              }
              throw err
            }
          },
        ),
    },
  },
})
