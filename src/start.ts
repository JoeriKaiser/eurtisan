import { createMiddleware, createStart } from '@tanstack/react-start'
import { paraglideMiddleware } from '#/paraglide/server'
import { buildCspHeader } from './lib/csp'

function isDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

export async function cspMiddlewareHandler({ next }: { next: () => Promise<unknown> }) {
  const result = (await next()) as { response: Response }
  const response = result.response

  const newHeaders = new Headers(response.headers)
  const { getCspNonce, injectScriptNonces } = await import('./lib/csp-nonce.server')
  const nonce = getCspNonce()

  if (!isDev() && nonce) {
    newHeaders.set('content-security-policy', buildCspHeader({ nonce }))
  }

  const contentType = response.headers.get('content-type') ?? ''
  let body: BodyInit | null = response.body

  if (!isDev() && nonce && contentType.includes('text/html')) {
    const html = await response.text()
    body = injectScriptNonces(html, nonce)
  }

  const newResponse = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })

  return { ...result, response: newResponse }
}

const cspMiddleware = createMiddleware().server(cspMiddlewareHandler as never)

// Sets the Paraglide locale async context from the request URL/cookie. The
// router's own `rewrite` option handles URL de-localization, so we pass the
// original request through; the middleware still makes `getLocale()` return the
// correct locale during SSR.
const paraglideRequestMiddleware = createMiddleware().server(async ({ request, next }) => {
  return paraglideMiddleware(request, async () => {
    return next()
  })
})

// startInstance is consumed by the TanStack Start Vite plugin at build time.
// It has no explicit importers in source — the plugin discovers it via heuristics.
export const startInstance = createStart(() => ({
  requestMiddleware: [paraglideRequestMiddleware, cspMiddleware],
}))
