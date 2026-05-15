import { describe, expect, it } from 'vitest'
import { buildCspHeader } from './csp'

describe('buildCspHeader', () => {
  it('includes default-src self', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("default-src 'self'")
  })

  it('includes script-src with self and unsafe-inline', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
  })

  it('includes style-src with self and unsafe-inline', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('includes img-src with self and data only', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("img-src 'self' data:")
    // Ensure the broad https: scheme is not present in img-src
    const imgSrcMatch = csp.match(/img-src ([^;]+)/)
    expect(imgSrcMatch).toBeTruthy()
    expect(imgSrcMatch![1]).not.toContain('https:')
  })

  it('includes font-src with self and Google Fonts', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com")
  })

  it('includes connect-src with self and known APIs', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("connect-src 'self' https://api.mollie.com https://api.brevo.com")
  })

  it('includes frame-src with self and Mollie checkout', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("frame-src 'self' https://checkout.mollie.com")
  })

  it('includes frame-ancestors none for clickjacking protection', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('includes base-uri self', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("base-uri 'self'")
  })

  it('includes form-action self', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("form-action 'self'")
  })

  it('adds Sentry origin when VITE_SENTRY_DSN is set', () => {
    const original = process.env.VITE_SENTRY_DSN
    process.env.VITE_SENTRY_DSN = 'https://abc@o123.ingest.sentry.io/456'
    const csp = buildCspHeader()
    expect(csp).toContain('https://o123.ingest.sentry.io')
    process.env.VITE_SENTRY_DSN = original
  })

  it('adds Meilisearch origin when MEILISEARCH_HOST is set', () => {
    const original = process.env.MEILISEARCH_HOST
    process.env.MEILISEARCH_HOST = 'https://search.eurtisan.com'
    const csp = buildCspHeader()
    expect(csp).toContain('https://search.eurtisan.com')
    process.env.MEILISEARCH_HOST = original
  })

  it('does not add undefined origins when env vars are missing', () => {
    const originalSentry = process.env.VITE_SENTRY_DSN
    const originalMeili = process.env.MEILISEARCH_HOST
    process.env.VITE_SENTRY_DSN = ''
    process.env.MEILISEARCH_HOST = ''
    const csp = buildCspHeader()
    expect(csp).not.toContain('undefined')
    expect(csp).not.toContain('null')
    process.env.VITE_SENTRY_DSN = originalSentry
    process.env.MEILISEARCH_HOST = originalMeili
  })
})
