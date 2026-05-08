import { createFileRoute } from '@tanstack/react-router'

import { listProductsByCategorySlugQuery } from '#/lib/products'

export const Route = createFileRoute('/api/products')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const categorySlug = url.searchParams.get('category')

        if (!categorySlug) {
          return new Response(
            JSON.stringify({
              error: 'Bad Request',
              message: 'category query parameter is required',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        const products = await listProductsByCategorySlugQuery(categorySlug)

        return new Response(
          JSON.stringify({
            categorySlug,
            products,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    },
  },
})
