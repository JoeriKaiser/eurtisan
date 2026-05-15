import { describe, expect, it, vi } from 'vitest'
import { buildCspHeader } from './csp'

vi.mock('@tanstack/react-start', () => ({
  createStart: (factory: () => any) => factory(),
  createMiddleware: () => ({
    server: (handler: any) => handler,
  }),
}))

import { startInstance } from '../start'

describe('CSP middleware integration', () => {
  it('buildCspHeader produces a valid policy string', () => {
    const csp = buildCspHeader()
    const directives = csp.split(';').map((d) => d.trim())

    // Every directive should have a key and a non-empty value
    for (const directive of directives) {
      const parts = directive.split(' ')
      expect(parts.length).toBeGreaterThanOrEqual(2)
      expect(parts[0]).toBeTruthy()
    }

    // Required directives must be present
    const directiveMap = new Map(
      directives.map((d) => {
        const [key, ...values] = d.split(' ')
        return [key, values.join(' ')]
      }),
    )

    expect(directiveMap.get('default-src')).toBe("'self'")
    expect(directiveMap.get('frame-ancestors')).toBe("'none'")
    expect(directiveMap.get('base-uri')).toBe("'self'")
    expect(directiveMap.get('form-action')).toBe("'self'")
  })

  it('does not contain eval-related unsafe directives', () => {
    const csp = buildCspHeader()
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('sets the Content-Security-Policy header on the response', async () => {
    const handler = startInstance.requestMiddleware[0]
    const originalResponse = new Response('ok', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })

    const result = await handler({
      next: async () => ({ response: originalResponse }),
    })
    const csp = result.response.headers.get('content-security-policy')

    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it('preserves existing response headers while adding CSP', async () => {
    const handler = startInstance.requestMiddleware[0]
    const originalResponse = new Response('ok', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-custom': 'custom-value',
      },
    })

    const result = await handler({
      next: async () => ({ response: originalResponse }),
    })
    const headers = result.response.headers

    expect(headers.get('content-security-policy')).toBeTruthy()
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-custom')).toBe('custom-value')
    expect(result.response.status).toBe(200)
  })
})
