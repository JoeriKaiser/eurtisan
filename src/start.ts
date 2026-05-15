import { createStart, createMiddleware } from '@tanstack/react-start'
import { buildCspHeader } from './lib/csp'

const cspMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next()
  const response = result.response

  const newHeaders = new Headers(response.headers)
  newHeaders.set('content-security-policy', buildCspHeader())

  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })

  return { ...result, response: newResponse }
})

export const startInstance = createStart(() => ({
  requestMiddleware: [cspMiddleware],
}))
