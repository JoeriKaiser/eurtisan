import { sql } from 'drizzle-orm'
import { db } from '#/db/index'

/**
 * Delete all rows from every application table in foreign-key-child-first order.
 *
 * Uses individual DELETE statements instead of TRUNCATE to avoid the
 * AccessExclusiveLock deadlocks that occur when tests run concurrently with
 * other connections on the shared development database.
 *
 * A background chain that slips past its file's
 * `flushBackgroundWorkForTests()` can commit inside a later file's cleanup
 * window and re-dirty tables mid-loop (FK violation on a child DELETE).
 * Retrying the full pass absorbs those late commits: the straggler finishes
 * within milliseconds, and the next pass sees an empty schema. Persistent
 * violations after three passes still fail loudly — that is a real leak.
 */
function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === '23503'
  )
}

// Promise.withResolvers needs the ES2024 lib; tsconfig targets lower.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
export async function clearTestTables(): Promise<void> {
  const tables = [
    'owner_message',
    'owner_message_thread',
    'customer_tag',
    'customer_note',
    'dispute_message',
    'dispute',
    'return_request_message',
    'return_request_item',
    'return_request',
    'seller_reply_report',
    'seller_reply',
    'review_helpful_vote',
    'review_report',
    'review',
    'notification',
    'payout_reconciliation_log',
    'payout',
    'invoices',
    'shipping_label',
    'guest_order_access',
    'payment_attempt',
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
    // References product, so it must be cleared before it.
    'search_event',
    'product',
    'shop_socials',
    'shop',
    'category',
    'product_report',
    'shop_report',
    'account',
    'two_factor',
    'session',
    'verification',
    'rate_limit',
    'email_suppression',
    'email_send_log',
    'email_outbox',
    'brevo_webhook_event',
    'user_email_preference',
    'user_notification_preference',
    'audit_log',
    'meilisearch_sync_queue',
    'sendcloud_webhook_event',
    'user',
  ] as const

  // Bounded retry: see docblock. Measured stragglers commit within a few
  // seconds of their file ending; exponential backoff covers ~4s total.
  const delays = [250, 500, 500, 1000, 1000]
  for (let attempt = 0; ; attempt += 1) {
    try {
      for (const table of tables) {
        await db.execute(sql.raw(`DELETE FROM "${table}"`))
      }
      return
    } catch (error) {
      if (attempt >= delays.length || !isForeignKeyViolation(error)) throw error
      await delay(delays[attempt])
    }
  }
}
