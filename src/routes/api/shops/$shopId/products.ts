import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { product } from '#/db/schema'
import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'
import { createProductInternal, createProductSchema } from '#/lib/products'

export const Route = createFileRoute('/api/shops/$shopId/products')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const products = await db
              .select()
              .from(product)
              .where(eq(product.shopId, params.shopId))
            return new Response(
              JSON.stringify({
                shopId: params.shopId,
                message: 'Product list',
                products,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          },
        ),
      POST: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const body = await request.json().catch(() => ({}))
            const parsed = createProductSchema.safeParse(body)

            if (!parsed.success) {
              return new Response(
                JSON.stringify({
                  error: 'Validation failed',
                  issues: parsed.error.issues,
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            try {
              const newProduct = await createProductInternal({
                ...parsed.data,
                shopId: params.shopId,
              })

              return new Response(
                JSON.stringify({
                  shopId: params.shopId,
                  message: 'Product created',
                  product: newProduct,
                }),
                {
                  status: 201,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            } catch (err) {
              if (err instanceof Error && err.message.includes('already exists')) {
                return new Response(
                  JSON.stringify({
                    error: 'Conflict',
                    message: err.message,
                  }),
                  {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                  },
                )
              }
              throw err
            }
          },
        ),
    },
  },
})
