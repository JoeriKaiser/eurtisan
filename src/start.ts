import { createMiddleware, createStart } from '@tanstack/react-start'
import { buildCspHeader } from './lib/csp'

function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

/** Core CSP middleware handler — extracted for testability. */
export async function cspMiddlewareHandler({
  next,
}: {
  next: () => Promise<{ response: Response }>
}): Promise<{ response: Response }> {
  const result = await next()
  const response = result.response

  const newHeaders = new Headers(response.headers)

  if (!isDev()) {
    newHeaders.set('content-security-policy', buildCspHeader())
  }

  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })

  return { ...result, response: newResponse }
}

const cspMiddleware = createMiddleware().server(cspMiddlewareHandler)

// startInstance is consumed by the TanStack Start Vite plugin at build time.
// It has no explicit importers in source — the plugin discovers it via heuristics.
export const startInstance = createStart(() => ({
  requestMiddleware: [cspMiddleware],
}))
