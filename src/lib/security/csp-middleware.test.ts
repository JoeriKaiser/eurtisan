import { describe, expect, it } from 'vitest'
import { runWithCspNonce } from './csp-nonce.server'
import { cspMiddlewareHandler } from '../../start'
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

    const withNonce = buildCspHeader({ nonce: 'abc123' })
    expect(withNonce).toContain("script-src 'self' 'nonce-abc123'")
  })

  it('does not contain eval-related unsafe directives', () => {
    const csp = buildCspHeader()
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('sets the Content-Security-Policy header on HTML responses when nonce is present', async () => {
    const result = await runWithCspNonce('test-nonce-xyz', async () =>
      cspMiddlewareHandler({
        next: async () => ({
          response: new Response('<html><script>window.__test=1</script></html>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        }),
      }),
    )
    const csp = result.response.headers.get('content-security-policy')
    const html = await result.response.text()

    if (process.env.NODE_ENV === 'development') {
      expect(csp).toBeNull()
      return
    }

    expect(csp).toBeTruthy()
    expect(csp).toContain("'nonce-test-nonce-xyz'")
    expect(html).toContain('nonce="test-nonce-xyz"')
  })

  it('preserves existing response headers while adding CSP', async () => {
    const result = await runWithCspNonce('header-test-nonce', async () =>
      cspMiddlewareHandler({
        next: async () => ({
          response: new Response('ok', {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'x-custom': 'custom-value',
            },
          }),
        }),
      }),
    )
    const headers = result.response.headers

    if (process.env.NODE_ENV !== 'development') {
      expect(headers.get('content-security-policy')).toBeTruthy()
    }
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-custom')).toBe('custom-value')
    expect(result.response.status).toBe(200)
  })
})
