import { createFileRoute } from '@tanstack/react-router'
import { buildRobotsTxt } from '#/lib/robots-txt.server'

export const Route = createFileRoute('/robots/txt')({
  server: {
    handlers: {
      GET: () => {
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
