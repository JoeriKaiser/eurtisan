/**
 * Send log / audit table for emails.
 *
 * This is the only module that inserts into `email_send_log`. Callers must
 * pass the hashed recipient address, never the raw email.
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { emailSendLog } from '#/db/schema'
import type { EmailTemplate } from '#/lib/email-provider'
import type { EmailCategory } from '#/lib/email-preferences.server'

export interface LogEmailEventOptions {
  outboxId?: string
  recipientHash: string
  template: EmailTemplate
  category: EmailCategory
  provider: string
  providerMessageId?: string
  status: 'accepted' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'suppressed' | 'skipped'
  statusDetail?: string
  eventData?: Record<string, unknown>
}

export async function logEmailEvent(options: LogEmailEventOptions): Promise<void> {
  await db.insert(emailSendLog).values({
    outboxId: options.outboxId,
    recipientHash: options.recipientHash,
    template: options.template,
    category: options.category,
    provider: options.provider,
    providerMessageId: options.providerMessageId,
    status: options.status,
    statusDetail: options.statusDetail,
    eventData: options.eventData,
  })
}

/**
 * Look up the most recent send log row for a provider message id.
 */
export async function findSendLogByProviderMessageId(
  provider: string,
  messageId: string,
): Promise<typeof emailSendLog.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(emailSendLog)
    .where(and(eq(emailSendLog.provider, provider), eq(emailSendLog.providerMessageId, messageId)))
    .orderBy(desc(emailSendLog.createdAt))
    .limit(1)

  return row
}

/**
 * Look up the most recent send log row for a recipient hash within the last
 * 7 days. Used by webhook processors when the provider message id is missing.
 */
export async function findRecentSendLogByRecipientHash(
  recipientHash: string,
  provider: string,
): Promise<typeof emailSendLog.$inferSelect | undefined> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [row] = await db
    .select()
    .from(emailSendLog)
    .where(
      and(
        eq(emailSendLog.recipientHash, recipientHash),
        eq(emailSendLog.provider, provider),
        gte(emailSendLog.createdAt, sevenDaysAgo),
        lte(emailSendLog.createdAt, sql`now()`),
      ),
    )
    .orderBy(desc(emailSendLog.createdAt))
    .limit(1)

  return row
}
