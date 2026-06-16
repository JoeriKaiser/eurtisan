import { randomUUID } from 'node:crypto'
import { db } from '#/db/index'
import * as schema from '#/db/schema'
import type { UserLike } from '#/test/helpers'

export async function createSession(
  user: UserLike | string,
  overrides?: Partial<typeof schema.session.$inferInsert>,
): Promise<typeof schema.session.$inferSelect> {
  const userId = typeof user === 'string' ? user : user.id
  const [row] = await db
    .insert(schema.session)
    .values({
      id: `session-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning()
  return row
}

export async function createVerification(
  overrides?: Partial<typeof schema.verification.$inferInsert>,
): Promise<typeof schema.verification.$inferSelect> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.verification)
    .values({
      id: `verification-${suffix}`,
      identifier: `test-${suffix}`,
      value: randomUUID(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning()
  return row
}

export async function createRateLimit(
  overrides?: Partial<typeof schema.rateLimit.$inferInsert>,
): Promise<typeof schema.rateLimit.$inferSelect> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.rateLimit)
    .values({
      key: `rate-limit-${suffix}`,
      windowStart: new Date(),
      count: 1,
      ...overrides,
    })
    .returning()
  return row
}

export async function createAuditLog(
  actor: UserLike | string,
  overrides?: Partial<typeof schema.auditLog.$inferInsert>,
): Promise<typeof schema.auditLog.$inferSelect> {
  const actorId = typeof actor === 'string' ? actor : actor.id
  const [row] = await db
    .insert(schema.auditLog)
    .values({
      actorId,
      actorName: overrides?.actorName ?? 'Test Actor',
      action: 'test_action',
      resourceType: 'test_resource',
      ...overrides,
    })
    .returning()
  return row
}

export async function createMeilisearchSyncQueue(
  overrides?: Partial<typeof schema.meilisearchSyncQueue.$inferInsert>,
): Promise<typeof schema.meilisearchSyncQueue.$inferSelect> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.meilisearchSyncQueue)
    .values({
      productId: `prod-${suffix}`,
      action: 'index',
      status: 'pending',
      ...overrides,
    })
    .returning()
  return row
}

export async function createSendcloudWebhookEvent(
  overrides?: Partial<typeof schema.sendcloudWebhookEvent.$inferInsert>,
): Promise<typeof schema.sendcloudWebhookEvent.$inferSelect> {
  const [row] = await db
    .insert(schema.sendcloudWebhookEvent)
    .values({
      payload: {},
      status: 'pending',
      ...overrides,
    })
    .returning()
  return row
}

export async function createPayoutReconciliationLog(
  payout: { id: string } | string,
  overrides?: Partial<typeof schema.payoutReconciliationLog.$inferInsert>,
): Promise<typeof schema.payoutReconciliationLog.$inferSelect> {
  const payoutId = typeof payout === 'string' ? payout : payout.id
  const [row] = await db
    .insert(schema.payoutReconciliationLog)
    .values({
      payoutId,
      event: 'test_event',
      ...overrides,
    })
    .returning()
  return row
}

export async function createEmailSuppression(
  overrides?: Partial<typeof schema.emailSuppression.$inferInsert>,
): Promise<typeof schema.emailSuppression.$inferSelect> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.emailSuppression)
    .values({
      email: `suppressed-${suffix}@example.com`,
      reason: 'bounce',
      ...overrides,
    })
    .returning()
  return row
}

export async function createAccount(
  user: UserLike | string,
  overrides?: Partial<typeof schema.account.$inferInsert>,
): Promise<typeof schema.account.$inferSelect> {
  const userId = typeof user === 'string' ? user : user.id
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.account)
    .values({
      id: `account-${suffix}`,
      userId,
      accountId: `account-id-${suffix}`,
      providerId: 'credentials',
      ...overrides,
    })
    .returning()
  return row
}

export async function createTwoFactor(
  user: UserLike | string,
  overrides?: Partial<typeof schema.twoFactor.$inferInsert>,
): Promise<typeof schema.twoFactor.$inferSelect> {
  const userId = typeof user === 'string' ? user : user.id
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.twoFactor)
    .values({
      id: `two-factor-${suffix}`,
      userId,
      secret: randomUUID(),
      backupCodes: randomUUID(),
      ...overrides,
    })
    .returning()
  return row
}
