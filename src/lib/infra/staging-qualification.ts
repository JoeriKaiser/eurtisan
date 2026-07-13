import z from 'zod'

export const STAGING_QUALIFICATION_CHECKS = [
  { id: 'release.ci-gates', mode: 'repository', required: true },
  { id: 'release.immutable-image', mode: 'staging', required: true },
  { id: 'release.public-config', mode: 'remote-smoke', required: true },
  { id: 'infrastructure.eu-region', mode: 'staging', required: true },
  { id: 'infrastructure.dns-tls', mode: 'remote-smoke', required: true },
  { id: 'security.headers-csp', mode: 'remote-smoke', required: true },
  { id: 'security.cookies', mode: 'staging', required: true },
  { id: 'security.csrf', mode: 'staging', required: true },
  { id: 'security.rate-limits', mode: 'staging', required: true },
  { id: 'security.proxy-headers', mode: 'staging', required: true },
  { id: 'health.liveness-readiness', mode: 'remote-smoke', required: true },
  { id: 'database.migrations', mode: 'staging', required: true },
  { id: 'database.backup-restore', mode: 'staging', required: true },
  { id: 'jobs.required-services', mode: 'staging', required: true },
  { id: 'jobs.reconciliation', mode: 'staging', required: true },
  { id: 'jobs.financial-discrepancy-detection', mode: 'staging', required: true },
  { id: 'provider.mollie-payments', mode: 'provider-sandbox', required: true },
  { id: 'provider.mollie-connect', mode: 'provider-sandbox', required: true },
  { id: 'provider.sendcloud', mode: 'provider-sandbox', required: true },
  { id: 'provider.email', mode: 'provider-sandbox', required: true },
  { id: 'provider.vies', mode: 'provider-sandbox', required: true },
  { id: 'provider.meilisearch', mode: 'staging', required: true },
  { id: 'provider.storage-imgproxy', mode: 'staging', required: true },
  { id: 'observability.logs-traces-metrics', mode: 'staging', required: true },
  { id: 'observability.alert-routing', mode: 'staging', required: true },
  { id: 'resilience.rollback', mode: 'staging', required: true },
  { id: 'performance.load-budgets', mode: 'staging', required: true },
  { id: 'quality.production-e2e-2fa', mode: 'staging', required: true },
  { id: 'quality.accessibility', mode: 'staging', required: true },
  { id: 'approval.operations', mode: 'owner', required: true },
  { id: 'approval.security', mode: 'owner', required: true },
  { id: 'approval.accessibility', mode: 'owner', required: true },
  { id: 'approval.privacy', mode: 'owner', required: true },
  { id: 'approval.legal', mode: 'owner', required: true },
] as const

export type StagingQualificationCheckId = (typeof STAGING_QUALIFICATION_CHECKS)[number]['id']

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/)
const evidenceReferenceSchema = z.string().refine(
  (value) => {
    if (value.startsWith('https://')) return true
    return (
      !value.startsWith('/') &&
      !value.split('/').includes('..') &&
      /^(?:docs|evidence|reports)\/[A-Za-z0-9._/-]+$/.test(value)
    )
  },
  { message: 'Evidence references must be HTTPS URLs or safe repository-relative paths' },
)

const unsafeEvidencePatterns = [
  /\b(?:live|test)_[A-Za-z0-9_-]{20,}\b/i,
  /\bBearer\s+\S+/i,
  /\b(?:password|secret|token|api[_ -]?key|cookie)\s*[:=]\s*\S+/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
]

export function containsUnsafeEvidenceText(value: string): boolean {
  return unsafeEvidencePatterns.some((pattern) => pattern.test(value))
}

const safeNotesSchema = z
  .string()
  .max(2_000)
  .refine((value) => !containsUnsafeEvidenceText(value), {
    message: 'Evidence notes must not contain credentials, cookies, tokens, or email addresses',
  })

const checkResultSchema = z.object({
  id: z.enum(
    STAGING_QUALIFICATION_CHECKS.map(({ id }) => id) as [
      StagingQualificationCheckId,
      ...StagingQualificationCheckId[],
    ],
  ),
  status: z.enum(['passed', 'failed', 'blocked', 'not-run']),
  observedAt: z.string().datetime().nullable(),
  executor: z.string().min(1).max(100).nullable(),
  evidence: z.array(evidenceReferenceSchema).max(20),
  notes: safeNotesSchema,
})

export const stagingQualificationEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  qualificationId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/),
  environment: z.literal('staging'),
  euRegion: z.string().min(2).max(100),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  release: z.object({
    gitSha: gitShaSchema,
    imageRepository: z.string().min(1).max(200),
    imageDigest: digestSchema,
    publicConfigDigest: digestSchema,
  }),
  checks: z.array(checkResultSchema),
  knownRisks: z.array(safeNotesSchema).max(50),
})

export type StagingQualificationEvidence = z.infer<typeof stagingQualificationEvidenceSchema>

export function createStagingQualificationDraft(input: {
  qualificationId: string
  euRegion: string
  startedAt: string
  gitSha: string
  imageRepository: string
  imageDigest: string
  publicConfigDigest: string
}): StagingQualificationEvidence {
  return stagingQualificationEvidenceSchema.parse({
    schemaVersion: 1,
    qualificationId: input.qualificationId,
    environment: 'staging',
    euRegion: input.euRegion,
    startedAt: input.startedAt,
    completedAt: null,
    release: {
      gitSha: input.gitSha,
      imageRepository: input.imageRepository,
      imageDigest: input.imageDigest,
      publicConfigDigest: input.publicConfigDigest,
    },
    checks: STAGING_QUALIFICATION_CHECKS.map(({ id }) => ({
      id,
      status: 'not-run',
      observedAt: null,
      executor: null,
      evidence: [],
      notes: '',
    })),
    knownRisks: [],
  })
}

export function validateStagingQualificationEvidence(
  value: unknown,
  options: { final: boolean },
): StagingQualificationEvidence {
  const evidence = stagingQualificationEvidenceSchema.parse(value)
  const expected = new Set(STAGING_QUALIFICATION_CHECKS.map(({ id }) => id))
  const seen = new Set<string>()

  for (const result of evidence.checks) {
    if (seen.has(result.id)) throw new Error(`Duplicate qualification check: ${result.id}`)
    seen.add(result.id)
    if (result.status === 'passed' && (result.observedAt === null || result.executor === null)) {
      throw new Error(`Passed check ${result.id} requires an observation time and executor`)
    }
  }

  for (const id of expected) {
    if (!seen.has(id)) throw new Error(`Missing qualification check: ${id}`)
  }
  if (seen.size !== expected.size) throw new Error('Qualification evidence contains unknown checks')

  if (options.final) {
    if (evidence.completedAt === null) throw new Error('Final qualification requires completedAt')
    const incomplete = evidence.checks.filter(({ status }) => status !== 'passed')
    if (incomplete.length > 0) {
      throw new Error(
        `Final qualification has incomplete checks: ${incomplete.map(({ id }) => id).join(', ')}`,
      )
    }
  }

  return evidence
}

export interface PublicStagingCheckResult {
  id: string
  status: 'passed' | 'failed'
  detail: string
}

export async function runPublicStagingChecks(input: {
  baseUrl: string
  expectedRelease: string
  fetchImplementation?: typeof fetch
}): Promise<PublicStagingCheckResult[]> {
  const baseUrl = new URL(input.baseUrl)
  if (baseUrl.protocol !== 'https:') throw new Error('Staging qualification requires an HTTPS URL')
  if (!gitShaSchema.safeParse(input.expectedRelease).success) {
    throw new Error('Expected release must be a full 40-character Git SHA')
  }
  const request = input.fetchImplementation ?? fetch
  const results: PublicStagingCheckResult[] = []
  const record = (id: string, passed: boolean, detail: string) => {
    results.push({ id, status: passed ? 'passed' : 'failed', detail })
  }

  try {
    const root = await request(baseUrl, { redirect: 'error' })
    record('infrastructure.dns-tls', root.ok, `HTTPS root returned ${root.status}`)
    const requiredHeaders = [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'permissions-policy',
    ]
    const missingHeaders = requiredHeaders.filter((header) => !root.headers.get(header))
    record(
      'security.headers-csp',
      missingHeaders.length === 0,
      missingHeaders.length === 0
        ? 'Required security headers are present'
        : `Missing: ${missingHeaders.join(', ')}`,
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'HTTPS request failed'
    record('infrastructure.dns-tls', false, detail)
    record('security.headers-csp', false, 'Root response was unavailable')
  }

  const healthPaths = ['/api/health/live', '/api/health/ready', '/api/health', '/api/health/deps']
  const unhealthy: string[] = []
  for (const path of healthPaths) {
    try {
      const response = await request(new URL(path, baseUrl))
      const contentType = response.headers.get('content-type') ?? ''
      if (!response.ok || !contentType.includes('application/json'))
        unhealthy.push(`${path}:${response.status}`)
    } catch {
      unhealthy.push(`${path}:unreachable`)
    }
  }
  record(
    'health.liveness-readiness',
    unhealthy.length === 0,
    unhealthy.length === 0
      ? 'All health endpoints returned JSON success'
      : `Failed: ${unhealthy.join(', ')}`,
  )

  try {
    const response = await request(new URL('/client-config.json', baseUrl))
    const config = (await response.json()) as Record<string, unknown>
    const actualRelease = config.VITE_APP_VERSION
    record(
      'release.public-config',
      response.ok && actualRelease === input.expectedRelease,
      actualRelease === input.expectedRelease
        ? 'Compiled release matches expected Git SHA'
        : 'Compiled release does not match expected Git SHA',
    )
  } catch {
    record('release.public-config', false, 'Client configuration manifest was unavailable')
  }

  return results
}
