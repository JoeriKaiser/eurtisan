import { eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { user } from '#/db/schema'
import { createEmailProvider } from '#/integrations/email'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 30

export interface LockoutStatus {
  locked: boolean
  retryAfterSeconds: number
}

export async function checkAccountLockout(email: string): Promise<LockoutStatus> {
  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
  })

  if (!targetUser?.lockedUntil) {
    return { locked: false, retryAfterSeconds: 0 }
  }

  const now = new Date()
  if (targetUser.lockedUntil > now) {
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((targetUser.lockedUntil.getTime() - now.getTime()) / 1000),
    )
    return { locked: true, retryAfterSeconds }
  }

  return { locked: false, retryAfterSeconds: 0 }
}

export async function recordSuccessfulSignIn(email: string): Promise<void> {
  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
  })

  if (!targetUser) return

  if (targetUser.failedLoginAttempts && targetUser.failedLoginAttempts > 0) {
    await db
      .update(user)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(user.id, targetUser.id))
  }
}

export async function recordFailedSignIn(email: string): Promise<void> {
  const targetUser = await db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
  })

  if (!targetUser) return

  const newAttempts = (targetUser.failedLoginAttempts ?? 0) + 1
  let lockedUntil: Date | null = null

  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
  }

  await db
    .update(user)
    .set({ failedLoginAttempts: newAttempts, lockedUntil })
    .where(eq(user.id, targetUser.id))

  if (lockedUntil) {
    const emailProvider = createEmailProvider()
    await emailProvider
      .sendTransactional(targetUser.email, 'account_security_alert', {
        userName: targetUser.name,
        lockoutDurationMinutes: LOCKOUT_DURATION_MINUTES,
      })
      .catch(() => {
        // Intentionally swallowed — do not fail authentication because email failed
      })
  }
}
