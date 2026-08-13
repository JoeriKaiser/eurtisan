/**
 * Creator lifecycle helpers for E2E tests.
 *
 * These functions mutate the isolated E2E database directly so specs can
 * start from a known creator state without relying on seed data.
 */

import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'

export interface TestCreator {
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
 * Create a verified creator with credential auth in the E2E database.
 * Useful when a spec must mutate creator account state (2FA, deletion, etc.).
 */
export async function createVerifiedCreator(seed: string): Promise<TestCreator> {
  const email = `e2e-creator-${seed}@eurtisan.local`
  const password = 'test-password-123'
  const name = `E2E Creator ${seed}`

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
    role: 'creator',
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
 * Hard-delete a creator by email. Cleans up the user row, account, and any
 * related rows that would block re-creation. Deleting the user row cascades
 * to its sessions, shops, orders, and other FK-dependent rows.
 */
export async function deleteCreatorByEmail(email: string): Promise<void> {
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
 * Mark a creator as deleted without removing the row, matching the
 * production account-deletion flow.
 */
export async function markCreatorDeleted(email: string): Promise<void> {
  await db.update(schema.user).set({ deletedAt: new Date() }).where(eq(schema.user.email, email))
}

/**
 * Toggle the `twoFactorEnabled` column on the user row for a creator.
 */
export async function setCreatorTwoFactor(email: string, enabled: boolean): Promise<void> {
  await db
    .update(schema.user)
    .set({ twoFactorEnabled: enabled })
    .where(eq(schema.user.email, email))
}

/**
 * Create an approved shop owned by the given creator. The slug is derived
 * from the seed so each fixture shop has a unique identifier.
 */
export async function createCreatorShop(
  owner: TestCreator,
  seed: string,
): Promise<{ id: string; slug: string; name: string }> {
  const id = randomUUID()
  const slug = `e2e-creator-shop-${seed}-${Date.now()}`
  const name = `E2E Creator Shop ${seed}`

  await db.insert(schema.shop).values({
    id,
    name,
    slug,
    status: 'approved',
    ownerId: owner.id,
  })

  return { id, slug, name }
}

/**
 * Hard-delete a creator shop by id, removing dependent rows that would block
 * re-creation. Most dependents cascade with the shop row, but explicit
 * deletions are issued for product and order-related data to avoid FK
 * violations caused by restrictive references such as order items.
 */
export async function deleteCreatorShop(shopId: string): Promise<void> {
  // Start with the shop-owned message threads so their messages cascade cleanly.
  await db.delete(schema.ownerMessageThread).where(eq(schema.ownerMessageThread.shopId, shopId))

  // Customer notes/tags are shop-dependent and cascade, but deleting them
  // explicitly before products/orders keeps the operation deterministic.
  await db.delete(schema.customerNote).where(eq(schema.customerNote.shopId, shopId))
  await db.delete(schema.customerTag).where(eq(schema.customerTag.shopId, shopId))

  // Shop orders cascade to order items, payouts, invoices, shipping labels,
  // disputes, and dispute messages. Deleting them first also removes any
  // restrictive references before products are touched.
  await db.delete(schema.shopOrder).where(eq(schema.shopOrder.shopId, shopId))

  // Products cascade to images, variants, options, and option values. Deleting
  // products after orders removes the restrictive order-item references.
  await db.delete(schema.product).where(eq(schema.product.shopId, shopId))

  // Remaining shop-owned rows that cascade directly with the shop.
  await db.delete(schema.shopSocials).where(eq(schema.shopSocials.shopId, shopId))

  await db.delete(schema.shop).where(eq(schema.shop.id, shopId))
}
