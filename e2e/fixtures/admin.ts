import { randomUUID } from 'node:crypto'
import { hashPassword } from '@better-auth/utils/password'
import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { E2E_ADMIN } from './auth'

export interface AdminCookie {
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  sameSite: 'Strict' | 'Lax' | 'None' | undefined
  expires: number
}

/**
 * Authenticate as admin by calling the Better Auth email endpoint directly.
 * Returns cookie shape suitable for Playwright's addCookies().
 */
export async function authenticateAdmin(baseURL = 'http://localhost:3000'): Promise<AdminCookie[]> {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: E2E_ADMIN.email, password: E2E_ADMIN.password }),
  })
  expect(response.ok).toBeTruthy()

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header returned from admin sign-in')

  const sessionCookie = setCookie.split(';')[0]
  const eqIdx = sessionCookie.indexOf('=')

  const cookieName = sessionCookie.slice(0, eqIdx)

  const cookieValue = sessionCookie.slice(eqIdx + 1)

  return [
    {
      name: cookieName,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax' as const,
      expires: Math.floor(Date.now() / 1000) + 3600 * 24,
    },
  ]
}

/**
 * Create an authenticated admin browser context.
 */
export async function createAdminContext(
  browser: { newContext: (opts?: object) => Promise<BrowserContext> },
  baseURL?: string,
) {
  const cookies = await authenticateAdmin(baseURL)
  const context = await browser.newContext()
  await context.addCookies(cookies)
  return context
}

export interface TestUser {
  id: string
  email: string
  password: string
  name: string
  role: 'customer' | 'creator' | 'admin'
}

/**
 * Create a verified test user with credential auth and the requested role.
 * Reuses an existing row with the same email when present.
 */
export async function createTestUser(
  seed: string,
  role: 'customer' | 'creator' | 'admin',
): Promise<TestUser> {
  const email = `e2e-admin-${seed}@eurtisan.local`
  const password = 'test-password-123'
  const name = `E2E ${role.charAt(0).toUpperCase() + role.slice(1)} ${seed}`

  const existing = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1)
  if (existing[0]) {
    return { id: existing[0].id, email, password, name: existing[0].name ?? name, role }
  }

  const id = randomUUID()
  await db.insert(schema.user).values({
    id,
    name,
    email,
    emailVerified: true,
    role,
    twoFactorEnabled: true,
  })

  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: await hashPassword(password),
  })

  return { id, email, password, name, role }
}

/**
 * Hard-delete a user by email, removing dependent account rows.
 */
export async function deleteUserByEmail(email: string): Promise<void> {
  const [userRow] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)
  if (!userRow) return

  await db.delete(schema.account).where(eq(schema.account.userId, userRow.id))
  await db.delete(schema.user).where(eq(schema.user.id, userRow.id))
}

/**
 * Mark a user as banned with an optional reason.
 */
export async function banUserByEmail(email: string, reason = 'E2E test ban'): Promise<void> {
  await db
    .update(schema.user)
    .set({ bannedAt: new Date(), banReason: reason })
    .where(eq(schema.user.email, email))
}

/**
 * Clear a user's banned status.
 */
export async function unbanUserByEmail(email: string): Promise<void> {
  await db
    .update(schema.user)
    .set({ bannedAt: null, banReason: null })
    .where(eq(schema.user.email, email))
}

export interface TestCategory {
  id: string
  name: string
  slug: string
  description: string
  parentId: string | null
}

/**
 * Create a test category. Uses a unique slug derived from the seed.
 */
export async function createTestCategory(seed: string, parentId?: string): Promise<TestCategory> {
  const name = `E2E Category ${seed}`
  const slug = `e2e-category-${seed}`
  const description = `Test category created by E2E admin suite (${seed})`

  const existing = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, slug))
    .limit(1)
  if (existing[0]) {
    return {
      id: existing[0].id,
      name: existing[0].name ?? name,
      slug: existing[0].slug,
      description: existing[0].description ?? description,
      parentId: existing[0].parentId ?? null,
    }
  }

  const id = randomUUID()
  await db.insert(schema.categories).values({
    id,
    name,
    slug,
    description,
    parentId: parentId ?? null,
  })

  return { id, name, slug, description, parentId: parentId ?? null }
}

/**
 * Hard-delete a test category by id. Cascades to child categories via FK.
 */
export async function deleteTestCategory(id: string): Promise<void> {
  await db.delete(schema.categories).where(eq(schema.categories.id, id))
}

/**
 * Mark a user as deleted without removing the row, matching production account deletion.
 */
export async function markUserDeleted(email: string): Promise<void> {
  await db.update(schema.user).set({ deletedAt: new Date() }).where(eq(schema.user.email, email))
}
