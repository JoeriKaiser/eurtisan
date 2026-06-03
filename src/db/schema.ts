import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['customer', 'creator', 'admin'])

export const shopStatusEnum = pgEnum('shop_status', [
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'active',
  'rejected',
  'suspended',
])

export const user = pgTable(
  'user',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: userRoleEnum().notNull().default('customer'),
    bannedAt: timestamp('banned_at'),
    banReason: text('ban_reason'),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until'),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('user_name_email_idx').on(table.name, table.email),
    index('user_created_at_idx').on(table.createdAt),
    index('user_role_idx').on(table.role),
  ],
)

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text(),
    tokenHash: text('token_hash'),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('session_userId_idx').on(table.userId),
    index('session_expires_at_idx').on(table.expiresAt),
    uniqueIndex('session_token_hash_unique').on(table.tokenHash),
  ],
)

export const twoFactor = pgTable(
  'two_factor',
  {
    id: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    secret: text().notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean().notNull().default(true),
  },
  (table) => [index('two_factor_user_id_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('verification_identifier_idx').on(table.identifier),
    index('verification_expires_at_idx').on(table.expiresAt),
  ],
)

export const shop = pgTable(
  'shop',
  {
    id: text().primaryKey(),

    // Core Identity
    name: text().notNull(),
    slug: text().notNull(),
    tagline: text(),
    description: text(),
    category: text(),
    tags: text('tags').array(),

    // Visuals
    image: text(),
    bannerImage: text('banner_image'),

    // Identity & Credibility
    productionType: text('production_type'),
    hasProductionPartner: boolean('has_production_partner').default(false),
    productionPartnerDetails: text('production_partner_details'),
    languages: text('languages').array(),

    // Location & Shipping
    shippingOrigin: jsonb('shipping_origin'),
    businessAddress: jsonb('business_address'),
    currency: text().notNull().default('EUR'),
    isVatRegistered: boolean('is_vat_registered').notNull().default(false),
    vatId: text('vat_id'),

    // Policies
    policies: jsonb('policies'),

    // Announcements
    announcement: text(),

    // Onboarding State
    status: shopStatusEnum('status').notNull().default('draft'),
    onboardingStep: integer('onboarding_step').notNull().default(1),
    onboardingCompletedAt: timestamp('onboarding_completed_at'),

    // Moderation
    isSuspended: boolean('is_suspended').notNull().default(false),
    moderationNote: text('moderation_note'),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: text('reviewed_by').references(() => user.id),
    resubmissionCount: integer('resubmission_count').notNull().default(0),

    // Payment
    mollieAccountId: text('mollie_account_id'),
    paymentConnected: boolean('payment_connected').notNull().default(false),
    paymentConnectedAt: timestamp('payment_connected_at'),

    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('shop_ownerId_idx').on(table.ownerId),
    index('shop_status_idx').on(table.status),
    index('shop_created_at_idx').on(table.createdAt),
    uniqueIndex('shop_slug_unique').on(table.slug),
  ],
)

export const shopSocials = pgTable(
  'shop_socials',
  {
    id: text().primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    platform: text().notNull(),
    url: text().notNull(),
  },
  (table) => [
    index('shop_socials_shop_id_idx').on(table.shopId),
    uniqueIndex('shop_socials_shop_platform_unique').on(table.shopId, table.platform),
  ],
)

export const categories = pgTable(
  'category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    description: text(),
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('category_slug_idx').on(table.slug),
    index('category_parent_id_idx').on(table.parentId),
    index('category_sort_order_idx').on(table.sortOrder),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete('cascade'),
  ],
)

export const product = pgTable(
  'product',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text(),
    slug: text().notNull(),
    priceCents: integer('price_cents').notNull().default(0),
    stockCount: integer('stock_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    vatRateCategory: text('vat_rate_category').notNull().default('standard'),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('product_shop_id_idx').on(table.shopId),
    index('product_category_id_idx').on(table.categoryId),
    index('product_slug_idx').on(table.slug),
    index('product_name_idx').on(table.name),
    index('product_shop_active_idx').on(table.shopId, table.isActive),
    index('product_category_is_active_created_at_idx').on(
      table.categoryId,
      table.isActive,
      table.createdAt,
    ),
    index('product_created_at_idx').on(table.createdAt),
    uniqueIndex('product_shop_slug_unique').on(table.shopId, table.slug),
    check('stock_count_non_negative', sql`${table.stockCount} >= 0`),
    check('price_cents_non_negative', sql`${table.priceCents} >= 0`),
  ],
)

export const productImage = pgTable(
  'product_image',
  {
    id: text().primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    altText: text('alt_text'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('product_image_product_id_sort_order_idx').on(table.productId, table.sortOrder),
  ],
)

export const productVariant = pgTable(
  'product_variant',
  {
    id: text().primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    stockCount: integer('stock_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('product_variant_product_id_idx').on(table.productId)],
)

export const cart = pgTable(
  'cart',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('cart_user_id_idx').on(table.userId),
    index('cart_session_id_idx').on(table.sessionId),
    index('cart_expires_at_idx').on(table.expiresAt),
    check('cart_owner_check', sql`${table.userId} IS NOT NULL OR ${table.sessionId} IS NOT NULL`),
  ],
)

export const cartItem = pgTable(
  'cart_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => cart.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('cart_item_cart_id_idx').on(table.cartId),
    uniqueIndex('cart_item_cart_id_product_id_unique').on(table.cartId, table.productId),
  ],
)

export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
  'manual_review',
  'chargeback',
])

export const shippingMethodEnum = pgEnum('shipping_method', ['standard', 'express', 'manual'])

export const platformOrder = pgTable(
  'platform_order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    shippingAddress: jsonb('shipping_address').notNull(),
    billingAddress: jsonb('billing_address').notNull(),
    totalCents: integer('total_cents').notNull().default(0),
    refundedCents: integer('refunded_cents').notNull().default(0),
    status: orderStatusEnum().notNull().default('pending_payment'),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    molliePaymentId: text('mollie_payment_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('platform_order_user_id_idx').on(table.userId),
    index('platform_order_status_idx').on(table.status),
    index('platform_order_created_at_idx').on(table.createdAt),
    index('platform_order_mollie_payment_id_idx').on(table.molliePaymentId),
    // Mollie guarantees payment ID uniqueness per environment. Cross-environment
    // data migrations (e.g. staging → production) may collide; remove or adjust
    // this constraint if such migrations are performed.
    uniqueIndex('platform_order_mollie_payment_id_unique').on(table.molliePaymentId),
  ],
)

export const shopOrder = pgTable(
  'shop_order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformOrderId: uuid('platform_order_id')
      .notNull()
      .references(() => platformOrder.id, { onDelete: 'cascade' }),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    shippingMethod: shippingMethodEnum('shipping_method').notNull().default('standard'),
    shippingCostCents: integer('shipping_cost_cents').notNull().default(0),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    vatAmountCents: integer('vat_amount_cents').notNull().default(0),
    shippingVatRateBasisPoints: integer('shipping_vat_rate_basis_points').notNull().default(0),
    shippingVatAmountCents: integer('shipping_vat_amount_cents').notNull().default(0),
    refundedCents: integer('refunded_cents').notNull().default(0),
    status: orderStatusEnum().notNull().default('pending_payment'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('shop_order_platform_order_id_idx').on(table.platformOrderId),
    index('shop_order_shop_id_idx').on(table.shopId),
    index('shop_order_status_idx').on(table.status),
    index('shop_order_created_at_idx').on(table.createdAt),
  ],
)

export const orderItem = pgTable(
  'order_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      // Intentionally restricted: products with existing orders cannot be hard-deleted,
      // ensuring order history and audit trails remain intact.
      .references(() => product.id, { onDelete: 'restrict' }),
    variantId: text('variant_id').references(() => productVariant.id, { onDelete: 'restrict' }),
    productName: text('product_name').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    quantity: integer().notNull(),
    totalCents: integer('total_cents').notNull().default(0),
    vatRateBasisPoints: integer('vat_rate_basis_points').notNull().default(0),
    vatAmountCents: integer('vat_amount_cents').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('order_item_shop_order_id_idx').on(table.shopOrderId),
    index('order_item_product_id_idx').on(table.productId),
  ],
)

export const inventoryReservation = pgTable(
  'inventory_reservation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
    platformOrderId: uuid('platform_order_id').references(() => platformOrder.id, {
      onDelete: 'cascade',
    }),
    cartId: uuid('cart_id').references(() => cart.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('inventory_reservation_product_id_idx').on(table.productId),
    index('inventory_reservation_expires_at_idx').on(table.expiresAt),
    uniqueIndex('inventory_reservation_product_order_unique').on(
      table.productId,
      table.platformOrderId,
    ),
    uniqueIndex('inventory_reservation_product_cart_unique').on(table.productId, table.cartId),
  ],
)

export const moderationStatusEnum = pgEnum('moderation_status', ['approved', 'flagged', 'hidden'])

export const review = pgTable(
  'review',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    buyerUserId: text('buyer_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: integer().notNull(),
    comment: text(),
    moderationStatus: moderationStatusEnum('moderation_status').notNull().default('approved'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('review_product_id_idx').on(table.productId),
    index('review_shop_order_id_idx').on(table.shopOrderId),
    index('review_buyer_user_id_idx').on(table.buyerUserId),
    index('review_moderation_status_idx').on(table.moderationStatus),
    uniqueIndex('review_shop_order_product_unique').on(table.shopOrderId, table.productId),
    check('rating_range', sql`${table.rating} BETWEEN 1 AND 5`),
  ],
)

export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'sent'])

export const payout = pgTable(
  'payout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id').references(() => shopOrder.id, { onDelete: 'cascade' }),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull().default(0),
    status: payoutStatusEnum().notNull().default('pending'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payout_shop_order_id_unique').on(table.shopOrderId),
    index('payout_shop_id_idx').on(table.shopId),
    index('payout_status_idx').on(table.status),
    index('payout_created_at_idx').on(table.createdAt),
  ],
)

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('notification_user_id_read_at_idx').on(table.userId, table.readAt),
    index('notification_user_id_created_at_idx').on(table.userId, table.createdAt),
  ],
)

export const dispute = pgTable(
  'dispute',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    buyerUserId: text('buyer_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reason: text().notNull(),
    description: text().notNull(),
    status: text().notNull().default('open'),
    resolution: text(),
    refundCents: integer('refund_cents'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('dispute_status_idx').on(table.status),
    index('dispute_buyer_user_id_idx').on(table.buyerUserId),
    index('dispute_created_at_idx').on(table.createdAt),
    uniqueIndex('dispute_shop_order_id_unique').on(table.shopOrderId),
    check('dispute_status_check', sql`${table.status} IN ('open', 'resolved', 'closed')`),
  ],
)

export const disputeMessage = pgTable(
  'dispute_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    disputeId: uuid('dispute_id')
      .notNull()
      .references(() => dispute.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    message: text().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('dispute_message_dispute_id_idx').on(table.disputeId)],
)

export const shippingLabel = pgTable(
  'shipping_label',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    carrier: text('carrier').notNull(),
    trackingNumber: text('tracking_number'),
    labelUrl: text('label_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('shipping_label_shop_order_id_idx').on(table.shopOrderId)],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    actorName: text('actor_name').notNull(),
    action: text().notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_created_at_idx').on(table.createdAt),
    index('audit_log_actor_id_idx').on(table.actorId),
    index('audit_log_action_idx').on(table.action),
    index('audit_log_resource_idx').on(table.resourceType, table.resourceId),
  ],
)

export const rateLimit = pgTable(
  'rate_limit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    windowStart: timestamp('window_start').notNull(),
    count: integer('count').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('rate_limit_key_idx').on(table.key),
    index('idx_rate_limit_updated_at').on(table.updatedAt),
    index('rate_limit_window_start_idx').on(table.windowStart),
  ],
)

export const emailSuppression = pgTable('email_suppression', {
  email: text().primaryKey(),
  reason: text().notNull(),
  source: text(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const invoiceTypeEnum = pgEnum('invoice_type', ['platform_fee', 'customer'])

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').notNull().unique(),
    type: invoiceTypeEnum('type').notNull(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    vatRateBasisPoints: integer('vat_rate_basis_points').notNull().default(0),
    vatAmountCents: integer('vat_amount_cents').notNull().default(0),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    billingDetails: jsonb('billing_details').notNull(),
  },
  (table) => [
    index('invoices_shop_order_id_idx').on(table.shopOrderId),
    index('invoices_type_idx').on(table.type),
  ],
)

export const meilisearchSyncQueue = pgTable(
  'meilisearch_sync_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: text('product_id').notNull(),
    action: text('action').notNull(), // 'index' | 'delete'
    status: text('status').notNull().default('pending'), // 'pending' | 'failed' | 'completed'
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    runAt: timestamp('run_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('meilisearch_sync_queue_status_run_at_idx').on(table.status, table.runAt),
    check(
      'meilisearch_sync_queue_status_check',
      sql`${table.status} IN ('pending', 'completed', 'failed')`,
    ),
  ],
)
