import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { product } from '#/db/schema'
import { createCategory, createProduct, createShop, createUser } from '#/test/factories'

import { createProductInternal } from './creator.server'
import { getProductBySlugQuery } from './operations.server'
import { deriveUnitPriceCents } from './unit-pricing'
import { clearTestTables } from '#/test/cleanup'

beforeEach(async () => {
  await clearTestTables()
})

async function seedScopedCategoryTree() {
  const root = await createCategory({ name: 'Soap & Bath', slug: 'soap-bath', parentId: null })
  const leaf = await createCategory({ name: 'Bar Soap', slug: 'bar-soap', parentId: root.id })
  return { root, leaf }
}

describe('unit pricing disclosure accuracy', () => {
  it('carries the declaration through the product page projection', async () => {
    const user = await createUser()
    const shop = await createShop(user)
    const { leaf } = await seedScopedCategoryTree()
    await createProduct(shop, {
      slug: 'olive-soap',
      priceCents: 1250,
      categoryId: leaf.id,
      soldBy: 'weight',
      weightGrams: 250,
      volumeMl: null,
      status: 'published',
      isActive: true,
    })

    const detail = await getProductBySlugQuery(shop.slug, 'olive-soap')
    expect(detail).not.toBeNull()
    if (!detail) return

    expect(detail.soldBy).toBe('weight')
    expect(detail.weightGrams).toBe(250)
    // The rendered note must equal the stored declaration: €12.50 / 250 g = €50/kg.
    expect(
      deriveUnitPriceCents({
        soldBy: detail.soldBy,
        priceCents: detail.priceCents,
        weightGrams: detail.weightGrams,
        volumeMl: detail.volumeMl,
      }),
    ).toBe(5000)
  })

  it('renders nothing for a legacy scoped product without a declaration', async () => {
    const user = await createUser()
    const shop = await createShop(user)
    const { leaf } = await seedScopedCategoryTree()
    await createProduct(shop, {
      slug: 'legacy-soap',
      priceCents: 900,
      categoryId: leaf.id,
      soldBy: null,
      weightGrams: 250,
      status: 'published',
      isActive: true,
    })

    const detail = await getProductBySlugQuery(shop.slug, 'legacy-soap')
    expect(detail?.soldBy).toBeNull()
    expect(
      deriveUnitPriceCents({
        soldBy: detail?.soldBy ?? null,
        priceCents: detail?.priceCents ?? 0,
        weightGrams: detail?.weightGrams ?? null,
        volumeMl: detail?.volumeMl ?? null,
      }),
    ).toBeNull()
  })

  it('never carries a basis for unscoped products', async () => {
    const user = await createUser()
    const shop = await createShop(user)
    const candles = await createCategory({ name: 'Candles', slug: 'candles', parentId: null })
    await createProductInternal({
      name: 'Beeswax Candle',
      slug: 'beeswax-candle',
      priceCents: 1400,
      stockCount: 1,
      shopId: shop.id,
      categoryId: candles.id,
      soldBy: 'weight',
      weightGrams: 200,
      status: 'published',
    })

    const detail = await getProductBySlugQuery(shop.slug, 'beeswax-candle')
    // The write path strips declarations outside the Annex II list.
    expect(detail?.soldBy).toBeNull()
  })
})

describe('unit pricing write gate', () => {
  it('rejects a scoped product without a complete declaration', async () => {
    const user = await createUser()
    const shop = await createShop(user)
    const { leaf } = await seedScopedCategoryTree()

    await expect(
      createProductInternal({
        name: 'Incomplete Soap',
        slug: 'incomplete-soap',
        priceCents: 800,
        stockCount: 1,
        shopId: shop.id,
        categoryId: leaf.id,
        status: 'draft',
      }),
    ).rejects.toThrow('UNIT_PRICE_REQUIRED')
  })

  it('persists the declaration for a complete scoped product', async () => {
    const user = await createUser()
    const shop = await createShop(user)
    const { leaf } = await seedScopedCategoryTree()

    const created = await createProductInternal({
      name: 'Complete Soap',
      slug: 'complete-soap',
      priceCents: 800,
      stockCount: 1,
      shopId: shop.id,
      categoryId: leaf.id,
      soldBy: 'volume',
      volumeMl: 300,
      status: 'draft',
    })

    const [row] = await db.select().from(product).where(eq(product.id, created.id))
    expect(row.soldBy).toBe('volume')
    expect(row.volumeMl).toBe(300)
  })

  it('strips declarations on unscoped products', async () => {
    const user = await createUser()
    const shop = await createShop(user)
    const candles = await createCategory({ name: 'Candles', slug: 'candles', parentId: null })

    const created = await createProductInternal({
      name: 'Candle',
      slug: 'plain-candle',
      priceCents: 1400,
      stockCount: 1,
      shopId: shop.id,
      categoryId: candles.id,
      soldBy: 'weight',
      weightGrams: 200,
      status: 'draft',
    })

    const [row] = await db.select().from(product).where(eq(product.id, created.id))
    expect(row.soldBy).toBeNull()
  })
})
