import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/robots/txt')({
  server: {
    handlers: {
      GET: async () => {
        const { buildRobotsTxt } = await import('#/lib/robots-txt.server')
        const body = buildRobotsTxt()

        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        })
      },
    },
  },
})
