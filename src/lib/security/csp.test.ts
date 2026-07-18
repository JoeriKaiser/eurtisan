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

  it('includes style-src with self only', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("style-src 'self'")
  })

  it('includes style-src-attr with unsafe-inline for dynamic styles', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("style-src-attr 'unsafe-inline'")
  })

  it('includes img-src with self and data only', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("img-src 'self' data:")
    // Ensure the broad https: scheme is not present in img-src
    const imgSrcMatch = csp.match(/img-src ([^;]+)/)
    expect(imgSrcMatch).toBeTruthy()
    expect(imgSrcMatch?.[1]).not.toContain('https:')
  })

  it('includes font-src with self only', () => {
    const csp = buildCspHeader()
    expect(csp).toContain("font-src 'self'")
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

  it('adds the public Meilisearch origin when VITE_MEILISEARCH_HOST is set', () => {
    const original = process.env.VITE_MEILISEARCH_HOST
    process.env.VITE_MEILISEARCH_HOST = 'https://search.eurtisan.eu'
    const csp = buildCspHeader()
    expect(csp).toContain('https://search.eurtisan.eu')
    process.env.VITE_MEILISEARCH_HOST = original
  })

  it('adds the public storage origin for browser uploads', () => {
    const original = process.env.S3_PUBLIC_ENDPOINT
    process.env.S3_PUBLIC_ENDPOINT = 'https://s3-staging.eurtisan.eu/path'
    const csp = buildCspHeader()
    expect(csp).toContain('https://s3-staging.eurtisan.eu')
    process.env.S3_PUBLIC_ENDPOINT = original
  })

  it('does not add undefined origins when env vars are missing', () => {
    const originalMeili = process.env.VITE_MEILISEARCH_HOST
    process.env.VITE_MEILISEARCH_HOST = ''
    const csp = buildCspHeader()
    expect(csp).not.toContain('undefined')
    expect(csp).not.toContain('null')
    process.env.VITE_MEILISEARCH_HOST = originalMeili
  })

  it('adds Umami script origin to script-src and connect-src when VITE_UMAMI_SCRIPT_URL is set', () => {
    const original = process.env.VITE_UMAMI_SCRIPT_URL
    process.env.VITE_UMAMI_SCRIPT_URL = 'https://analytics.eurtisan.eu/script.js'
    const csp = buildCspHeader()
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://analytics.eurtisan.eu")
    expect(csp).toContain('https://analytics.eurtisan.eu')
    process.env.VITE_UMAMI_SCRIPT_URL = original
  })

  it('adds Umami host origin to connect-src when VITE_UMAMI_HOST_URL is set', () => {
    const originalScript = process.env.VITE_UMAMI_SCRIPT_URL
    const originalHost = process.env.VITE_UMAMI_HOST_URL
    process.env.VITE_UMAMI_SCRIPT_URL = 'https://cdn.umami.is/script.js'
    process.env.VITE_UMAMI_HOST_URL = 'https://api.umami.is'
    const csp = buildCspHeader()
    expect(csp).toContain('https://cdn.umami.is')
    expect(csp).toContain('https://api.umami.is')
    process.env.VITE_UMAMI_SCRIPT_URL = originalScript
    process.env.VITE_UMAMI_HOST_URL = originalHost
  })
})
