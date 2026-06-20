import { sql } from 'drizzle-orm'

import { db } from '#/db/index'
import { user } from '#/db/schema'
import type { EmailTemplate } from './email-provider'
import type { EmailCategory } from './email-preferences.server'
import { getOrCreateUnsubscribeToken } from './email-preferences.server'
import { getBaseUrl } from './env.server'

async function lookupUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const normalized = email.trim().toLowerCase()
  const row = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalized}`)
    .limit(1)

  return row[0] ?? null
}

function categoryToOptOutCategory(
  category: EmailCategory,
): Exclude<EmailCategory, 'transactional' | 'account_security'> | undefined {
  if (category === 'transactional' || category === 'account_security') {
    return undefined
  }
  return category
}

/**
 * Build email headers for a transactional message.
 *
 * Transactional and security emails still get List-Unsubscribe headers for
 * deliverability, but the unsubscribe action only affects opt-out categories.
 */
export async function getEmailHeaders(
  to: string,
  _template: EmailTemplate,
  category: EmailCategory,
): Promise<Record<string, string>> {
  const normalized = to.trim().toLowerCase()
  const userRecord = await lookupUserByEmail(normalized)
  if (!userRecord) return {}

  const token = await getOrCreateUnsubscribeToken(userRecord.id)
  const baseUrl = getBaseUrl()
  const categoryParam = categoryToOptOutCategory(category)
  const url = categoryParam
    ? `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(token)}&category=${categoryParam}`
    : `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`

  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
