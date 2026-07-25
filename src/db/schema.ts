import { isNotNull, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { generateOrderNumber } from '#/lib/order-numbers'

export const userRoleEnum = pgEnum('user_role', ['customer', 'creator', 'admin'])

export const productStatusEnum = pgEnum('product_status', ['draft', 'published', 'archived'])

export const shopStatusEnum = pgEnum('shop_status', [
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'active',
  'paused',
  'archived',
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
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
    unsubscribeToken: text('unsubscribe_token').unique(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('user_name_email_idx').on(table.name, table.email),
    index('user_created_at_idx').on(table.createdAt),
    index('user_role_idx').on(table.role),
    index('user_unsubscribe_token_idx').on(table.unsubscribeToken),
  ],
)

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text(),
    tokenHash: text('token_hash').notNull(),
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
  (table) => [
    index('account_userId_idx').on(table.userId),
    uniqueIndex('account_provider_account_unique').on(
      table.providerId,
      table.accountId,
      table.userId,
    ),
  ],
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

    // DAC7 Compliance
    legalEntityType: text('legal_entity_type'),
    dateOfBirth: text('date_of_birth'),
    taxId: text('tax_id'),
    businessRegistrationNumber: text('business_registration_number'),

    // Policies
    policies: jsonb('policies'),

    // Announcements
    announcement: text(),

    // Onboarding State
    status: shopStatusEnum('status').notNull().default('draft'),
    onboardingStep: integer('onboarding_step').notNull().default(1),
    onboardingCompletedAt: timestamp('onboarding_completed_at'),
    onboardingListingId: text('onboarding_listing_id'),
    sellerTermsAcceptedAt: timestamp('seller_terms_accepted_at'),
    sellerTermsVersion: text('seller_terms_version'),

    // Moderation
    isSuspended: boolean('is_suspended').notNull().default(false),
    moderationNote: text('moderation_note'),
    moderationStage: integer('moderation_stage'),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: text('reviewed_by').references(() => user.id),
    resubmissionCount: integer('resubmission_count').notNull().default(0),

    // Payment
    mollieAccountId: text('mollie_account_id'),
    mollieAccessToken: text('mollie_access_token'),
    mollieRefreshToken: text('mollie_refresh_token'),
    mollieTokenExpiresAt: timestamp('mollie_token_expires_at'),
    paymentConnected: boolean('payment_connected').notNull().default(false),
    paymentConnectedAt: timestamp('payment_connected_at'),

    // Lifecycle
    pausedAt: timestamp('paused_at'),
    archivedAt: timestamp('archived_at'),
    scheduledDeleteAt: timestamp('scheduled_delete_at'),

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
    check('shop_onboarding_step_bounds', sql`${table.onboardingStep} BETWEEN 1 AND 8`),
  ],
)

export const shopSocialPlatformEnum = pgEnum('shop_social_platform', [
  'instagram',
  'facebook',
  'twitter',
  'tiktok',
  'pinterest',
  'youtube',
  'website',
])

export const shopSocials = pgTable(
  'shop_socials',
  {
    id: text().primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    platform: shopSocialPlatformEnum('platform').notNull(),
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
    status: productStatusEnum().notNull().default('draft'),
    publishedAt: timestamp('published_at'),
    vatRateCategory: text('vat_rate_category').notNull().default('standard'),
    returnPolicy: text('return_policy').notNull().default('standard'),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    weightGrams: integer('weight_grams'),
    lengthCm: integer('length_cm'),
    widthCm: integer('width_cm'),
    heightCm: integer('height_cm'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('product_shop_id_idx').on(table.shopId),
    index('product_category_id_idx').on(table.categoryId),
    index('product_slug_idx').on(table.slug),
    index('product_name_idx').on(table.name),
    index('product_status_idx').on(table.status),
    index('product_published_at_idx').on(table.publishedAt),
    index('product_shop_status_idx').on(table.shopId, table.status),
    index('product_shop_active_idx').on(table.shopId, table.isActive),
    index('product_category_is_active_created_at_idx').on(
      table.categoryId,
      table.isActive,
      table.createdAt,
    ),
    index('product_created_at_idx').on(table.createdAt),
    uniqueIndex('product_shop_slug_published_unique')
      .on(table.shopId, table.slug)
      .where(sql`${table.status} = 'published'`),
    check('stock_count_non_negative', sql`${table.stockCount} >= 0`),
    check('price_cents_non_negative', sql`${table.priceCents} >= 0`),
    check(
      'product_return_policy_valid',
      sql`${table.returnPolicy} IN ('standard', 'personalized', 'perishable', 'hygiene_sealed')`,
    ),
    check(
      'product_weight_grams_positive',
      sql`${table.weightGrams} IS NULL OR ${table.weightGrams} > 0`,
    ),
    check('product_length_cm_positive', sql`${table.lengthCm} IS NULL OR ${table.lengthCm} > 0`),
    check('product_width_cm_positive', sql`${table.widthCm} IS NULL OR ${table.widthCm} > 0`),
    check('product_height_cm_positive', sql`${table.heightCm} IS NULL OR ${table.heightCm} > 0`),
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
    sku: text(),
    name: text().notNull(),
    priceAdjustmentCents: integer('price_adjustment_cents').notNull().default(0),
    stockCount: integer('stock_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('product_variant_product_id_idx').on(table.productId),
    uniqueIndex('product_variant_sku_unique').on(table.sku).where(isNotNull(table.sku)),
    uniqueIndex('product_variant_product_name_unique').on(table.productId, table.name),
    check('product_variant_stock_count_non_negative', sql`${table.stockCount} >= 0`),
  ],
)

export const productOption = pgTable(
  'product_option',
  {
    id: text().primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('product_option_product_id_idx').on(table.productId)],
)

export const productOptionValue = pgTable(
  'product_option_value',
  {
    id: text().primaryKey(),
    optionId: text('option_id')
      .notNull()
      .references(() => productOption.id, { onDelete: 'cascade' }),
    value: text().notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('product_option_value_option_id_idx').on(table.optionId),
    uniqueIndex('product_option_value_option_value_unique').on(table.optionId, table.value),
  ],
)

export const productVariantOption = pgTable(
  'product_variant_option',
  {
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariant.id, { onDelete: 'cascade' }),
    optionValueId: text('option_value_id')
      .notNull()
      .references(() => productOptionValue.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.variantId, table.optionValueId] }),
    index('product_variant_option_variant_id_idx').on(table.variantId),
    index('product_variant_option_option_value_id_idx').on(table.optionValueId),
  ],
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
    check('cart_item_quantity_positive', sql`${table.quantity} > 0`),
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
    orderNumber: text('order_number').notNull().$defaultFn(generateOrderNumber),
    shippingAddress: jsonb('shipping_address').notNull(),
    billingAddress: jsonb('billing_address').notNull(),
    totalCents: integer('total_cents').notNull().default(0),
    refundedCents: integer('refunded_cents').notNull().default(0),
    status: orderStatusEnum().notNull().default('pending_payment'),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    molliePaymentId: text('mollie_payment_id'),
    checkoutAttemptId: uuid('checkout_attempt_id'),
    buyerEmail: text('buyer_email'),
    buyerEmailHash: text('buyer_email_hash'),
    isGuest: boolean('is_guest').notNull().default(false),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('platform_order_user_id_idx').on(table.userId),
    index('platform_order_status_idx').on(table.status),
    index('platform_order_created_at_idx').on(table.createdAt),
    index('platform_order_user_id_status_created_at_idx').on(
      table.userId,
      table.status,
      table.createdAt,
    ),
    index('platform_order_status_created_at_idx').on(table.status, table.createdAt),
    index('platform_order_mollie_payment_id_idx').on(table.molliePaymentId),
    index('platform_order_buyer_email_hash_idx').on(table.buyerEmailHash),
    uniqueIndex('platform_order_order_number_unique').on(table.orderNumber),
    uniqueIndex('platform_order_checkout_attempt_id_unique').on(table.checkoutAttemptId),
    // Mollie guarantees payment ID uniqueness per environment. Cross-environment
    // data migrations (e.g. staging → production) may collide; remove or adjust
    // this constraint if such migrations are performed.
    uniqueIndex('platform_order_mollie_payment_id_unique').on(table.molliePaymentId),
    check(
      'platform_order_refunded_cents_not_over_total',
      sql`${table.refundedCents} <= ${table.totalCents}`,
    ),
  ],
)

export const paymentAttempt = pgTable(
  'payment_attempt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformOrderId: uuid('platform_order_id')
      .notNull()
      .references(() => platformOrder.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    status: text().notNull().default('initiating'),
    providerPaymentId: text('provider_payment_id'),
    checkoutUrl: text('checkout_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('payment_attempt_order_idx').on(table.platformOrderId, table.createdAt),
    uniqueIndex('payment_attempt_idempotency_key_unique').on(table.idempotencyKey),
    check(
      'payment_attempt_status_valid',
      sql`${table.status} IN ('initiating', 'completed', 'superseded')`,
    ),
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
    shippingRateId: text('shipping_rate_id'),
    shippingCostCents: integer('shipping_cost_cents').notNull().default(0),
    standardShippingCostCents: integer('standard_shipping_cost_cents').notNull().default(0),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    vatAmountCents: integer('vat_amount_cents').notNull().default(0),
    shippingVatRateBasisPoints: integer('shipping_vat_rate_basis_points').notNull().default(0),
    shippingVatAmountCents: integer('shipping_vat_amount_cents').notNull().default(0),
    refundedCents: integer('refunded_cents').notNull().default(0),
    refundPendingCents: integer('refund_pending_cents').notNull().default(0),
    lastRefundAttemptedAt: timestamp('last_refund_attempted_at'),
    status: orderStatusEnum().notNull().default('pending_payment'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    trackingHistory: jsonb('tracking_history').notNull().default(sql`'[]'::jsonb`),
    trackingStatus: text('tracking_status'),
    lastTrackingEventAt: timestamp('last_tracking_event_at'),
    processingTimeMaxBusinessDays: integer('processing_time_max_business_days'),
    transitTimeMinBusinessDays: integer('transit_time_min_business_days'),
    transitTimeMaxBusinessDays: integer('transit_time_max_business_days'),
    fulfillmentDueAt: timestamp('fulfillment_due_at'),
    earliestDeliveryAt: timestamp('earliest_delivery_at'),
    deliveryDueAt: timestamp('delivery_due_at'),
    shippedAt: timestamp('shipped_at'),
    disputeWindowExpiresAt: timestamp('dispute_window_expires_at'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('shop_order_platform_order_id_idx').on(table.platformOrderId),
    index('shop_order_shop_id_idx').on(table.shopId),
    index('shop_order_status_idx').on(table.status),
    index('shop_order_created_at_idx').on(table.createdAt),
    index('shop_order_shop_id_status_created_at_idx').on(
      table.shopId,
      table.status,
      table.createdAt,
    ),
    index('shop_order_status_created_at_idx').on(table.status, table.createdAt),
    check(
      'shop_order_refunded_cents_not_over_total',
      sql`${table.refundedCents} <= ${table.subtotalCents} + ${table.shippingCostCents}`,
    ),
    check('shop_order_refund_pending_cents_non_negative', sql`${table.refundPendingCents} >= 0`),
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
    returnPolicySnapshot: text('return_policy_snapshot').notNull().default('standard'),
    returnWindowDays: integer('return_window_days').notNull().default(14),
    weightGrams: integer('weight_grams'),
    lengthCm: integer('length_cm'),
    widthCm: integer('width_cm'),
    heightCm: integer('height_cm'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('order_item_shop_order_id_idx').on(table.shopOrderId),
    index('order_item_product_id_idx').on(table.productId),
    index('order_item_shop_order_id_product_id_idx').on(table.shopOrderId, table.productId),
    check('order_item_quantity_positive', sql`${table.quantity} > 0`),
    check(
      'order_item_return_policy_valid',
      sql`${table.returnPolicySnapshot} IN ('standard', 'personalized', 'perishable', 'hygiene_sealed')`,
    ),
    check('order_item_return_window_positive', sql`${table.returnWindowDays} > 0`),
  ],
)

export const guestOrderAccess = pgTable(
  'guest_order_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformOrderId: uuid('platform_order_id')
      .notNull()
      .references(() => platformOrder.id, { onDelete: 'cascade' }),
    emailHash: text('email_hash').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('guest_order_access_order_unique').on(table.platformOrderId),
    uniqueIndex('guest_order_access_token_hash_unique').on(table.tokenHash),
    index('guest_order_access_email_hash_idx').on(table.emailHash),
    index('guest_order_access_expires_at_idx').on(table.expiresAt),
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
    uniqueIndex('inventory_reservation_product_order_unique')
      .on(table.productId, table.platformOrderId)
      .where(isNotNull(table.platformOrderId)),
    uniqueIndex('inventory_reservation_product_cart_unique')
      .on(table.productId, table.cartId)
      .where(isNotNull(table.cartId)),
    check(
      'inventory_reservation_owner_check',
      sql`
        (${table.platformOrderId} IS NOT NULL AND ${table.cartId} IS NULL)
        OR
        (${table.platformOrderId} IS NULL AND ${table.cartId} IS NOT NULL)
      `,
    ),
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

export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'in_transit',
  'sent',
  'failed',
  'reversed',
  'returned',
])

export const payout = pgTable(
  'payout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull().default(0),
    status: payoutStatusEnum().notNull().default('pending'),
    molliePaymentId: text('mollie_payment_id'),
    mollieRouteId: text('mollie_route_id'),
    executedAt: timestamp('executed_at'),
    failedAt: timestamp('failed_at'),
    failureReason: text('failure_reason'),
    reversedAt: timestamp('reversed_at'),
    reversalReason: text('reversal_reason'),
    returnedAt: timestamp('returned_at'),
    returnReason: text('return_reason'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payout_shop_order_id_unique').on(table.shopOrderId),
    index('payout_shop_id_idx').on(table.shopId),
    index('payout_status_idx').on(table.status),
    index('payout_created_at_idx').on(table.createdAt),
    index('payout_mollie_payment_id_idx').on(table.molliePaymentId),
    index('payout_mollie_route_id_idx').on(table.mollieRouteId),
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
    openedFromOrderStatus: orderStatusEnum('opened_from_order_status'),
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

export const returnRequestStatusEnum = pgEnum('return_request_status', [
  'requested',
  'authorized',
  'awaiting_shipment',
  'in_transit',
  'received',
  'refund_pending',
  'refunded',
  'rejected',
  'closed',
])

export const returnRequestTypeEnum = pgEnum('return_request_type', ['withdrawal', 'defective'])

export const returnRequest = pgTable(
  'return_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    buyerUserId: text('buyer_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    type: returnRequestTypeEnum('type').notNull(),
    status: returnRequestStatusEnum('status').notNull().default('requested'),
    reason: text().notNull(),
    returnShippingPayer: text('return_shipping_payer').notNull(),
    policyVersion: text('policy_version').notNull().default('eu-baseline-2026-01'),
    requestDeadline: timestamp('request_deadline').notNull(),
    returnDeadline: timestamp('return_deadline').notNull(),
    refundCents: integer('refund_cents').notNull().default(0),
    outboundShippingRefundCents: integer('outbound_shipping_refund_cents').notNull().default(0),
    carrier: text(),
    trackingNumber: text('tracking_number'),
    labelUrl: text('label_url'),
    rejectionReason: text('rejection_reason'),
    receivedAt: timestamp('received_at'),
    refundAttemptedAt: timestamp('refund_attempted_at'),
    refundedAt: timestamp('refunded_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('return_request_shop_order_idx').on(table.shopOrderId),
    index('return_request_buyer_idx').on(table.buyerUserId),
    index('return_request_status_idx').on(table.status),
    check(
      'return_request_shipping_payer_valid',
      sql`${table.returnShippingPayer} IN ('buyer', 'seller')`,
    ),
    check('return_request_refund_non_negative', sql`${table.refundCents} >= 0`),
    check(
      'return_request_outbound_refund_non_negative',
      sql`${table.outboundShippingRefundCents} >= 0`,
    ),
  ],
)

export const returnRequestItem = pgTable(
  'return_request_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    returnRequestId: uuid('return_request_id')
      .notNull()
      .references(() => returnRequest.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItem.id, { onDelete: 'restrict' }),
    quantity: integer().notNull(),
    refundCents: integer('refund_cents').notNull(),
  },
  (table) => [
    uniqueIndex('return_request_item_unique').on(table.returnRequestId, table.orderItemId),
    index('return_request_item_request_idx').on(table.returnRequestId),
    check('return_request_item_quantity_positive', sql`${table.quantity} > 0`),
    check('return_request_item_refund_non_negative', sql`${table.refundCents} >= 0`),
  ],
)

export const returnRequestMessage = pgTable(
  'return_request_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    returnRequestId: uuid('return_request_id')
      .notNull()
      .references(() => returnRequest.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    message: text().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('return_request_message_request_idx').on(table.returnRequestId)],
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

export const customerNote = pgTable(
  'customer_note',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    customerEmailHash: text('customer_email_hash').notNull(),
    content: text().notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('customer_note_shop_id_customer_email_hash_idx').on(
      table.shopId,
      table.customerEmailHash,
    ),
  ],
)

export const customerTag = pgTable(
  'customer_tag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    customerEmailHash: text('customer_email_hash').notNull(),
    tag: text().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('customer_tag_shop_customer_tag_unique').on(
      table.shopId,
      table.customerEmailHash,
      table.tag,
    ),
  ],
)

export const ownerMessageThread = pgTable(
  'owner_message_thread',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    customerUserId: text('customer_user_id').references(() => user.id, { onDelete: 'cascade' }),
    customerEmailHash: text('customer_email_hash').notNull(),
    subject: text().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('owner_message_thread_shop_id_customer_email_hash_idx').on(
      table.shopId,
      table.customerEmailHash,
    ),
  ],
)

export const ownerMessage = pgTable(
  'owner_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => ownerMessageThread.id, { onDelete: 'cascade' }),
    senderRole: text('sender_role').notNull(),
    body: text().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('owner_message_thread_id_idx').on(table.threadId),
    check(
      'owner_message_sender_role_check',
      sql`${table.senderRole} IN ('owner', 'buyer', 'system')`,
    ),
  ],
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
    externalParcelId: text('external_parcel_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('shipping_label_shop_order_id_idx').on(table.shopOrderId)],
)

export const sendcloudWebhookEvent = pgTable(
  'sendcloud_webhook_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    payload: jsonb('payload').notNull(),
    signatureHeader: text('signature_header'),
    trackingNumber: text('tracking_number'),
    parcelId: text('parcel_id'),
    status: text('status'),
    processedAt: timestamp('processed_at'),
    error: text(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('sendcloud_webhook_event_tracking_number_idx').on(table.trackingNumber),
    index('sendcloud_webhook_event_parcel_id_idx').on(table.parcelId),
    index('sendcloud_webhook_event_created_at_idx').on(table.createdAt),
  ],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
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
    index('idx_rate_limit_updated_at').on(table.updatedAt),
    index('rate_limit_window_start_idx').on(table.windowStart),
  ],
)

export const emailOutboxStatusEnum = pgEnum('email_outbox_status', [
  'pending',
  'sending',
  'sent',
  'failed',
  'suppressed',
  'bounced',
])

export const emailSendLogStatusEnum = pgEnum('email_send_log_status', [
  'accepted',
  'delivered',
  'bounced',
  'complained',
  'failed',
  'suppressed',
  'skipped',
])

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    recipientHash: text('recipient_hash').notNull(),
    recipientEmail: text('recipient_email'),
    template: text().notNull(),
    locale: text().notNull().default('en'),
    data: jsonb().notNull(),
    category: text().notNull().default('transactional'),
    status: emailOutboxStatusEnum('status').notNull().default('pending'),
    scheduledAt: timestamp('scheduled_at').notNull().defaultNow(),
    sentAt: timestamp('sent_at'),
    provider: text(),
    providerMessageId: text('provider_message_id'),
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    nextRetryAt: timestamp('next_retry_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('email_outbox_status_scheduled_idx').on(table.status, table.scheduledAt),
    index('email_outbox_next_retry_idx').on(table.status, table.nextRetryAt),
    index('email_outbox_idempotency_idx').on(table.idempotencyKey),
    index('email_outbox_recipient_hash_idx').on(table.recipientHash),
    index('email_outbox_user_id_idx').on(table.userId),
  ],
)

export const emailSendLog = pgTable(
  'email_send_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outboxId: uuid('outbox_id').references(() => emailOutbox.id, { onDelete: 'set null' }),
    recipientHash: text('recipient_hash').notNull(),
    template: text().notNull(),
    category: text().notNull().default('transactional'),
    provider: text().notNull(),
    providerMessageId: text('provider_message_id'),
    status: emailSendLogStatusEnum('status').notNull(),
    statusDetail: text('status_detail'),
    eventData: jsonb('event_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('email_send_log_outbox_idx').on(table.outboxId),
    index('email_send_log_recipient_hash_idx').on(table.recipientHash),
    index('email_send_log_provider_msg_idx').on(table.provider, table.providerMessageId),
    index('email_send_log_created_at_idx').on(table.createdAt),
  ],
)

export const brevoWebhookEvent = pgTable(
  'brevo_webhook_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    payload: jsonb('payload').notNull(),
    signatureHeader: text('signature_header'),
    processedAt: timestamp('processed_at'),
    error: text(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('brevo_webhook_event_created_at_idx').on(table.createdAt),
    index('brevo_webhook_event_processed_at_idx').on(table.processedAt),
  ],
)

export const emailSuppression = pgTable(
  'email_suppression',
  {
    email: text().primaryKey(),
    reason: text().notNull(),
    source: text(),
    expiresAt: timestamp('expires_at'), // null = permanent
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('email_suppression_expires_at_idx').on(table.expiresAt)],
)

export const emailPreferenceCategoryEnum = pgEnum('email_preference_category', [
  'seller_updates',
  'marketing',
  'platform_announcements',
])

export const userEmailPreference = pgTable(
  'user_email_preference',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    category: emailPreferenceCategoryEnum('category').notNull(),
    enabled: boolean().notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_email_preference_user_category_idx').on(table.userId, table.category),
    index('user_email_preference_user_idx').on(table.userId),
  ],
)

export const invoiceTypeEnum = pgEnum('invoice_type', ['platform_fee', 'customer', 'credit_note'])

export const invoiceNumberSequence = pgTable(
  'invoice_number_sequence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prefix: text('prefix').notNull().unique(),
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('invoice_number_sequence_prefix_idx').on(table.prefix)],
)

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceNumber: text('invoice_number').notNull().unique(),
    type: invoiceTypeEnum('type').notNull(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    originalInvoiceNumber: text('original_invoice_number'),
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
    foreignKey({
      columns: [table.originalInvoiceNumber],
      foreignColumns: [table.invoiceNumber],
      name: 'invoices_original_invoice_number_invoices_invoice_number_fk',
    })
      .onDelete('restrict')
      .onUpdate('no action'),
  ],
)

export const financialTotalAudit = pgTable(
  'financial_total_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(), // 'platform_order' | 'shop_order' | 'order_item'
    entityId: text('entity_id').notNull(),
    fieldName: text('field_name').notNull(),
    storedCents: integer('stored_cents').notNull(),
    computedCents: integer('computed_cents').notNull(),
    diffCents: integer('diff_cents').notNull(),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('financial_total_audit_entity_idx').on(table.entityType, table.entityId),
    index('financial_total_audit_created_at_idx').on(table.createdAt),
  ],
)

export const meilisearchSyncActionEnum = pgEnum('meilisearch_sync_action', ['index', 'delete'])
export const meilisearchSyncQueueStatusEnum = pgEnum('meilisearch_sync_queue_status', [
  'pending',
  'completed',
  'failed',
])

export const meilisearchSyncQueue = pgTable(
  'meilisearch_sync_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    action: meilisearchSyncActionEnum('action').notNull(),
    status: meilisearchSyncQueueStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    runAt: timestamp('run_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('meilisearch_sync_queue_status_run_at_idx').on(table.status, table.runAt)],
)

export const payoutReconciliationLog = pgTable(
  'payout_reconciliation_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    payoutId: uuid('payout_id')
      .notNull()
      .references(() => payout.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    molliePaymentId: text('mollie_payment_id'),
    mollieRouteId: text('mollie_route_id'),
    amountCents: integer('amount_cents'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('payout_reconciliation_log_payout_id_idx').on(table.payoutId),
    index('payout_reconciliation_log_created_at_idx').on(table.createdAt),
  ],
)
