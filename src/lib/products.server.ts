import { and, eq } from 'drizzle-orm'
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
