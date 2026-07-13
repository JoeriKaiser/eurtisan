import { describe, expect, it } from 'vitest'

import {
  parsePublicBuildEnvironment,
  selectExplicitPublicBuildEnvironment,
} from './public-environment'

function validPublicEnvironment(): Record<string, string> {
  return {
    VITE_ANALYTICS_CONSENT_REQUIRED: 'true',
    VITE_APP_ENV: 'production',
    VITE_APP_VERSION: '7118919abcdef0123456789abcdef0123456789a',
    VITE_FARO_COLLECTOR_URL: '/collect',
    VITE_FARO_ENABLED: 'true',
    VITE_FARO_APP_NAME: 'eurtisan',
    VITE_FARO_SAMPLE_RATE: '0.1',
    VITE_IMGPROXY_BASE_URL: 'https://eurtisan.test/uploads',
    VITE_MEILISEARCH_HOST: 'https://eurtisan.test/meilisearch',
    VITE_MEILISEARCH_SEARCH_KEY: 'searchrestrictedvalue000000000001',
    VITE_PUBLIC_URL: 'https://eurtisan.test',
    VITE_S3_BUCKET: 'eurtisan-uploads',
    VITE_UMAMI_ENABLED: 'false',
  }
}

describe('parsePublicBuildEnvironment', () => {
  it('accepts the complete production browser contract', () => {
    expect(parsePublicBuildEnvironment(validPublicEnvironment()).VITE_APP_ENV).toBe('production')
  })

  it('names missing required variables without including values', () => {
    const environment = validPublicEnvironment()
    delete environment.VITE_IMGPROXY_BASE_URL

    expect(() => parsePublicBuildEnvironment(environment)).toThrow('VITE_IMGPROXY_BASE_URL')
  })

  it.each([
    ['localhost', 'http://localhost:8080/uploads'],
    ['loopback', 'https://127.0.0.1/uploads'],
    ['internal Docker hostname', 'http://imgproxy:8080/uploads'],
    ['malformed URL', 'not a url'],
  ])('rejects a %s public imgproxy URL', (_case, value) => {
    const environment = validPublicEnvironment()
    environment.VITE_IMGPROXY_BASE_URL = value

    expect(() => parsePublicBuildEnvironment(environment)).toThrow('VITE_IMGPROXY_BASE_URL')
  })

  it('rejects placeholder public keys', () => {
    const environment = validPublicEnvironment()
    environment.VITE_MEILISEARCH_SEARCH_KEY = 'change-me-search-key'

    expect(() => parsePublicBuildEnvironment(environment)).toThrow('placeholder value')
  })

  it('rejects unapproved secret-like VITE variables', () => {
    const environment = validPublicEnvironment()
    environment.VITE_DATABASE_SECRET = 'browser-visible-secret-marker'

    expect(() => parsePublicBuildEnvironment(environment)).toThrow('VITE_DATABASE_SECRET')
  })

  it('selects only approved VITE variables for an explicit release build', () => {
    const environment = {
      ...validPublicEnvironment(),
      DATABASE_ENCRYPTION_KEY: 'server-secret-value',
      VITE_LEGACY_VALUE: 'must-not-enter-the-build-contract',
    }

    expect(selectExplicitPublicBuildEnvironment(environment)).toEqual(
      expect.objectContaining({
        DATABASE_ENCRYPTION_KEY: 'server-secret-value',
        VITE_APP_ENV: 'production',
      }),
    )
    expect(selectExplicitPublicBuildEnvironment(environment)).not.toHaveProperty(
      'VITE_LEGACY_VALUE',
    )
  })

  it('rejects a public value equal to a server secret', () => {
    const environment = validPublicEnvironment()
    environment.MEILISEARCH_API_KEY = environment.VITE_MEILISEARCH_SEARCH_KEY

    expect(() => parsePublicBuildEnvironment(environment)).toThrow('MEILISEARCH_API_KEY')
  })

  it('rejects partial Umami configuration when Umami is disabled', () => {
    const environment = validPublicEnvironment()
    environment.VITE_UMAMI_SCRIPT_URL = 'https://analytics.eurtisan.test/script.js'

    expect(() => parsePublicBuildEnvironment(environment)).toThrow('VITE_UMAMI_ENABLED')
  })

  it('rejects a mutable release label', () => {
    const environment = validPublicEnvironment()
    environment.VITE_APP_VERSION = 'latest'

    expect(() => parsePublicBuildEnvironment(environment)).toThrow('VITE_APP_VERSION')
  })
})
