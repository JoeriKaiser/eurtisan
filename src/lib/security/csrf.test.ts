import { describe, expect, it, vi } from 'vitest'
import { CsrfError, validateCsrf } from './csrf'

vi.mock('./env.server', () => ({
  getBaseUrl: () => 'http://localhost:3000',
}))

describe('validateCsrf', () => {
  it('allows GET requests without origin or referer', () => {
    const req = new Request('http://localhost:3000/api/test', { method: 'GET' })
    expect(() => validateCsrf(req)).not.toThrow()
  })

  it('allows HEAD requests without origin or referer', () => {
    const req = new Request('http://localhost:3000/api/test', { method: 'HEAD' })
    expect(() => validateCsrf(req)).not.toThrow()
  })

  it('allows OPTIONS requests without origin or referer', () => {
    const req = new Request('http://localhost:3000/api/test', { method: 'OPTIONS' })
    expect(() => validateCsrf(req)).not.toThrow()
  })

  it('allows POST with matching Origin header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    })
    expect(() => validateCsrf(req)).not.toThrow()
  })

  it('allows POST with matching Referer header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Referer: 'http://localhost:3000/some-page' },
    })
    expect(() => validateCsrf(req)).not.toThrow()
  })

  it('rejects POST with missing origin and referer', () => {
    const req = new Request('http://localhost:3000/api/test', { method: 'POST' })
    expect(() => validateCsrf(req)).toThrow(CsrfError)
    expect(() => validateCsrf(req)).toThrow('Missing Origin or Referer header')
  })

  it('rejects POST with mismatched Origin header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Origin: 'https://evil.com' },
    })
    expect(() => validateCsrf(req)).toThrow(CsrfError)
    expect(() => validateCsrf(req)).toThrow('Invalid Origin header: https://evil.com')
  })

  it('rejects POST with mismatched Referer header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Referer: 'https://evil.com/phishing' },
    })
    expect(() => validateCsrf(req)).toThrow(CsrfError)
    expect(() => validateCsrf(req)).toThrow('Invalid Referer header: https://evil.com')
  })

  it('rejects POST with null Origin header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Origin: 'null' },
    })
    expect(() => validateCsrf(req)).toThrow(CsrfError)
    expect(() => validateCsrf(req)).toThrow('Invalid Origin header: null')
  })

  it('rejects POST with invalid Referer header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { Referer: 'not-a-valid-url' },
    })
    expect(() => validateCsrf(req)).toThrow(CsrfError)
    expect(() => validateCsrf(req)).toThrow('Invalid Referer header')
  })

  it('allows PATCH with matching Origin header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'PATCH',
      headers: { Origin: 'http://localhost:3000' },
    })
    expect(() => validateCsrf(req)).not.toThrow()
  })

  it('allows DELETE with matching Referer header', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'DELETE',
      headers: { Referer: 'http://localhost:3000/some-page' },
    })
    expect(() => validateCsrf(req)).not.toThrow()
  })

  it('prefers Origin over Referer when both are present', () => {
    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        Referer: 'https://evil.com/page',
      },
    })
    // Origin is trusted, so Referer is ignored
    expect(() => validateCsrf(req)).not.toThrow()
  })
})
