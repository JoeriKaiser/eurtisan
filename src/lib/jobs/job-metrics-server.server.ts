import { timingSafeEqual } from 'node:crypto'
import { createServer, type Server } from 'node:http'

import { getMetricsBody, metricsContentType } from '#/lib/metrics.server'
import { logger } from '#/lib/logger.server'

function tokensMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const providedBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  )
}

export async function getJobMetricsResponse(request: Request, token: string): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname !== '/metrics') return new Response('Not found', { status: 404 })

  const authorization = request.headers.get('authorization')
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  const providedToken = bearerToken ?? url.searchParams.get('token')
  if (!tokensMatch(providedToken, token)) return new Response('Unauthorized', { status: 401 })

  return new Response(await getMetricsBody(), {
    status: 200,
    headers: { 'Content-Type': metricsContentType },
  })
}

export async function startJobMetricsServer(input: {
  port: number
  token: string
}): Promise<{ close: () => Promise<void> }> {
  const server: Server = createServer(async (request, response) => {
    const host = request.headers.host ?? `127.0.0.1:${input.port}`
    const webRequest = new Request(`http://${host}${request.url ?? '/'}`, {
      headers: request.headers as HeadersInit,
    })
    const webResponse = await getJobMetricsResponse(webRequest, input.token)
    response.statusCode = webResponse.status
    webResponse.headers.forEach((value, name) => {
      response.setHeader(name, value)
    })
    response.end(await webResponse.text())
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(input.port, '0.0.0.0', () => {
      server.off('error', reject)
      resolve()
    })
  })

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

const DEFAULT_JOB_METRICS_PORT = 3001

/**
 * Starts a job's Prometheus endpoint from environment defaults, with the same
 * contract as worker-daemon.server.ts: METRICS_TOKEN gates the endpoint and
 * METRICS_PORT (default 3001) selects the port. When METRICS_TOKEN is unset
 * the endpoint is skipped with a warning so local runs and tests stay
 * serverless; production .env always carries the token, and a skipped endpoint
 * surfaces in Prometheus as a down scrape target rather than silent staleness.
 *
 * Long-running standalone job entrypoints call this once at start-up and close
 * the returned handle on shutdown.
 */
export async function startJobMetricsServerFromEnv(): Promise<
  { close: () => Promise<void> } | undefined
> {
  const token = process.env.METRICS_TOKEN
  if (!token) {
    logger.warn('METRICS_TOKEN is unset; skipping the job metrics endpoint')
    return undefined
  }
  const port = Number.parseInt(process.env.METRICS_PORT ?? String(DEFAULT_JOB_METRICS_PORT), 10)
  return startJobMetricsServer({ port, token })
}
