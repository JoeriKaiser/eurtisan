/**
 * Prometheus metrics scrape endpoint.
 *
 * When METRICS_TOKEN is set, requests must send either:
 *   Authorization: Bearer <token>
 * or include the token in the `token` query parameter.
 *
 * The query-parameter fallback lets Prometheus scrape with a static
 * `params` configuration when header-based secrets are inconvenient to
 * inject; traffic between Prometheus and the app travels over the internal
 * Docker network only.
 */
import crypto from 'node:crypto'

import { createFileRoute } from '@tanstack/react-router'
import { getMetricsBody, metricsContentType } from '#/lib/metrics.server'

function timingSafeTokenCompare(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const providedBuf = Buffer.from(provided, 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (providedBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(providedBuf, expectedBuf)
}

function isAuthorized(request: Request): boolean {
  const token = process.env.METRICS_TOKEN
  if (!token) {
    return true
  }
  const auth = request.headers.get('authorization')
  if (auth && timingSafeTokenCompare(auth, `Bearer ${token}`)) {
    return true
  }
  const url = new URL(request.url)
  return timingSafeTokenCompare(url.searchParams.get('token'), token)
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
