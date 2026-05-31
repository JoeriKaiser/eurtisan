import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { user } from '#/db/schema'
import { createEmailProvider } from '#/integrations/email'
import {
  checkAccountLockout,
  recordFailedSignIn,
  recordSuccessfulSignIn,
} from './auth-lockout.server'

vi.mock('#/integrations/email', () => ({
  createEmailProvider: vi.fn(() => ({
    sendTransactional: vi.fn(),
  })),
}))

beforeEach(async () => {
  await db.delete(user)
})

afterEach(async () => {
  await db.delete(user)
})

async function createTestUser(overrides?: Partial<typeof user.$inferInsert>) {
  const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const email = `${id}@example.com`
  await db.insert(user).values({
    id,
    name: 'Test User',
    email,
    emailVerified: true,
    role: 'customer',
    failedLoginAttempts: 0,
    ...overrides,
  })
  const record = await db.query.user.findFirst({ where: eq(user.id, id) })
  if (!record) throw new Error('Failed to create test user')
  return record
}

describe('checkAccountLockout', () => {
  it('returns not locked for non-existent user', async () => {
    const result = await checkAccountLockout('nobody@example.com')
    expect(result.locked).toBe(false)
    expect(result.retryAfterSeconds).toBe(0)
  })

  it('returns not locked when lockedUntil is in the past', async () => {
    const u = await createTestUser({ lockedUntil: new Date(Date.now() - 1000) })
    const result = await checkAccountLockout(u.email)
    expect(result.locked).toBe(false)
  })

  it('returns locked when lockedUntil is in the future', async () => {
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000)
    const u = await createTestUser({ lockedUntil })
    const result = await checkAccountLockout(u.email)
    expect(result.locked).toBe(true)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe('recordSuccessfulSignIn', () => {
  it('resets failed attempts and lockedUntil', async () => {
    const u = await createTestUser({
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
    const u = await createTestUser({ failedLoginAttempts: 0 })
    await recordFailedSignIn(u.email)
    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.failedLoginAttempts).toBe(1)
    expect(updated?.lockedUntil).toBeNull()
  })

  it('locks account after 5 attempts and sends email', async () => {
    const sendTransactional = vi.fn().mockResolvedValue({ messageId: 'mock', accepted: true })
    ;(createEmailProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      sendTransactional,
    } as unknown as ReturnType<typeof createEmailProvider>)

    const u = await createTestUser({ failedLoginAttempts: 4 })
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
    const sendTransactional = vi.fn().mockResolvedValue({ messageId: 'mock', accepted: true })
    ;(createEmailProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      sendTransactional,
    } as unknown as ReturnType<typeof createEmailProvider>)

    const u = await createTestUser({ failedLoginAttempts: 2 })
    await recordFailedSignIn(u.email)
    expect(sendTransactional).not.toHaveBeenCalled()
  })
})
