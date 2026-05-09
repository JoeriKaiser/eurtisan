import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, product, shop } from '#/db/schema'

function parsePriceToCents(price: string): number {
  const parsed = parseFloat(price.trim())
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Invalid price value')
  }
  return Math.round(parsed * 100)
}

export async function listProductsByShopQuery(shopId: string) {
  return db.select().from(product).where(eq(product.shopId, shopId))
}

export async function listProductsByCategorySlugQuery(slug: string) {
  const category = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1)

  if (category.length === 0) {
    return []
  }

  return db
    .select({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      priceCents: product.priceCents,
      shopId: product.shopId,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      categoryName: categories.name,
      shopName: shop.name,
    })
    .from(product)
    .innerJoin(categories, eq(product.categoryId, categories.id))
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(
      and(
        eq(product.categoryId, category[0].id),
        eq(shop.isSuspended, false),
        eq(product.isActive, true),
      ),
    )
}

export async function getProductBySlugQuery(shopId: string, slug: string) {
  const [result] = await db
    .select({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: product.slug,
      priceCents: product.priceCents,
      shopId: product.shopId,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      categoryName: categories.name,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .leftJoin(categories, eq(product.categoryId, categories.id))
    .where(
      and(
        eq(product.shopId, shopId),
        eq(product.slug, slug),
        eq(shop.isSuspended, false),
        eq(product.isActive, true),
      ),
    )
    .limit(1)

  return result ?? null
}

function formatPriceCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export async function listRecentProductsQuery(limit = 8) {
  // Avoid join column-name collisions by querying in two steps.
  // N+2 is fine for a landing page with ≤8 products.
  const productsList = await db
    .select()
    .from(product)
    .where(eq(product.isActive, true))
    .orderBy(desc(product.createdAt))
    .limit(limit)

  if (productsList.length === 0) {
    return []
  }

  const shopIds = [...new Set(productsList.map((p) => p.shopId))]
  const shops =
    shopIds.length > 0
      ? await db
          .select({ id: shop.id, name: shop.name })
          .from(shop)
          .where(inArray(shop.id, shopIds))
      : []
  const shopMap = new Map(shops.map((s) => [s.id, s.name]))

  const categoryIds = [...new Set(productsList.map((p) => p.categoryId).filter(Boolean))]
  const categoryList =
    categoryIds.length > 0
      ? await db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, categoryIds as string[]))
      : []
  const categoryMap = new Map(categoryList.map((c) => [c.id, c.name]))

  return productsList.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    slug: p.slug,
    price: formatPriceCents(p.priceCents),
    shopId: p.shopId,
    categoryId: p.categoryId,
    createdAt: p.createdAt,
    shopName: shopMap.get(p.shopId) ?? 'Unknown',
    categoryName: p.categoryId ? (categoryMap.get(p.categoryId) ?? null) : null,
  }))
}

export async function createProductInternal(data: {
  name: string
  description?: string
  slug: string
  price: string
  shopId: string
  categoryId?: string
}) {
  const existing = await db
    .select()
    .from(product)
    .where(and(eq(product.shopId, data.shopId), eq(product.slug, data.slug)))
    .limit(1)

  if (existing.length > 0) {
    throw new Error(`A product with slug "${data.slug}" already exists in this shop`)
  }

  const [newProduct] = await db
    .insert(product)
    .values({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      slug: data.slug.trim(),
      priceCents: parsePriceToCents(data.price),
      shopId: data.shopId,
      categoryId: data.categoryId ?? null,
    })
    .returning()

  return newProduct
}
