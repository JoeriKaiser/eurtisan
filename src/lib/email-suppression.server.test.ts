import { beforeEach, describe, expect, it } from 'vitest'

import { isEmailSuppressed, suppressEmail } from './email-suppression.server'
import { createEmailSuppression } from '#/test/factories'
import { clearTestTables } from '#/test/cleanup'

beforeEach(async () => {
  await clearTestTables()
})

describe('isEmailSuppressed', () => {
  it('returns true for a permanent suppression', async () => {
    const row = await createEmailSuppression({ reason: 'hard_bounce' })
    expect(await isEmailSuppressed(row.email)).toBe(true)
  })

  it('returns true for a soft-bounce suppression that has not expired', async () => {
    const row = await createEmailSuppression({
      reason: 'soft_bounce',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    expect(await isEmailSuppressed(row.email)).toBe(true)
  })

  it('returns false for a soft-bounce suppression that has expired', async () => {
    const row = await createEmailSuppression({
      reason: 'soft_bounce',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })
    expect(await isEmailSuppressed(row.email)).toBe(false)
  })

  it('returns false when no suppression exists', async () => {
    expect(await isEmailSuppressed('not-suppressed@example.com')).toBe(false)
  })
})

describe('suppressEmail', () => {
  it('records a suppression entry', async () => {
    await suppressEmail('new@example.com', 'hard_bounce')
    expect(await isEmailSuppressed('new@example.com')).toBe(true)
  })
})
