import { describe, expect, it } from 'vitest'

import { parseServerEnvironment } from './server-environment.server'

function validServerEnvironment(): Record<string, string> {
  return {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    PUBLIC_URL: 'https://eurtisan.test',
    BETTER_AUTH_URL: 'https://eurtisan.test',
    BETTER_AUTH_SECRET: 'authvalue0000000000000000000000000001',
    DATABASE_URL: 'postgresql://eurtisan:strongpassword@db:5432/eurtisan',
    DATABASE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    MEILISEARCH_ENABLED: 'true',
    MEILISEARCH_HOST: 'http://meilisearch:7700',
    MEILISEARCH_API_KEY: 'meilimastervalue000000000000000001',
    MEILI_MASTER_KEY: 'meilimastervalue000000000000000001',
    S3_STORAGE_ENABLED: 'true',
    S3_ENDPOINT: 'https://s3.fr-par.scw.cloud',
    S3_PUBLIC_ENDPOINT: 'https://s3.fr-par.scw.cloud',
    S3_REGION: 'fr-par',
    S3_BUCKET: 'eurtisan-uploads',
    S3_ACCESS_KEY_ID: 'storageaccess00000001',
    S3_SECRET_ACCESS_KEY: 'storagesecret00000000000000000001',
    IMGPROXY_ENABLED: 'true',
    IMGPROXY_BASE_URL: 'https://eurtisan.test/uploads',
    IMGPROXY_HEALTH_URL: 'http://imgproxy:8080/health',
    IMGPROXY_KEY: 'a'.repeat(64),
    IMGPROXY_SALT: 'b'.repeat(64),
    MOLLIE_PAYMENTS_ENABLED: 'true',
    MOLLIE_CONNECT_ENABLED: 'true',
    MOLLIE_API_KEY: `live_${'x'.repeat(30)}`,
    MOLLIE_CLIENT_ID: 'applicationidentifier0001',
    MOLLIE_CLIENT_SECRET: 'applicationsecret0000000000000001',
    MOLLIE_TEST_MODE: 'false',
    MOCK_PAYMENTS_ENABLED: 'false',
    MOCK_PAYOUTS_ENABLED: 'false',
    FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS: '21600000',
    FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE: '500',
    SENDCLOUD_ENABLED: 'true',
    SENDCLOUD_PUBLIC_KEY: 'sendcloudpublic000001',
    SENDCLOUD_SECRET_KEY: 'sendcloudsecret000000000000000001',
    SENDCLOUD_WEBHOOK_SECRET: 'sendcloudwebhook00000000000000001',
    SENDCLOUD_FORCE_UNSTAMPED_LETTER: 'false',
    EMAIL_DELIVERY_PROVIDER: 'brevo',
    BREVO_API_KEY: 'brevoapikey00000000000000000000001',
    BREVO_WEBHOOK_TOKEN: 'w'.repeat(64),
    EMAIL_SMTP_PORT: '587',
    EMAIL_FROM_ADDRESS: 'noreply@eurtisan.test',
    EMAIL_REPLY_TO_ADDRESS: 'support@eurtisan.test',
    METRICS_TOKEN: 'metricsvalue00000000000000000000001',
    ENABLE_VIES_VALIDATION: 'false',
    PLATFORM_VAT_LIABLE: 'true',
    FARO_ENABLED: 'true',
    UMAMI_ENABLED: 'false',
    VITE_ANALYTICS_CONSENT_REQUIRED: 'true',
    VITE_APP_ENV: 'production',
    VITE_APP_VERSION: '7118919abcdef0123456789abcdef0123456789a',
    VITE_FARO_COLLECTOR_URL: '/collect',
    VITE_FARO_ENABLED: 'true',
    VITE_FARO_APP_NAME: 'eurtisan',
    VITE_FARO_SAMPLE_RATE: '0.1',
    VITE_IMGPROXY_BASE_URL: 'https://eurtisan.test/uploads',
    VITE_PUBLIC_URL: 'https://eurtisan.test',
    VITE_S3_BUCKET: 'eurtisan-uploads',
    VITE_UMAMI_ENABLED: 'false',
  }
}

describe('parseServerEnvironment', () => {
  it('accepts a complete production environment', () => {
    expect(parseServerEnvironment(validServerEnvironment()).APP_ENV).toBe('production')
  })

  it('reports missing variable names without secret values', () => {
    const environment = validServerEnvironment()
    const secret = environment.BETTER_AUTH_SECRET
    delete environment.DATABASE_ENCRYPTION_KEY

    expect(() => parseServerEnvironment(environment)).toThrow('DATABASE_ENCRYPTION_KEY')
    try {
      parseServerEnvironment(environment)
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })

  it('rejects malformed database encryption keys', () => {
    const environment = validServerEnvironment()
    environment.DATABASE_ENCRYPTION_KEY = Buffer.alloc(31, 7).toString('base64')

    expect(() => parseServerEnvironment(environment)).toThrow('DATABASE_ENCRYPTION_KEY')
  })

  it('rejects placeholder secrets', () => {
    const environment = validServerEnvironment()
    environment.METRICS_TOKEN = 'change-me-with-a-random-metrics-token'

    expect(() => parseServerEnvironment(environment)).toThrow('METRICS_TOKEN')
  })

  it.each([
    ['localhost', 'http://localhost:3900'],
    ['internal hostname', 'https://garage'],
    ['malformed endpoint', 'not-a-url'],
  ])('rejects a %s S3 public endpoint', (_case, endpoint) => {
    const environment = validServerEnvironment()
    environment.S3_PUBLIC_ENDPOINT = endpoint

    expect(() => parseServerEnvironment(environment)).toThrow('S3_PUBLIC_ENDPOINT')
  })

  it('accepts private Garage with a public HTTPS endpoint in staging', () => {
    const environment = validServerEnvironment()
    environment.APP_ENV = 'staging'
    environment.VITE_APP_ENV = 'staging'
    environment.S3_ENDPOINT = 'http://garage:3900'
    environment.S3_PUBLIC_ENDPOINT = 'https://s3-staging.eurtisan.test'
    environment.S3_REGION = 'garage'
    environment.MOLLIE_API_KEY = `test_${'x'.repeat(30)}`
    environment.MOLLIE_TEST_MODE = 'true'
    environment.SENDCLOUD_FORCE_UNSTAMPED_LETTER = 'true'
    environment.EMAIL_DELIVERY_PROVIDER = 'smtp'
    environment.EMAIL_SMTP_HOST = 'mailpit'
    environment.BREVO_API_KEY = ''
    environment.BREVO_WEBHOOK_TOKEN = ''

    expect(parseServerEnvironment(environment).S3_ENDPOINT).toBe('http://garage:3900')
  })

  it('rejects a private Garage endpoint in production', () => {
    const environment = validServerEnvironment()
    environment.S3_ENDPOINT = 'http://garage:3900'

    expect(() => parseServerEnvironment(environment)).toThrow('S3_ENDPOINT')
  })

  it('rejects inconsistent public and server bucket names', () => {
    const environment = validServerEnvironment()
    environment.VITE_S3_BUCKET = 'another-bucket'

    expect(() => parseServerEnvironment(environment)).toThrow('VITE_S3_BUCKET')
  })

  it('rejects disabled launch-required integrations', () => {
    const environment = validServerEnvironment()
    environment.SENDCLOUD_ENABLED = 'false'

    expect(() => parseServerEnvironment(environment)).toThrow('SENDCLOUD_ENABLED')
  })

  it('validates financial reconciliation cadence and batch bounds', () => {
    const tooFrequent = validServerEnvironment()
    tooFrequent.FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS = '60000'
    expect(() => parseServerEnvironment(tooFrequent)).toThrow(
      'FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS',
    )

    const oversizedBatch = validServerEnvironment()
    oversizedBatch.FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE = '5001'
    expect(() => parseServerEnvironment(oversizedBatch)).toThrow(
      'FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE',
    )
  })

  it('defaults and bounds notification-digest polling configuration', () => {
    const defaults = parseServerEnvironment(validServerEnvironment())
    expect(defaults.NOTIFICATION_DIGEST_INTERVAL_MS).toBe(3_600_000)
    expect(defaults.NOTIFICATION_DIGEST_RECIPIENT_BATCH_SIZE).toBe(100)

    const tooFrequent = validServerEnvironment()
    tooFrequent.NOTIFICATION_DIGEST_INTERVAL_MS = '59999'
    expect(() => parseServerEnvironment(tooFrequent)).toThrow('NOTIFICATION_DIGEST_INTERVAL_MS')

    const oversizedBatch = validServerEnvironment()
    oversizedBatch.NOTIFICATION_DIGEST_RECIPIENT_BATCH_SIZE = '501'
    expect(() => parseServerEnvironment(oversizedBatch)).toThrow(
      'NOTIFICATION_DIGEST_RECIPIENT_BATCH_SIZE',
    )
  })

  it('rejects SMTP and Brevo configuration mixed together', () => {
    const environment = validServerEnvironment()
    environment.EMAIL_SMTP_HOST = 'mailpit'

    expect(() => parseServerEnvironment(environment)).toThrow('EMAIL_SMTP_HOST')
  })

  it('provides safe operator defaults and accepts configured operator identity', () => {
    const env = parseServerEnvironment(validServerEnvironment())
    expect(env.OPERATOR_LEGAL_NAME).toBe('Eurtisan Platform')
    expect(env.OPERATOR_LEGAL_EMAIL).toBe('legal@eurtisan.eu')
    expect(env.OPERATOR_BILLING_EMAIL).toBe('billing@eurtisan.eu')
    expect(env.OPERATOR_VAT_ID).toBe('FR00000000000')
    expect(env.OPERATOR_STREET).toBe('1 Place de la République')
    expect(env.OPERATOR_CITY).toBe('Paris')
    expect(env.OPERATOR_POSTAL_CODE).toBe('75001')
    expect(env.OPERATOR_COUNTRY).toBe('FR')

    const customEnv = validServerEnvironment()
    customEnv.OPERATOR_LEGAL_NAME = 'Custom SAS'
    customEnv.OPERATOR_LEGAL_EMAIL = 'custom@example.com'
    customEnv.OPERATOR_VAT_ID = 'FR11223344556'
    const parsedCustom = parseServerEnvironment(customEnv)
    expect(parsedCustom.OPERATOR_LEGAL_NAME).toBe('Custom SAS')
    expect(parsedCustom.OPERATOR_LEGAL_EMAIL).toBe('custom@example.com')
    expect(parsedCustom.OPERATOR_VAT_ID).toBe('FR11223344556')
  })
})
