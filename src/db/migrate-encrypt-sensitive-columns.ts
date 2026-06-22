/**
 * One-time backfill: encrypt sensitive columns that were previously stored as
 * plaintext. This script is idempotent: values that are already ciphertext are
 * left unchanged (see `decryptIfEncrypted`).
 *
 * Run after setting DATABASE_ENCRYPTION_KEY in the target environment:
 *
 *   docker compose run --rm app bun run src/db/migrate-encrypt-sensitive-columns.ts
 *
 * In production, run this from a secure host with the real key exported.
 */

import { eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { account, shop, twoFactor } from '#/db/schema'
import { encrypt } from '#/lib/encryption.server'

async function encryptColumn<T extends Record<string, unknown>>(
  tableName: string,
  rows: T[],
  fields: (keyof T)[],
  updateFn: (row: T, encrypted: Partial<T>) => Promise<void>,
): Promise<number> {
  let updated = 0
  for (const row of rows) {
    const encrypted: Partial<T> = {}
    let hasChange = false
    for (const field of fields) {
      const value = row[field]
      if (typeof value === 'string' && value.length > 0) {
        // Heuristic: already-base64-and-long values are treated as encrypted.
        const looksEncrypted =
          /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, 'base64').length >= 32
        if (!looksEncrypted) {
          ;(encrypted as Record<string, unknown>)[field as string] = encrypt(value)
          hasChange = true
        }
      }
    }
    if (hasChange) {
      await updateFn(row, encrypted)
      updated++
    }
  }
  console.log(`  ${tableName}: encrypted ${updated}/${rows.length} rows`)
  return updated
}

async function migrateAccounts(): Promise<number> {
  console.log('Encrypting account tokens...')
  const rows = await db.select().from(account)
  const toProcess = rows.filter((row) =>
    [row.accessToken, row.refreshToken, row.idToken, row.password].some(
      (v) => typeof v === 'string' && v.length > 0,
    ),
  )
  return encryptColumn(
    'account',
    toProcess,
    ['accessToken', 'refreshToken', 'idToken', 'password'],
    async (row, encrypted) => {
      await db.update(account).set(encrypted).where(eq(account.id, row.id))
    },
  )
}

async function migrateTwoFactor(): Promise<number> {
  console.log('Encrypting two-factor secrets...')
  const rows = await db.select().from(twoFactor)
  return encryptColumn('two_factor', rows, ['secret', 'backupCodes'], async (row, encrypted) => {
    await db.update(twoFactor).set(encrypted).where(eq(twoFactor.id, row.id))
  })
}

async function migrateShopMollieTokens(): Promise<number> {
  console.log('Encrypting shop Mollie Connect tokens...')
  const rows = await db.select().from(shop)
  return encryptColumn(
    'shop',
    rows,
    ['mollieAccessToken', 'mollieRefreshToken'],
    async (row, encrypted) => {
      await db.update(shop).set(encrypted).where(eq(shop.id, row.id))
    },
  )
}

async function main(): Promise<void> {
  console.log('Starting sensitive-column encryption backfill...')
  const accountCount = await migrateAccounts()
  const twoFactorCount = await migrateTwoFactor()
  const shopCount = await migrateShopMollieTokens()
  console.log('Backfill complete.')
  console.log(`  account rows updated: ${accountCount}`)
  console.log(`  two_factor rows updated: ${twoFactorCount}`)
  console.log(`  shop rows updated: ${shopCount}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })
