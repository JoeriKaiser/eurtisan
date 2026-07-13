import { describe, expect, it, vi } from 'vitest'

import {
  containsUnsafeEvidenceText,
  createStagingQualificationDraft,
  runPublicStagingChecks,
  STAGING_QUALIFICATION_CHECKS,
  validateStagingQualificationEvidence,
} from './staging-qualification'

const gitSha = 'a'.repeat(40)
const digest = `sha256:${'b'.repeat(64)}`

function makeEvidence() {
  return {
    schemaVersion: 1,
    qualificationId: 'staging-2026-07-13-release-a',
    environment: 'staging',
    euRegion: 'fr-par',
    startedAt: '2026-07-13T10:00:00.000Z',
    completedAt: null,
    release: {
      gitSha,
      imageRepository: 'registry.example.invalid/eurtisan/app',
      imageDigest: digest,
      publicConfigDigest: digest,
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
  }
}

describe('staging qualification evidence', () => {
  it('creates and accepts a complete draft without treating it as launch evidence', () => {
    const draft = createStagingQualificationDraft({
      qualificationId: 'staging-2026-07-13-release-a',
      euRegion: 'fr-par',
      startedAt: '2026-07-13T10:00:00.000Z',
      gitSha,
      imageRepository: 'registry.example.invalid/eurtisan/app',
      imageDigest: digest,
      publicConfigDigest: digest,
    })
    const result = validateStagingQualificationEvidence(draft, { final: false })
    expect(result.checks).toHaveLength(STAGING_QUALIFICATION_CHECKS.length)
    expect(result.checks.every(({ status }) => status === 'not-run')).toBe(true)
  })

  it('rejects missing checks, duplicate checks, and incomplete final evidence', () => {
    const missing = makeEvidence()
    missing.checks.pop()
    expect(() => validateStagingQualificationEvidence(missing, { final: false })).toThrow(
      'Missing qualification check',
    )

    const duplicate = makeEvidence()
    duplicate.checks[1] = duplicate.checks[0] as (typeof duplicate.checks)[number]
    expect(() => validateStagingQualificationEvidence(duplicate, { final: false })).toThrow(
      'Duplicate qualification check',
    )

    expect(() => validateStagingQualificationEvidence(makeEvidence(), { final: true })).toThrow(
      'completedAt',
    )
  })

  it('rejects credentials and PII in evidence text', () => {
    expect(containsUnsafeEvidenceText('Authorization: Bearer abc.def.ghi')).toBe(true)
    expect(containsUnsafeEvidenceText('api_key=super-sensitive-value')).toBe(true)
    expect(containsUnsafeEvidenceText('contact owner@example.com')).toBe(true)
    expect(
      containsUnsafeEvidenceText('Provider sandbox flow completed; dashboard evidence linked.'),
    ).toBe(false)

    const evidence = makeEvidence()
    evidence.checks[0] = {
      ...evidence.checks[0],
      notes: 'token=must-not-be-recorded',
    } as (typeof evidence.checks)[number]
    expect(() => validateStagingQualificationEvidence(evidence, { final: false })).toThrow(
      'must not contain credentials',
    )
  })
})

describe('public staging smoke checks', () => {
  it('verifies TLS reachability, headers, health probes, and compiled release', async () => {
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      if (url.pathname === '/client-config.json') {
        return Response.json({ VITE_APP_VERSION: gitSha })
      }
      if (url.pathname.startsWith('/api/health')) {
        return Response.json({ status: 'ok' })
      }
      return new Response('', {
        status: 200,
        headers: {
          'Content-Security-Policy': "default-src 'self'",
          'Strict-Transport-Security': 'max-age=31536000',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=()',
        },
      })
    })

    const result = await runPublicStagingChecks({
      baseUrl: 'https://staging.example.invalid',
      expectedRelease: gitSha,
      fetchImplementation,
    })

    expect(result).toEqual([
      { id: 'infrastructure.dns-tls', status: 'passed', detail: 'HTTPS root returned 200' },
      {
        id: 'security.headers-csp',
        status: 'passed',
        detail: 'Required security headers are present',
      },
      {
        id: 'health.liveness-readiness',
        status: 'passed',
        detail: 'All health endpoints returned JSON success',
      },
      {
        id: 'release.public-config',
        status: 'passed',
        detail: 'Compiled release matches expected Git SHA',
      },
    ])
  })

  it('rejects non-HTTPS targets before making a request', async () => {
    await expect(
      runPublicStagingChecks({ baseUrl: 'http://localhost:3000', expectedRelease: gitSha }),
    ).rejects.toThrow('requires an HTTPS URL')
  })
})
