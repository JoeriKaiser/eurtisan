import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  categories,
  orderItem,
  platformOrder,
  product,
  review,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { listAllProductsQuery, toggleProductActiveQuery } from './admin-products.server'

beforeEach(async () => {
  await db.delete(review)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(categories)
  await db.delete(shop)
  await db.delete(user)
})

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  const [u] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: 'Test',
      email: `test-${Date.now()}@example.com`,
      emailVerified: true,
    })
    .returning()

  const [s] = await db
    .insert(shop)
    .values({
      id: crypto.randomUUID(),
      name: 'Test Shop',
      slug: `test-shop-${Date.now()}`,
      ownerId: u.id,
      ...overrides,
    })
    .returning()
  return s
}

describe('listAllProductsQuery', () => {
  it('returns paginated products across shops', async () => {
    const s = await seedShop()
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 5,
      shopId: s.id,
      isActive: true,
    })

    const result = await listAllProductsQuery({ page: 1, pageSize: 10 })
    expect(result.products.length).toBe(1)
    expect(result.products[0].name).toBe('Vase')
    expect(result.total).toBe(1)
  })

  it('filters by shop', async () => {
    const s1 = await seedShop()
    const s2 = await seedShop()
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 5,
      shopId: s1.id,
    })
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Bowl',
      slug: 'bowl',
      priceCents: 1000,
      stockCount: 5,
      shopId: s2.id,
    })

    const result = await listAllProductsQuery({ page: 1, pageSize: 10, shopId: s1.id })
    expect(result.products.length).toBe(1)
    expect(result.products[0].name).toBe('Vase')
  })

  it('filters by status', async () => {
    const s = await seedShop()
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Active',
      slug: 'active',
      priceCents: 1000,
      stockCount: 5,
      shopId: s.id,
      isActive: true,
    })
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Inactive',
      slug: 'inactive',
      priceCents: 1000,
      stockCount: 5,
      shopId: s.id,
      isActive: false,
    })

    const active = await listAllProductsQuery({ page: 1, pageSize: 10, status: 'active' })
    expect(active.products.length).toBe(1)
    expect(active.products[0].name).toBe('Active')

    const inactive = await listAllProductsQuery({ page: 1, pageSize: 10, status: 'inactive' })
    expect(inactive.products.length).toBe(1)
    expect(inactive.products[0].name).toBe('Inactive')
  })

  it('filters by price range', async () => {
    const s = await seedShop()
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Cheap',
      slug: 'cheap',
      priceCents: 500,
      stockCount: 5,
      shopId: s.id,
    })
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Expensive',
      slug: 'expensive',
      priceCents: 5000,
      stockCount: 5,
      shopId: s.id,
    })

    const result = await listAllProductsQuery({
      page: 1,
      pageSize: 10,
      minPriceCents: 1000,
      maxPriceCents: 6000,
    })
    expect(result.products.length).toBe(1)
    expect(result.products[0].name).toBe('Expensive')
  })

  it('searches by product name', async () => {
    const s = await seedShop()
    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: 'Blue Vase',
      slug: 'blue-vase',
      priceCents: 1000,
      stockCount: 5,
      shopId: s.id,
    })

    const result = await listAllProductsQuery({ page: 1, pageSize: 10, query: 'blue' })
    expect(result.products.length).toBe(1)
  })
})

describe('toggleProductActiveQuery', () => {
  it('toggles active to inactive', async () => {
    const s = await seedShop()
    const [p] = await db
      .insert(product)
      .values({
        id: crypto.randomUUID(),
        name: 'Vase',
        slug: 'vase',
        priceCents: 1000,
        stockCount: 5,
        shopId: s.id,
        isActive: true,
      })
      .returning()

    const result = await toggleProductActiveQuery(p.id)
    expect(result.isActive).toBe(false)

    const [row] = await db.select().from(product).where(eq(product.id, p.id))
    expect(row.isActive).toBe(false)
  })

  it('toggles inactive to active', async () => {
    const s = await seedShop()
    const [p] = await db
      .insert(product)
      .values({
        id: crypto.randomUUID(),
        name: 'Vase',
        slug: 'vase',
        priceCents: 1000,
        stockCount: 5,
        shopId: s.id,
        isActive: false,
      })
      .returning()

    const result = await toggleProductActiveQuery(p.id)
    expect(result.isActive).toBe(true)
  })

  it('throws for missing product', async () => {
    await expect(toggleProductActiveQuery('nonexistent')).rejects.toThrow('Product not found')
  })
})
