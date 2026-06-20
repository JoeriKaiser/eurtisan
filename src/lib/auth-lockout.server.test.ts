import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { user } from '#/db/schema'
import { createEmailProvider } from '#/integrations/email'
import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'
import {
  checkAccountLockout,
  recordFailedSignIn,
  recordSuccessfulSignIn,
} from './auth-lockout.server'

vi.mock('#/integrations/email', () => ({
  createEmailProvider: vi.fn(() => ({
    name: 'mock',
    sendTransactional: vi.fn(),
  })),
}))

beforeEach(async () => {
  await clearTestTables()
})

afterAll(async () => {
  await clearTestTables()
})

describe('checkAccountLockout', () => {
  it('returns not locked for non-existent user', async () => {
    const result = await checkAccountLockout('nobody@example.com')
    expect(result.locked).toBe(false)
    expect(result.retryAfterSeconds).toBe(0)
  })

  it('returns not locked when lockedUntil is in the past', async () => {
    const u = await createUser({ lockedUntil: new Date(Date.now() - 1000) })
    const result = await checkAccountLockout(u.email)
    expect(result.locked).toBe(false)
  })

  it('returns locked when lockedUntil is in the future', async () => {
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000)
    const u = await createUser({ lockedUntil })
    const result = await checkAccountLockout(u.email)
    expect(result.locked).toBe(true)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe('recordSuccessfulSignIn', () => {
  it('resets failed attempts and lockedUntil', async () => {
    const u = await createUser({
      failedLoginAttempts: 3,
      lockedUntil: new Date(Date.now() + 1000),
    })
    await recordSuccessfulSignIn(u.email)
    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.failedLoginAttempts).toBe(0)
    expect(updated?.lockedUntil).toBeNull()
  })

  it('does nothing for non-existent user', async () => {
    await expect(recordSuccessfulSignIn('nobody@example.com')).resolves.toBeUndefined()
  })
})

describe('recordFailedSignIn', () => {
  it('increments failedLoginAttempts', async () => {
    const u = await createUser({ failedLoginAttempts: 0 })
    await recordFailedSignIn(u.email)
    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.failedLoginAttempts).toBe(1)
    expect(updated?.lockedUntil).toBeNull()
  })

  it('locks account after 5 attempts and sends email', async () => {
    const sendTransactional = vi
      .fn()
      .mockResolvedValue({ messageId: 'mock', accepted: true, provider: 'mock' })
    ;(createEmailProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      name: 'mock',
      sendTransactional,
    } as unknown as ReturnType<typeof createEmailProvider>)

    const u = await createUser({ failedLoginAttempts: 4 })
    await recordFailedSignIn(u.email)
    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.failedLoginAttempts).toBe(5)
    expect(updated?.lockedUntil).not.toBeNull()
    expect(sendTransactional).toHaveBeenCalledTimes(1)
    expect(sendTransactional).toHaveBeenCalledWith(
      u.email,
      'account_security_alert',
      expect.objectContaining({ userName: u.name, lockoutDurationMinutes: 30 }),
    )
  })

  it('does not send email before lockout threshold', async () => {
    const sendTransactional = vi
      .fn()
      .mockResolvedValue({ messageId: 'mock', accepted: true, provider: 'mock' })
    ;(createEmailProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      name: 'mock',
      sendTransactional,
    } as unknown as ReturnType<typeof createEmailProvider>)

    const u = await createUser({ failedLoginAttempts: 2 })
    await recordFailedSignIn(u.email)
    expect(sendTransactional).not.toHaveBeenCalled()
  })
})
