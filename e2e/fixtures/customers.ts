/**
 * Customer lifecycle helpers for E2E tests.
 *
 * These functions mutate the isolated E2E database directly so specs can
 * start from a known state without relying on seed data.
 */

import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test'

export interface TestCustomer {
  id: string
  email: string
  password: string
  name: string
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  })
  return `${salt}:${key.toString('hex')}`
}

/**
 * Create a verified customer with credential auth in the E2E database.
 * Useful when a spec must mutate account state (2FA, deletion, etc.).
 */
export async function createVerifiedCustomer(seed: string): Promise<TestCustomer> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  const email = `e2e-${seed}@eurtisan.local`
  const password = 'test-password-123'
  const name = `E2E Customer ${seed}`

  const existing = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1)
  if (existing[0]) {
    return { id: existing[0].id, email, password, name: existing[0].name ?? name }
  }

  const id = randomUUID()
  await db.insert(schema.user).values({
    id,
    name,
    email,
    emailVerified: true,
    role: 'customer',
  })

  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: hashPassword(password),
  })

  return { id, email, password, name }
}

/**
 * Hard-delete a customer by email. Cleans up user, account, and any
 * related rows that would block re-creation.
 */
export async function deleteCustomerByEmail(email: string): Promise<void> {
  process.env.DATABASE_URL = e2eDatabaseUrl

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
 * Mark a customer as deleted without removing the row, matching the
 * production account-deletion flow.
 */
export async function markCustomerDeleted(email: string): Promise<void> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  await db.update(schema.user).set({ deletedAt: new Date() }).where(eq(schema.user.email, email))
}
