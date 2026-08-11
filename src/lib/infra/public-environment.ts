import z from 'zod'

const PUBLIC_ENVIRONMENT_NAMES = [
  'VITE_ANALYTICS_CONSENT_REQUIRED',
  'VITE_APP_ENV',
  'VITE_APP_VERSION',
  'VITE_FARO_COLLECTOR_URL',
  'VITE_FARO_ENABLED',
  'VITE_FARO_APP_NAME',
  'VITE_FARO_SAMPLE_RATE',
  'VITE_IMGPROXY_BASE_URL',
  'VITE_PUBLIC_URL',
  'VITE_S3_BUCKET',
  'VITE_UMAMI_ENABLED',
  'VITE_UMAMI_HOST_URL',
  'VITE_UMAMI_SCRIPT_INTEGRITY',
  'VITE_UMAMI_SCRIPT_URL',
  'VITE_UMAMI_WEBSITE_ID',
] as const

const SERVER_SECRET_NAMES = [
  'BETTER_AUTH_SECRET',
  'BREVO_API_KEY',
  'BREVO_WEBHOOK_TOKEN',
  'DATABASE_ENCRYPTION_KEY',
  'IMGPROXY_KEY',
  'IMGPROXY_SALT',
  'MEILISEARCH_API_KEY',
  'MEILI_MASTER_KEY',
  'METRICS_TOKEN',
  'MOLLIE_API_KEY',
  'MOLLIE_CLIENT_SECRET',
  'POSTGRES_PASSWORD',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'SENDCLOUD_SECRET_KEY',
  'SENDCLOUD_WEBHOOK_SECRET',
] as const

const forbiddenPlaceholderPattern =
  /(?:^|[^a-z])(?:change[-_ ]?me|your[-_ ]|replace[-_ ]?me|placeholder|example[-_ ]?(?:key|token|secret|id)|dummy|todo)(?=$|[^a-z])/i
const internalHostnames = new Set(['db', 'garage', 'imgproxy', 'meilisearch'])

const requiredString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1),
)
const explicitBoolean = z.enum(['true', 'false'])

const publicEnvironmentSchema = z
  .object({
    VITE_ANALYTICS_CONSENT_REQUIRED: explicitBoolean,
    VITE_APP_ENV: z.enum(['development', 'staging', 'production', 'test']),
    VITE_APP_VERSION: requiredString,
    VITE_FARO_COLLECTOR_URL: requiredString,
    VITE_FARO_ENABLED: explicitBoolean,
    VITE_FARO_APP_NAME: requiredString,
    VITE_FARO_SAMPLE_RATE: z.coerce.number().min(0).max(1),
    VITE_IMGPROXY_BASE_URL: requiredString,
    VITE_PUBLIC_URL: requiredString,
    VITE_S3_BUCKET: requiredString,
    VITE_UMAMI_ENABLED: explicitBoolean,
    VITE_UMAMI_HOST_URL: z.string().trim().optional(),
    VITE_UMAMI_SCRIPT_INTEGRITY: z.string().trim().optional(),
    VITE_UMAMI_SCRIPT_URL: z.string().trim().optional(),
    VITE_UMAMI_WEBSITE_ID: z.string().trim().optional(),
  })
  .superRefine((environment, context) => {
    const strict =
      environment.VITE_APP_ENV === 'production' || environment.VITE_APP_ENV === 'staging'
    if (!strict) return

    const publicUrl = validatePublicHttpsUrl(
      'VITE_PUBLIC_URL',
      environment.VITE_PUBLIC_URL,
      context,
    )
    const imgproxyUrl = validatePublicHttpsUrl(
      'VITE_IMGPROXY_BASE_URL',
      environment.VITE_IMGPROXY_BASE_URL,
      context,
    )

    if (publicUrl && imgproxyUrl) {
      requireSameOrigin('VITE_IMGPROXY_BASE_URL', publicUrl, imgproxyUrl, context)
      if (normalizePath(imgproxyUrl.pathname) !== '/uploads') {
        addIssue(context, 'VITE_IMGPROXY_BASE_URL', 'must use the public /uploads route')
      }
    }

    if (environment.VITE_FARO_ENABLED !== 'true') {
      addIssue(context, 'VITE_FARO_ENABLED', 'must be true in staging and production')
    }
    if (environment.VITE_FARO_COLLECTOR_URL !== '/collect') {
      addIssue(context, 'VITE_FARO_COLLECTOR_URL', 'must use the same-origin /collect route')
    }
    if (environment.VITE_ANALYTICS_CONSENT_REQUIRED !== 'true') {
      addIssue(context, 'VITE_ANALYTICS_CONSENT_REQUIRED', 'must be true in shared environments')
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{6,127}$/.test(environment.VITE_APP_VERSION)) {
      addIssue(context, 'VITE_APP_VERSION', 'must be an immutable release identifier')
    }
    if (
      /^(?:dev|development|staging|production|prod|main|master|latest)$/i.test(
        environment.VITE_APP_VERSION,
      )
    ) {
      addIssue(context, 'VITE_APP_VERSION', 'must not be a mutable environment or branch label')
    }
    if (!/^[a-z0-9][a-z0-9.-]{2,62}$/.test(environment.VITE_S3_BUCKET)) {
      addIssue(context, 'VITE_S3_BUCKET', 'must be a valid S3 bucket name')
    }

    for (const name of PUBLIC_ENVIRONMENT_NAMES) {
      const value = environment[name]
      if (typeof value === 'string' && value && forbiddenPlaceholderPattern.test(value)) {
        addIssue(context, name, 'must not contain a placeholder value')
      }
    }

    const umamiValues = [
      environment.VITE_UMAMI_SCRIPT_URL,
      environment.VITE_UMAMI_WEBSITE_ID,
      environment.VITE_UMAMI_HOST_URL,
      environment.VITE_UMAMI_SCRIPT_INTEGRITY,
    ].filter(Boolean)
    if (environment.VITE_UMAMI_ENABLED === 'true') {
      if (!environment.VITE_UMAMI_SCRIPT_URL) {
        addIssue(context, 'VITE_UMAMI_SCRIPT_URL', 'is required when Umami is enabled')
      } else {
        validatePublicHttpsUrl('VITE_UMAMI_SCRIPT_URL', environment.VITE_UMAMI_SCRIPT_URL, context)
      }
      if (!environment.VITE_UMAMI_WEBSITE_ID) {
        addIssue(context, 'VITE_UMAMI_WEBSITE_ID', 'is required when Umami is enabled')
      }
      if (
        environment.VITE_UMAMI_HOST_URL &&
        !validatePublicHttpsUrl('VITE_UMAMI_HOST_URL', environment.VITE_UMAMI_HOST_URL, context)
      ) {
        return
      }
    } else if (umamiValues.length > 0) {
      addIssue(context, 'VITE_UMAMI_ENABLED', 'must be true when Umami configuration is present')
    }
  })

export type PublicBuildEnvironment = z.infer<typeof publicEnvironmentSchema>

function addIssue(context: z.RefinementCtx, name: string, message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message })
}

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function validatePublicHttpsUrl(name: string, value: string, context: z.RefinementCtx): URL | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    addIssue(context, name, 'must be an absolute HTTPS URL')
    return null
  }

  const hostname = url.hostname.toLowerCase()
  const isIpv4Loopback = hostname === '0.0.0.0' || hostname.startsWith('127.')
  const isInternal =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    internalHostnames.has(hostname) ||
    (!hostname.includes('.') && hostname !== '[::1]')

  if (url.protocol !== 'https:' || isIpv4Loopback || hostname === '[::1]' || isInternal) {
    addIssue(context, name, 'must be browser-reachable HTTPS and must not use an internal hostname')
    return null
  }
  if (url.username || url.password) {
    addIssue(context, name, 'must not contain credentials')
    return null
  }
  return url
}

function requireSameOrigin(
  name: string,
  publicUrl: URL,
  integrationUrl: URL,
  context: z.RefinementCtx,
): void {
  if (publicUrl.origin !== integrationUrl.origin) {
    addIssue(context, name, 'must use the same public origin as VITE_PUBLIC_URL')
  }
}

function formatIssues(prefix: string, error: z.ZodError): Error {
  const messages = error.issues.map((issue) => {
    const name = issue.path[0] ?? 'configuration'
    return `- ${String(name)}: ${issue.message}`
  })
  return new Error(`${prefix}:\n${messages.join('\n')}`)
}

export function selectExplicitPublicBuildEnvironment(
  input: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([name]) =>
        !name.startsWith('VITE_') ||
        PUBLIC_ENVIRONMENT_NAMES.includes(name as (typeof PUBLIC_ENVIRONMENT_NAMES)[number]),
    ),
  )
}

export function parsePublicBuildEnvironment(
  input: Record<string, string | undefined>,
): PublicBuildEnvironment {
  const unknownPublicNames = Object.keys(input)
    .filter((name) => name.startsWith('VITE_'))
    .filter(
      (name) =>
        !PUBLIC_ENVIRONMENT_NAMES.includes(name as (typeof PUBLIC_ENVIRONMENT_NAMES)[number]),
    )
    .sort()

  const strict = input.VITE_APP_ENV === 'production' || input.VITE_APP_ENV === 'staging'
  if (strict && unknownPublicNames.length > 0) {
    throw new Error(
      `Invalid browser-visible environment configuration:\n${unknownPublicNames
        .map((name) => `- ${name}: is not an approved browser-visible variable`)
        .join('\n')}`,
    )
  }

  const result = publicEnvironmentSchema.safeParse(input)
  if (!result.success) {
    throw formatIssues('Invalid browser-visible environment configuration', result.error)
  }

  if (strict) {
    for (const publicName of PUBLIC_ENVIRONMENT_NAMES) {
      const publicValue = result.data[publicName]
      if (typeof publicValue !== 'string' || publicValue.length === 0) continue
      for (const secretName of SERVER_SECRET_NAMES) {
        const secretValue = input[secretName]
        if (secretValue && secretValue.length >= 8 && publicValue === secretValue) {
          throw new Error(
            `Invalid browser-visible environment configuration:\n- ${publicName}: must not equal server secret ${secretName}`,
          )
        }
      }
    }
  }

  return result.data
}

export function toPublicEnvironmentManifest(
  environment: PublicBuildEnvironment,
): Record<(typeof PUBLIC_ENVIRONMENT_NAMES)[number], string | number | undefined> {
  return Object.fromEntries(
    PUBLIC_ENVIRONMENT_NAMES.map((name) => [name, environment[name]]),
  ) as Record<(typeof PUBLIC_ENVIRONMENT_NAMES)[number], string | number | undefined>
}
