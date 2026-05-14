import { sql } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['customer', 'creator', 'admin'])

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: userRoleEnum().notNull().default('customer'),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
})

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
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
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const shop = pgTable(
  'shop',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text(),
    slug: text().notNull(),
    image: text(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isSuspended: boolean('is_suspended').notNull().default(false),
    moderationNote: text('moderation_note'),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('shop_ownerId_idx').on(table.ownerId),
    uniqueIndex('shop_slug_unique').on(table.slug),
  ],
)

export const todos = pgTable('todos', {
  id: serial().primaryKey(),
  title: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const categories = pgTable(
  'category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    description: text(),
    parentId: uuid('parent_id'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('category_slug_idx').on(table.slug),
    index('category_parent_id_idx').on(table.parentId),
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
    index('product_category_is_active_created_at_idx').on(
      table.categoryId,
      table.isActive,
      table.createdAt,
    ),
    uniqueIndex('product_shop_slug_unique').on(table.shopId, table.slug),
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
  ],
)

export const cartItem = pgTable(
  'cart_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => cart.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
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
])

export const shippingMethodEnum = pgEnum('shipping_method', ['standard', 'express'])

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
      .references(() => product.id, { onDelete: 'restrict' }),
    productName: text('product_name').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    quantity: integer().notNull(),
    totalCents: integer('total_cents').notNull().default(0),
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
    platformOrderId: uuid('platform_order_id')
      .notNull()
      .references(() => platformOrder.id, { onDelete: 'cascade' }),
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
  ],
)

export const review = pgTable(
  'review',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopOrderId: uuid('shop_order_id')
      .notNull()
      .references(() => shopOrder.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
    buyerUserId: text('buyer_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: integer().notNull(),
    comment: text(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('review_product_id_idx').on(table.productId),
    index('review_shop_order_id_idx').on(table.shopOrderId),
    uniqueIndex('review_shop_order_product_unique').on(table.shopOrderId, table.productId),
  ],
)

export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'sent'])

export const payout = pgTable(
  'payout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shop.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull().default(0),
    status: payoutStatusEnum().notNull().default('pending'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('payout_shop_id_idx').on(table.shopId),
    index('payout_status_idx').on(table.status),
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
    uniqueIndex('dispute_shop_order_id_unique').on(table.shopOrderId),
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
