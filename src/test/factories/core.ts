import { randomUUID } from 'node:crypto'
import { db } from '#/db/index'
import * as schema from '#/db/schema'
import type { UserLike } from '#/test/helpers'

function uuidSuffix(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

export async function createUser(
  overrides?: Partial<typeof schema.user.$inferInsert>,
): Promise<typeof schema.user.$inferSelect> {
  const suffix = uuidSuffix()
  const [row] = await db
    .insert(schema.user)
    .values({
      id: `user-${suffix}`,
      name: 'Test User',
      email: `test-${suffix}@example.com`,
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
  return row
}

export async function createShop(
  owner: UserLike | string,
  overrides?: Partial<typeof schema.shop.$inferInsert>,
): Promise<typeof schema.shop.$inferSelect> {
  const ownerId = typeof owner === 'string' ? owner : owner.id
  const suffix = uuidSuffix()
  const [row] = await db
    .insert(schema.shop)
    .values({
      id: `shop-${suffix}`,
      name: `Test Shop ${suffix}`,
      slug: `test-shop-${suffix}`,
      ownerId,
      status: 'active',
      currency: 'EUR',
      ...overrides,
    })
    .returning()
  return row
}

export async function createCategory(
  overrides?: Partial<typeof schema.categories.$inferInsert>,
): Promise<typeof schema.categories.$inferSelect> {
  const suffix = uuidSuffix()
  const [row] = await db
    .insert(schema.categories)
    .values({
      name: `Test Category ${suffix}`,
      slug: `test-category-${suffix}`,
      ...overrides,
    })
    .returning()
  return row
}

export async function createProduct(
  shop: { id: string } | string,
  overrides?: Partial<typeof schema.product.$inferInsert>,
): Promise<typeof schema.product.$inferSelect> {
  const shopId = typeof shop === 'string' ? shop : shop.id
  const suffix = uuidSuffix()
  const [row] = await db
    .insert(schema.product)
    .values({
      id: `prod-${suffix}`,
      name: `Test Product ${suffix}`,
      slug: `test-product-${suffix}`,
      priceCents: 1000,
      stockCount: 10,
      shopId,
      isActive: true,
      status: 'published',
      ...overrides,
    })
    .returning()
  return row
}

export async function createProductImage(
  product: { id: string } | string,
  overrides?: Partial<typeof schema.productImage.$inferInsert>,
): Promise<typeof schema.productImage.$inferSelect> {
  const productId = typeof product === 'string' ? product : product.id
  const [row] = await db
    .insert(schema.productImage)
    .values({
      id: `img-${uuidSuffix()}`,
      productId,
      url: 'https://example.com/image.jpg',
      sortOrder: 0,
      ...overrides,
    })
    .returning()
  return row
}

export async function createProductVariant(
  product: { id: string } | string,
  overrides?: Partial<typeof schema.productVariant.$inferInsert>,
): Promise<typeof schema.productVariant.$inferSelect> {
  const productId = typeof product === 'string' ? product : product.id
  const suffix = uuidSuffix()
  const [row] = await db
    .insert(schema.productVariant)
    .values({
      id: `variant-${suffix}`,
      productId,
      name: `Variant ${suffix}`,
      ...overrides,
    })
    .returning()
  return row
}
