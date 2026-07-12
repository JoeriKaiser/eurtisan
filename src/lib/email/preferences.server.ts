import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { auditLog, user, userEmailPreference } from '#/db/schema'

export type EmailCategory =
  | 'transactional'
  | 'account_security'
  | 'seller_updates'
  | 'marketing'
  | 'platform_announcements'

const OPT_OUT_CATEGORY_ARRAY: Exclude<EmailCategory, 'transactional' | 'account_security'>[] = [
  'seller_updates',
  'marketing',
  'platform_announcements',
]

const DEFAULT_ENABLED: Record<
  Exclude<EmailCategory, 'transactional' | 'account_security'>,
  boolean
> = {
  seller_updates: true,
  marketing: false,
  platform_announcements: true,
}

/**
 * Returns true if the user has not disabled the given email category.
 * Transactional and account_security emails are mandatory and always return true.
 */
export async function isEmailEnabledForUser(
  userId: string,
  category: EmailCategory,
): Promise<boolean> {
  if (category === 'transactional' || category === 'account_security') {
    return true
  }

  const preference = await getOrCreateEmailPreference(userId, category)
  return preference.enabled
}

async function getOrCreateEmailPreference(
  userId: string,
  category: Exclude<EmailCategory, 'transactional' | 'account_security'>,
): Promise<{
  category: Exclude<EmailCategory, 'transactional' | 'account_security'>
  enabled: boolean
}> {
  const existing = await db
    .select({ enabled: userEmailPreference.enabled })
    .from(userEmailPreference)
    .where(and(eq(userEmailPreference.userId, userId), eq(userEmailPreference.category, category)))
    .limit(1)

  if (existing[0]) {
    return { category, enabled: existing[0].enabled }
  }

  const defaultEnabled = DEFAULT_ENABLED[category]
  await db.insert(userEmailPreference).values({
    userId,
    category,
    enabled: defaultEnabled,
  })

  return { category, enabled: defaultEnabled }
}

/**
 * Return opt-out categories with localized label/description keys, ensuring a row
 * exists for each category.
 */
export async function getEmailPreferences(userId: string): Promise<
  {
    category: Exclude<EmailCategory, 'transactional' | 'account_security'>
    enabled: boolean
    labelKey: string
    descriptionKey: string
  }[]
> {
  const results = []
  for (const category of OPT_OUT_CATEGORY_ARRAY) {
    const preference = await getOrCreateEmailPreference(userId, category)
    results.push({
      category: preference.category,
      enabled: preference.enabled,
      labelKey: `account_email_preference_${category}`,
      descriptionKey: `account_email_preference_${category}_description`,
    })
  }
  return results
}

/**
 * Update an opt-out email preference for a user and audit log the change.
 */
export async function updateEmailPreference(
  userId: string,
  category: Exclude<EmailCategory, 'transactional' | 'account_security'>,
  enabled: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: userEmailPreference.id })
      .from(userEmailPreference)
      .where(
        and(eq(userEmailPreference.userId, userId), eq(userEmailPreference.category, category)),
      )
      .limit(1)

    if (existing[0]) {
      await tx
        .update(userEmailPreference)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(userEmailPreference.id, existing[0].id))
    } else {
      await tx.insert(userEmailPreference).values({ userId, category, enabled })
    }

    const userRow = await tx
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    const actorName = userRow[0]?.name ?? 'Unknown'

    await tx.insert(auditLog).values({
      actorId: userId,
      actorName,
      action: 'email_preference_updated',
      resourceType: 'user_email_preference',
      metadata: { category, enabled },
    })
  })
}

/**
 * Disable opt-out email preferences using an unsubscribe token.
 * If a category is provided, only that category is disabled. Otherwise all
 * opt-out categories are disabled (global unsubscribe).
 */
export async function unsubscribeByToken(
  token: string,
  category?: Exclude<EmailCategory, 'transactional' | 'account_security'>,
): Promise<{ success: boolean; category?: string }> {
  const normalizedToken = token.trim()
  if (!normalizedToken) {
    return { success: false }
  }

  const userRow = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.unsubscribeToken, normalizedToken))
    .limit(1)

  if (!userRow[0]) {
    return { success: false }
  }

  const categoriesToDisable = category ? [category] : OPT_OUT_CATEGORY_ARRAY
  await db.transaction(async (tx) => {
    for (const cat of categoriesToDisable) {
      const existing = await tx
        .select({ id: userEmailPreference.id })
        .from(userEmailPreference)
        .where(
          and(eq(userEmailPreference.userId, userRow[0].id), eq(userEmailPreference.category, cat)),
        )
        .limit(1)

      if (existing[0]) {
        await tx
          .update(userEmailPreference)
          .set({ enabled: false, updatedAt: new Date() })
          .where(eq(userEmailPreference.id, existing[0].id))
      } else {
        await tx.insert(userEmailPreference).values({
          userId: userRow[0].id,
          category: cat,
          enabled: false,
        })
      }
    }
  })

  return { success: true, category }
}

/**
 * Return the unsubscribe token for a user, creating one lazily if missing.
 */
export async function getOrCreateUnsubscribeToken(userId: string): Promise<string> {
  const existing = await db
    .select({ unsubscribeToken: user.unsubscribeToken })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (existing[0]?.unsubscribeToken) {
    return existing[0].unsubscribeToken
  }

  const newToken = randomBytes(32).toString('hex')

  await db.update(user).set({ unsubscribeToken: newToken }).where(eq(user.id, userId))

  return newToken
}
