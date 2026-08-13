import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemap/xml')({
  server: {
    handlers: {
      GET: async () => {
        const { getSitemap } = await import('#/lib/sitemap.server')
        const xml = await getSitemap()

        return new Response(xml, {
          status: 200,
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        })
      },
    },
  },
})
