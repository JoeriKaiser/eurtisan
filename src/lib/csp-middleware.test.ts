import { describe, expect, it } from 'vitest'
import { cspMiddlewareHandler } from '../start'
import { buildCspHeader } from './csp'

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
    expect(directiveMap.get('style-src')).toBe("'self'")
    expect(directiveMap.get('script-src')).toBe("'self' 'unsafe-inline'")
  })

  it('does not contain eval-related unsafe directives', () => {
    const csp = buildCspHeader()
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('sets the Content-Security-Policy header on the response', async () => {
    const result = await cspMiddlewareHandler({
      next: async () => ({
        response: new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      }),
    })
    const csp = result.response.headers.get('content-security-policy')

    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it('preserves existing response headers while adding CSP', async () => {
    const result = await cspMiddlewareHandler({
      next: async () => ({
        response: new Response('ok', {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-custom': 'custom-value',
          },
        }),
      }),
    })
    const headers = result.response.headers

    expect(headers.get('content-security-policy')).toBeTruthy()
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-custom')).toBe('custom-value')
    expect(result.response.status).toBe(200)
  })
})
