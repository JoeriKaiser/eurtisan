import {
  boolean,
  foreignKey,
  index,
  integer,
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
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isSuspended: boolean('is_suspended').notNull().default(false),
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
