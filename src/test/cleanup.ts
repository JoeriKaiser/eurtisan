import { sql } from 'drizzle-orm'
import { db } from '#/db/index'

/**
 * Delete all rows from every application table in foreign-key-child-first order.
 *
 * Uses individual DELETE statements instead of TRUNCATE to avoid the
 * AccessExclusiveLock deadlocks that occur when tests run concurrently with
 * other connections on the shared development database.
 */
export async function clearTestTables(): Promise<void> {
  const tables = [
    'owner_message',
    'owner_message_thread',
    'customer_tag',
    'customer_note',
    'dispute_message',
    'dispute',
    'review',
    'notification',
    'payout_reconciliation_log',
    'payout',
    'invoices',
    'shipping_label',
    'order_item',
    'inventory_reservation',
    'cart_item',
    'cart',
    'shop_order',
    'platform_order',
    'product_variant_option',
    'product_variant',
    'product_option_value',
    'product_option',
    'product_image',
    'product',
    'shop_socials',
    'shop',
    'category',
    'account',
    'two_factor',
    'session',
    'verification',
    'rate_limit',
    'email_suppression',
    'audit_log',
    'meilisearch_sync_queue',
    'sendcloud_webhook_event',
    'user',
  ] as const

  for (const table of tables) {
    await db.execute(sql.raw(`DELETE FROM "${table}"`))
  }
}
