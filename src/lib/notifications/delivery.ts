import type { EmailTemplate } from '#/lib/email-provider'
import type { EmailCategory } from '#/lib/email-preferences.server'
// Type-only, so this table stays free of any runtime dependency on the server
// module that owns the enum.
import type { NotificationType } from './operations.server'

/**
 * How each notification type reaches its recipient.
 *
 * Email coverage used to be whatever each call site happened to add. Five of
 * thirteen types emailed, and the split tracked neither urgency nor the
 * recipient's chance of noticing: a **chargeback** and a **DAC7 threshold
 * warning** — money taken back, and a reporting obligation created — were in-app
 * only, while a shipping confirmation the buyer already expects emailed.
 *
 * The table is exhaustive by type, so adding a notification type is a compile
 * error until someone decides how it is delivered. `delivery.test.ts` additionally
 * checks that nothing claims a template the email provider does not have.
 *
 * Three modes:
 *
 * - `'in_app'` — the notification list only. For routine, high-frequency events
 *   where an email per occurrence would train the recipient to filter them.
 * - `'auto_email'` — `createNotification` enqueues the email itself, because
 *   everything the template needs is already on the notification payload.
 * - `'caller_email'` — the call site sends, because the template needs data the
 *   notification does not carry (order lines, tracking numbers, refund totals).
 *   Named so the split is visible here rather than discovered by grepping.
 */
export type NotificationDelivery =
  | { mode: 'in_app' }
  | { mode: 'auto_email'; template: EmailTemplate; category: EmailCategory }
  | { mode: 'caller_email'; template: EmailTemplate; sentBy: string }

export const NOTIFICATION_DELIVERY: Record<NotificationType, NotificationDelivery> = {
  /* Sent by the flow that has the order detail the template needs. */
  order_placed: {
    mode: 'caller_email',
    template: 'order_confirmation',
    sentBy: 'lib/checkout/notifications.server.ts',
  },
  order_shipped: {
    mode: 'caller_email',
    template: 'shipping_notification',
    sentBy: 'lib/shop-orders/operations.server.ts',
  },
  order_refunded: {
    mode: 'caller_email',
    template: 'order_refunded',
    sentBy: 'lib/shop-orders/operations.server.ts',
  },
  dispute_opened: {
    mode: 'caller_email',
    template: 'dispute_update',
    sentBy: 'lib/disputes/operations.server.ts',
  },
  dispute_resolved: {
    mode: 'caller_email',
    template: 'dispute_update',
    sentBy: 'lib/disputes/operations.server.ts',
  },
  shop_moderation_update: {
    mode: 'caller_email',
    template: 'shop_moderation_update',
    sentBy: 'lib/shops/onboarding.server.ts',
  },

  /* Added this phase: consequential, and previously invisible until next login. */

  /** Money is being taken back and the seller has a window to respond. */
  order_chargeback: {
    mode: 'auto_email',
    template: 'seller_alert',
    category: 'transactional',
  },
  /** Crossing the threshold creates a DAC7 reporting obligation. */
  dac7_warning_limit: {
    mode: 'auto_email',
    template: 'seller_alert',
    category: 'transactional',
  },
  /** A payment receipt; the seller reconciles against it. */
  payout_sent: {
    mode: 'auto_email',
    template: 'seller_alert',
    category: 'transactional',
  },
  /**
   * The DSA Article 17 statement of reasons. Delivered in-app as well, which is
   * what satisfies the obligation; the email means it does not depend on the
   * author happening to return to the site.
   */
  review_moderated: {
    mode: 'auto_email',
    template: 'statement_of_reasons',
    category: 'transactional',
  },

  /* Routine and frequent — an email each would be noise. */
  low_stock: { mode: 'in_app' },
  review_received: { mode: 'in_app' },
  review_report_resolved: { mode: 'in_app' },
}
