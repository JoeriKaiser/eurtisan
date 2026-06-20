import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { user, userEmailPreference } from '#/db/schema'
import { and, eq } from 'drizzle-orm'
import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'

import {
  getEmailPreferences,
  getOrCreateUnsubscribeToken,
  isEmailEnabledForUser,
  unsubscribeByToken,
  updateEmailPreference,
} from './email-preferences.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('isEmailEnabledForUser', () => {
  it('always returns true for transactional emails', async () => {
    const u = await createUser()
    expect(await isEmailEnabledForUser(u.id, 'transactional')).toBe(true)
  })

  it('always returns true for account_security emails', async () => {
    const u = await createUser()
    expect(await isEmailEnabledForUser(u.id, 'account_security')).toBe(true)
  })

  it('returns the default for seller_updates when no row exists', async () => {
    const u = await createUser()
    expect(await isEmailEnabledForUser(u.id, 'seller_updates')).toBe(true)
    const rows = await db
      .select()
      .from(userEmailPreference)
      .where(eq(userEmailPreference.userId, u.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.category).toBe('seller_updates')
    expect(rows[0]?.enabled).toBe(true)
  })

  it('returns the default for platform_announcements when no row exists', async () => {
    const u = await createUser()
    expect(await isEmailEnabledForUser(u.id, 'platform_announcements')).toBe(true)
  })

  it('returns false for marketing by default', async () => {
    const u = await createUser()
    expect(await isEmailEnabledForUser(u.id, 'marketing')).toBe(false)
  })

  it('returns the stored value when a row exists', async () => {
    const u = await createUser()
    await updateEmailPreference(u.id, 'seller_updates', false)
    expect(await isEmailEnabledForUser(u.id, 'seller_updates')).toBe(false)
  })
})

describe('getEmailPreferences', () => {
  it('returns all opt-out categories with default values', async () => {
    const u = await createUser()
    const preferences = await getEmailPreferences(u.id)

    expect(preferences.map((p) => p.category)).toEqual([
      'seller_updates',
      'marketing',
      'platform_announcements',
    ])
    expect(preferences.find((p) => p.category === 'seller_updates')?.enabled).toBe(true)
    expect(preferences.find((p) => p.category === 'marketing')?.enabled).toBe(false)
    expect(preferences.find((p) => p.category === 'platform_announcements')?.enabled).toBe(true)
  })

  it('includes localized label and description keys', async () => {
    const u = await createUser()
    const preferences = await getEmailPreferences(u.id)
    const marketing = preferences.find((p) => p.category === 'marketing')
    expect(marketing?.labelKey).toBe('account_email_preference_marketing')
    expect(marketing?.descriptionKey).toBe('account_email_preference_marketing_description')
  })
})

describe('updateEmailPreference', () => {
  it('upserts the preference and audit logs the change', async () => {
    const u = await createUser()
    await updateEmailPreference(u.id, 'seller_updates', false)

    const rows = await db
      .select()
      .from(userEmailPreference)
      .where(
        and(
          eq(userEmailPreference.userId, u.id),
          eq(userEmailPreference.category, 'seller_updates'),
        ),
      )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.enabled).toBe(false)
  })
})

describe('unsubscribeByToken', () => {
  it('returns success false for an unknown token without leaking validity', async () => {
    const result = await unsubscribeByToken('unknown-token')
    expect(result.success).toBe(false)
  })

  it('returns success false for an empty token', async () => {
    const result = await unsubscribeByToken('')
    expect(result.success).toBe(false)
  })

  it('disables a single category when category is provided', async () => {
    const u = await createUser()
    const token = await getOrCreateUnsubscribeToken(u.id)

    const result = await unsubscribeByToken(token, 'seller_updates')
    expect(result.success).toBe(true)
    expect(result.category).toBe('seller_updates')

    expect(await isEmailEnabledForUser(u.id, 'seller_updates')).toBe(false)
    expect(await isEmailEnabledForUser(u.id, 'platform_announcements')).toBe(true)
  })

  it('disables all opt-out categories when category is omitted', async () => {
    const u = await createUser()
    const token = await getOrCreateUnsubscribeToken(u.id)

    const result = await unsubscribeByToken(token)
    expect(result.success).toBe(true)

    expect(await isEmailEnabledForUser(u.id, 'seller_updates')).toBe(false)
    expect(await isEmailEnabledForUser(u.id, 'marketing')).toBe(false)
    expect(await isEmailEnabledForUser(u.id, 'platform_announcements')).toBe(false)
  })
})

describe('getOrCreateUnsubscribeToken', () => {
  it('creates a token lazily when missing', async () => {
    const u = await createUser()

    await db.update(user).set({ unsubscribeToken: null }).where(eq(user.id, u.id))

    const token = await getOrCreateUnsubscribeToken(u.id)
    expect(token).toBeTruthy()
    expect(token.length).toBeGreaterThanOrEqual(32)

    const updated = await db
      .select({ unsubscribeToken: user.unsubscribeToken })
      .from(user)
      .where(eq(user.id, u.id))
    expect(updated[0]?.unsubscribeToken).toBe(token)
  })

  it('returns an existing token without changing it', async () => {
    const u = await createUser()
    const token1 = await getOrCreateUnsubscribeToken(u.id)
    const token2 = await getOrCreateUnsubscribeToken(u.id)
    expect(token1).toBe(token2)
  })
})
