import { createFileRoute } from '@tanstack/react-router'

import { listProductsByCategorySlugQuery } from '#/lib/products.server'

export const Route = createFileRoute('/api/products')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const categorySlug = url.searchParams.get('category')
        const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')),
        )

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

        const result = await listProductsByCategorySlugQuery(categorySlug, {
          page,
          pageSize,
        })

        return new Response(
          JSON.stringify({
            categorySlug,
            ...result,
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
