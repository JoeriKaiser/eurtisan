/**
 * Prometheus metrics scrape endpoint.
 *
 * When METRICS_TOKEN is set, requests must send Authorization: Bearer <token>.
 */
import { createFileRoute } from '@tanstack/react-router'
import { getMetricsBody, metricsContentType } from '#/lib/metrics.server'

function isAuthorized(request: Request): boolean {
  const token = process.env.METRICS_TOKEN
  if (!token) {
    return true
  }
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${token}`
}

export async function getMetricsResponse(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await getMetricsBody()
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': metricsContentType,
      'Cache-Control': 'no-store',
    },
  })
}

export const Route = createFileRoute('/api/metrics')({
  server: {
    handlers: {
      GET: async ({ request }) => getMetricsResponse(request),
    },
  },
})
