/**
 * One-time backfill: encrypt PII stored in JSONB columns.
 *
 * Affected columns:
 *   - platform_order.shipping_address
 *   - platform_order.billing_address
 *   - invoices.billing_details
 *   - shop.business_address
 *   - shop.shipping_origin
 *
 * Run after setting DATABASE_ENCRYPTION_KEY in the target environment:
 *
 *   docker compose run --rm app bun run src/db/migrate-encrypt-jsonb-columns.ts
 *
 * In production, run this from a secure host with the real key exported.
 */

import { eq } from 'drizzle-orm'

import { db } from '#/db/index'
import { invoices, platformOrder, shop } from '#/db/schema'
import { encryptJsonb, decryptJsonb } from '#/lib/encryption.server'

async function encryptJsonbColumn<T extends Record<string, unknown>>(
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
      if (value === null || value === undefined) continue
      // If the value is already a ciphertext string, decryptJsonb will return
      // the parsed object; re-encrypting would change it unnecessarily.
      const decrypted = decryptJsonb<unknown>(value)
      if (decrypted === value) {
        // value was not ciphertext: encrypt it
        ;(encrypted as Record<string, unknown>)[field as string] = encryptJsonb(decrypted)
        hasChange = true
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

async function migratePlatformOrderAddresses(): Promise<number> {
  console.log('Encrypting platform_order addresses...')
  const rows = await db.select().from(platformOrder)
  return encryptJsonbColumn(
    'platform_order',
    rows,
    ['shippingAddress', 'billingAddress'],
    async (row, encrypted) => {
      await db.update(platformOrder).set(encrypted).where(eq(platformOrder.id, row.id))
    },
  )
}

async function migrateInvoiceBillingDetails(): Promise<number> {
  console.log('Encrypting invoices billing_details...')
  const rows = await db.select().from(invoices)
  return encryptJsonbColumn('invoices', rows, ['billingDetails'], async (row, encrypted) => {
    await db.update(invoices).set(encrypted).where(eq(invoices.id, row.id))
  })
}

async function migrateShopAddresses(): Promise<number> {
  console.log('Encrypting shop addresses...')
  const rows = await db.select().from(shop)
  return encryptJsonbColumn(
    'shop',
    rows,
    ['shippingOrigin', 'businessAddress'],
    async (row, encrypted) => {
      await db.update(shop).set(encrypted).where(eq(shop.id, row.id))
    },
  )
}

async function main(): Promise<void> {
  console.log('Starting JSONB-column encryption backfill...')
  const platformOrderCount = await migratePlatformOrderAddresses()
  const invoiceCount = await migrateInvoiceBillingDetails()
  const shopCount = await migrateShopAddresses()
  console.log('Backfill complete.')
  console.log(`  platform_order rows updated: ${platformOrderCount}`)
  console.log(`  invoices rows updated: ${invoiceCount}`)
  console.log(`  shop rows updated: ${shopCount}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })
