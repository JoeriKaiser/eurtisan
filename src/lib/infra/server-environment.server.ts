import '@tanstack/react-start/server-only'

import z from 'zod'

import { parsePublicBuildEnvironment } from './public-environment'

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value
const requiredString = z.preprocess(emptyToUndefined, z.string().trim().min(1))
const secretString = z.preprocess(emptyToUndefined, z.string().trim().min(16))
const explicitBoolean = z.enum(['true', 'false'])
const forbiddenPlaceholderPattern =
  /(?:^|[^a-z])(?:change[-_ ]?me|your[-_ ]|replace[-_ ]?me|placeholder|example[-_ ]?(?:key|token|secret|id)|dummy|todo|changeme)(?=$|[^a-z])/i

const serverEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(['staging', 'production']),
    NODE_ENV: z.literal('production'),
    PUBLIC_URL: requiredString,
    BETTER_AUTH_URL: requiredString,
    BETTER_AUTH_SECRET: secretString,
    DATABASE_URL: requiredString,
    DATABASE_ENCRYPTION_KEY: requiredString,
    MEILISEARCH_ENABLED: explicitBoolean,
    MEILISEARCH_HOST: requiredString,
    MEILISEARCH_API_KEY: secretString,
    MEILI_MASTER_KEY: secretString,
    S3_STORAGE_ENABLED: explicitBoolean,
    S3_ENDPOINT: requiredString,
    S3_PUBLIC_ENDPOINT: requiredString,
    S3_REGION: requiredString,
    S3_BUCKET: requiredString,
    S3_ACCESS_KEY_ID: requiredString,
    S3_SECRET_ACCESS_KEY: secretString,
    IMGPROXY_ENABLED: explicitBoolean,
    IMGPROXY_BASE_URL: requiredString,
    IMGPROXY_HEALTH_URL: requiredString,
    IMGPROXY_KEY: requiredString,
    IMGPROXY_SALT: requiredString,
    MOLLIE_PAYMENTS_ENABLED: explicitBoolean,
    MOLLIE_CONNECT_ENABLED: explicitBoolean,
    MOLLIE_API_KEY: requiredString,
    MOLLIE_CLIENT_ID: requiredString,
    MOLLIE_CLIENT_SECRET: secretString,
    MOLLIE_TEST_MODE: explicitBoolean,
    MOCK_PAYMENTS_ENABLED: explicitBoolean,
    MOCK_PAYOUTS_ENABLED: explicitBoolean,
    FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(5 * 60 * 1000)
      .max(24 * 60 * 60 * 1000)
      .default(6 * 60 * 60 * 1000),
    FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(5_000)
      .default(500),
    NOTIFICATION_DIGEST_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(60 * 1000)
      .max(24 * 60 * 60 * 1000)
      .default(60 * 60 * 1000),
    NOTIFICATION_DIGEST_RECIPIENT_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
    SENDCLOUD_ENABLED: explicitBoolean,
    SENDCLOUD_PUBLIC_KEY: requiredString,
    SENDCLOUD_SECRET_KEY: secretString,
    SENDCLOUD_WEBHOOK_SECRET: secretString,
    SENDCLOUD_FORCE_UNSTAMPED_LETTER: explicitBoolean,
    EMAIL_DELIVERY_PROVIDER: z.enum(['brevo', 'smtp']),
    BREVO_API_KEY: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    BREVO_WEBHOOK_TOKEN: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    EMAIL_SMTP_HOST: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    EMAIL_SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    EMAIL_FROM_ADDRESS: z.string().email(),
    EMAIL_REPLY_TO_ADDRESS: z.string().email(),
    METRICS_TOKEN: secretString,
    ENABLE_VIES_VALIDATION: explicitBoolean,
    PLATFORM_VAT_LIABLE: explicitBoolean,
    FARO_ENABLED: explicitBoolean,
    UMAMI_ENABLED: explicitBoolean,
    VITE_ANALYTICS_CONSENT_REQUIRED: explicitBoolean,
    VITE_APP_ENV: z.enum(['staging', 'production']),
    VITE_APP_VERSION: requiredString,
    VITE_FARO_COLLECTOR_URL: requiredString,
    VITE_FARO_ENABLED: explicitBoolean,
    VITE_FARO_APP_NAME: requiredString,
    VITE_FARO_SAMPLE_RATE: requiredString,
    VITE_IMGPROXY_BASE_URL: requiredString,
    VITE_PUBLIC_URL: requiredString,
    VITE_S3_BUCKET: requiredString,
    VITE_UMAMI_ENABLED: explicitBoolean,
    VITE_UMAMI_HOST_URL: z.string().optional(),
    VITE_UMAMI_SCRIPT_INTEGRITY: z.string().optional(),
    VITE_UMAMI_SCRIPT_URL: z.string().optional(),
    VITE_UMAMI_WEBSITE_ID: z.string().optional(),
  })
  .superRefine((environment, context) => {
    const publicUrl = parseHttpsUrl('PUBLIC_URL', environment.PUBLIC_URL, context)
    const authUrl = parseHttpsUrl('BETTER_AUTH_URL', environment.BETTER_AUTH_URL, context)
    const s3Endpoint = parseStorageEndpoint(environment.APP_ENV, environment.S3_ENDPOINT, context)
    const s3PublicEndpoint = parseHttpsUrl(
      'S3_PUBLIC_ENDPOINT',
      environment.S3_PUBLIC_ENDPOINT,
      context,
    )

    if (publicUrl && authUrl && publicUrl.origin !== authUrl.origin) {
      addIssue(context, 'BETTER_AUTH_URL', 'must use the same origin as PUBLIC_URL')
    }
    if (publicUrl && environment.VITE_PUBLIC_URL !== publicUrl.origin) {
      addIssue(context, 'VITE_PUBLIC_URL', 'must match PUBLIC_URL')
    }
    if (environment.APP_ENV !== environment.VITE_APP_ENV) {
      addIssue(context, 'VITE_APP_ENV', 'must match APP_ENV')
    }
    if (environment.S3_BUCKET !== environment.VITE_S3_BUCKET) {
      addIssue(context, 'VITE_S3_BUCKET', 'must match S3_BUCKET')
    }
    if (environment.IMGPROXY_BASE_URL !== environment.VITE_IMGPROXY_BASE_URL) {
      addIssue(context, 'VITE_IMGPROXY_BASE_URL', 'must match IMGPROXY_BASE_URL')
    }
    if (environment.FARO_ENABLED !== environment.VITE_FARO_ENABLED) {
      addIssue(context, 'VITE_FARO_ENABLED', 'must match FARO_ENABLED')
    }
    if (environment.UMAMI_ENABLED !== environment.VITE_UMAMI_ENABLED) {
      addIssue(context, 'VITE_UMAMI_ENABLED', 'must match UMAMI_ENABLED')
    }

    requireEnabled(context, environment.MEILISEARCH_ENABLED, 'MEILISEARCH_ENABLED')
    requireEnabled(context, environment.S3_STORAGE_ENABLED, 'S3_STORAGE_ENABLED')
    requireEnabled(context, environment.IMGPROXY_ENABLED, 'IMGPROXY_ENABLED')
    requireEnabled(context, environment.MOLLIE_PAYMENTS_ENABLED, 'MOLLIE_PAYMENTS_ENABLED')
    requireEnabled(context, environment.MOLLIE_CONNECT_ENABLED, 'MOLLIE_CONNECT_ENABLED')
    requireEnabled(context, environment.SENDCLOUD_ENABLED, 'SENDCLOUD_ENABLED')
    requireEnabled(context, environment.FARO_ENABLED, 'FARO_ENABLED')

    if (environment.MEILISEARCH_HOST !== 'http://meilisearch:7700') {
      addIssue(context, 'MEILISEARCH_HOST', 'must use the private Meilisearch service endpoint')
    }
    if (environment.MEILISEARCH_API_KEY !== environment.MEILI_MASTER_KEY) {
      addIssue(context, 'MEILI_MASTER_KEY', 'must match MEILISEARCH_API_KEY')
    }
    if (environment.IMGPROXY_HEALTH_URL !== 'http://imgproxy:8080/health') {
      addIssue(context, 'IMGPROXY_HEALTH_URL', 'must use the private imgproxy health endpoint')
    }
    const usesPrivateStagingGarage =
      environment.APP_ENV === 'staging' && s3Endpoint?.origin === 'http://garage:3900'
    if (
      s3Endpoint &&
      s3PublicEndpoint &&
      !usesPrivateStagingGarage &&
      s3Endpoint.origin !== s3PublicEndpoint.origin
    ) {
      addIssue(context, 'S3_PUBLIC_ENDPOINT', 'must match the configured S3 API origin')
    }

    validateDatabaseUrl(environment.DATABASE_URL, context)
    validateEncryptionKey(environment.DATABASE_ENCRYPTION_KEY, context)
    validateHexSecret('IMGPROXY_KEY', environment.IMGPROXY_KEY, context)
    validateHexSecret('IMGPROXY_SALT', environment.IMGPROXY_SALT, context)

    if (!/^(?:live|test)_[A-Za-z0-9_-]{20,}$/.test(environment.MOLLIE_API_KEY)) {
      addIssue(context, 'MOLLIE_API_KEY', 'must be a valid Mollie API key')
    }
    if (environment.APP_ENV === 'production' && environment.MOLLIE_TEST_MODE !== 'false') {
      addIssue(context, 'MOLLIE_TEST_MODE', 'must be false in production')
    }
    if (environment.APP_ENV === 'staging' && environment.MOLLIE_TEST_MODE !== 'true') {
      addIssue(context, 'MOLLIE_TEST_MODE', 'must be true in staging')
    }
    if (environment.MOCK_PAYMENTS_ENABLED !== 'false') {
      addIssue(context, 'MOCK_PAYMENTS_ENABLED', 'must be false in shared environments')
    }
    if (environment.MOCK_PAYOUTS_ENABLED !== 'false') {
      addIssue(context, 'MOCK_PAYOUTS_ENABLED', 'must be false in shared environments')
    }
    if (
      environment.APP_ENV === 'production' &&
      environment.SENDCLOUD_FORCE_UNSTAMPED_LETTER !== 'false'
    ) {
      addIssue(context, 'SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'must be false in production')
    }
    if (
      environment.APP_ENV === 'staging' &&
      environment.SENDCLOUD_FORCE_UNSTAMPED_LETTER !== 'true'
    ) {
      addIssue(context, 'SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'must be true in staging')
    }

    if (environment.EMAIL_DELIVERY_PROVIDER === 'brevo') {
      if (!environment.BREVO_API_KEY || environment.BREVO_API_KEY.length < 20) {
        addIssue(context, 'BREVO_API_KEY', 'is required for Brevo delivery')
      }
      if (!environment.BREVO_WEBHOOK_TOKEN || environment.BREVO_WEBHOOK_TOKEN.length < 64) {
        addIssue(context, 'BREVO_WEBHOOK_TOKEN', 'must contain at least 64 characters')
      }
      if (environment.EMAIL_SMTP_HOST) {
        addIssue(context, 'EMAIL_SMTP_HOST', 'must be unset when Brevo delivery is selected')
      }
    } else {
      if (!environment.EMAIL_SMTP_HOST) {
        addIssue(context, 'EMAIL_SMTP_HOST', 'is required for SMTP delivery')
      }
      if (environment.BREVO_API_KEY || environment.BREVO_WEBHOOK_TOKEN) {
        addIssue(context, 'BREVO_API_KEY', 'must be unset when SMTP delivery is selected')
      }
    }

    const secrets: Array<[string, string | undefined]> = [
      ['BETTER_AUTH_SECRET', environment.BETTER_AUTH_SECRET],
      ['BREVO_API_KEY', environment.BREVO_API_KEY],
      ['BREVO_WEBHOOK_TOKEN', environment.BREVO_WEBHOOK_TOKEN],
      ['DATABASE_ENCRYPTION_KEY', environment.DATABASE_ENCRYPTION_KEY],
      ['IMGPROXY_KEY', environment.IMGPROXY_KEY],
      ['IMGPROXY_SALT', environment.IMGPROXY_SALT],
      ['MEILISEARCH_API_KEY', environment.MEILISEARCH_API_KEY],
      ['METRICS_TOKEN', environment.METRICS_TOKEN],
      ['MOLLIE_API_KEY', environment.MOLLIE_API_KEY],
      ['MOLLIE_CLIENT_SECRET', environment.MOLLIE_CLIENT_SECRET],
      ['S3_ACCESS_KEY_ID', environment.S3_ACCESS_KEY_ID],
      ['S3_SECRET_ACCESS_KEY', environment.S3_SECRET_ACCESS_KEY],
      ['SENDCLOUD_SECRET_KEY', environment.SENDCLOUD_SECRET_KEY],
      ['SENDCLOUD_WEBHOOK_SECRET', environment.SENDCLOUD_WEBHOOK_SECRET],
    ]
    for (const [name, value] of secrets) {
      if (value && forbiddenPlaceholderPattern.test(value)) {
        addIssue(context, name, 'must not contain a placeholder value')
      }
    }
  })

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

function addIssue(context: z.RefinementCtx, name: string, message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message })
}

function requireEnabled(context: z.RefinementCtx, value: string, name: string): void {
  if (value !== 'true') addIssue(context, name, 'is launch-required and must be explicitly true')
}

function parseStorageEndpoint(
  appEnvironment: 'staging' | 'production',
  value: string,
  context: z.RefinementCtx,
): URL | null {
  if (appEnvironment === 'staging' && value === 'http://garage:3900') {
    return new URL(value)
  }
  return parseHttpsUrl('S3_ENDPOINT', value, context)
}

function parseHttpsUrl(name: string, value: string, context: z.RefinementCtx): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) {
      addIssue(context, name, 'must be an absolute HTTPS URL without credentials')
      return null
    }
    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('127.') ||
      !hostname.includes('.')
    ) {
      addIssue(context, name, 'must not use localhost or an internal hostname')
      return null
    }
    return url
  } catch {
    addIssue(context, name, 'must be an absolute HTTPS URL')
    return null
  }
}

function validateDatabaseUrl(value: string, context: z.RefinementCtx): void {
  try {
    const url = new URL(value)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password) {
      addIssue(context, 'DATABASE_URL', 'must be an authenticated PostgreSQL URL')
    }
  } catch {
    addIssue(context, 'DATABASE_URL', 'must be a valid PostgreSQL URL')
  }
}

function validateEncryptionKey(value: string, context: z.RefinementCtx): void {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    addIssue(context, 'DATABASE_ENCRYPTION_KEY', 'must be canonical base64 for exactly 32 bytes')
    return
  }
  const decoded = Buffer.from(value, 'base64')
  if (decoded.length !== 32 || decoded.toString('base64') !== value) {
    addIssue(context, 'DATABASE_ENCRYPTION_KEY', 'must decode to exactly 32 bytes')
  }
}

function validateHexSecret(name: string, value: string, context: z.RefinementCtx): void {
  if (!/^[a-fA-F0-9]{64,}$/.test(value) || value.length % 2 !== 0) {
    addIssue(context, name, 'must be an even-length hexadecimal secret of at least 32 bytes')
  }
}

function formatIssues(error: z.ZodError): Error {
  const uniqueIssues = new Set(
    error.issues.map((issue) => `- ${String(issue.path[0] ?? 'configuration')}: ${issue.message}`),
  )
  return new Error(
    `Invalid server environment configuration:\n${Array.from(uniqueIssues).join('\n')}`,
  )
}

export function parseServerEnvironment(
  input: Record<string, string | undefined>,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(input)
  if (!result.success) throw formatIssues(result.error)

  try {
    parsePublicBuildEnvironment(input)
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Invalid browser-visible environment configuration')
  }

  return result.data
}

export function assertValidServerEnvironment(
  input: Record<string, string | undefined> = process.env,
): ServerEnvironment | undefined {
  if (input.NODE_ENV !== 'production') return undefined
  return parseServerEnvironment(input)
}
