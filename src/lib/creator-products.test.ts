import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { product, productImage } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import {
  createCategory,
  createProduct,
  createProductImage,
  createShop,
  createUser,
} from '#/test/factories'

import {
  checkSlugUniqueness,
  createProductInternal,
  createProductSchema,
  deleteProductInternal,
  listCreatorProductsInternal,
  toggleProductActiveInternal,
  updateProductInternal,
  updateProductSchema,
  validateCategory,
  verifyProductOwnership,
} from './creator-products.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('./image-storage.server', () => ({
  deleteImageFromStorage: vi.fn(),
  extractKeyFromUrl: (url: string) => {
    if (/^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/.test(url)) return url
    return null
  },
  isExternalImageUrl: (url: string) => {
    return /^(https?:\/\/[^/]+|\/uploads\/).+\.(jpg|jpeg|png|webp)$/i.test(url)
  },
}))

beforeEach(async () => {
  await clearTestTables()
})

afterAll(async () => {
  await clearTestTables()
})

/* -------------------------------------------------------------------------- */
/*                                 Schema Tests                               */
/* -------------------------------------------------------------------------- */

describe('createProductSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      description: 'A beautiful ceramic vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input without optional fields', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      stockCount: 10,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createProductSchema.safeParse({
      name: '',
      slug: 'handmade-vase',
      priceCents: 2999,
      stockCount: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 100 chars', () => {
    const result = createProductSchema.safeParse({
      name: 'a'.repeat(101),
      slug: 'handmade-vase',
      priceCents: 2999,
      stockCount: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid slug', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade_vase!!!',
      priceCents: 2999,
      stockCount: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero price', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative stock', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      stockCount: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid categoryId', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      stockCount: 10,
      categoryId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects price above max (€1,000,000.00)', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 1_000_000_00 + 1,
      stockCount: 10,
    })
    expect(result.success).toBe(false)
  })

  it('accepts price at max (€1,000,000.00)', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 1_000_000_00,
      stockCount: 10,
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid shipping dimensions', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      weightGrams: 500,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 5,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.weightGrams).toBe(500)
    expect(result.data.lengthCm).toBe(20)
    expect(result.data.widthCm).toBe(15)
    expect(result.data.heightCm).toBe(5)
  })

  it('rejects non-positive shipping dimensions', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      weightGrams: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer shipping dimensions', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      weightGrams: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('updateProductSchema', () => {
  it('rejects price above max (€1,000,000.00)', () => {
    const result = updateProductSchema.safeParse({
      productId: 'prod-1',
      shopId: 'shop-1',
      priceCents: 1_000_000_00 + 1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts price at max (€1,000,000.00)', () => {
    const result = updateProductSchema.safeParse({
      productId: 'prod-1',
      shopId: 'shop-1',
      priceCents: 1_000_000_00,
    })
    expect(result.success).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/*                              Helper Tests                                  */
/* -------------------------------------------------------------------------- */

describe('validateCategory', () => {
  it('returns true for undefined categoryId', async () => {
    expect(await validateCategory(undefined)).toBe(true)
  })

  it('returns true for existing category', async () => {
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery' })
    expect(await validateCategory(cat.id)).toBe(true)
  })

  it('returns false for nonexistent category', async () => {
    expect(await validateCategory('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
  })
})

describe('checkSlugUniqueness', () => {
  it('returns true when slug is unique', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    expect(await checkSlugUniqueness('new-slug', s.id)).toBe(true)
  })

  it('returns false when slug exists in shop', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    expect(await checkSlugUniqueness('vase', s.id)).toBe(false)
  })

  it('returns true when excluding the same product', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    expect(await checkSlugUniqueness('vase', s.id, p.id)).toBe(true)
  })
})

describe('verifyProductOwnership', () => {
  it('returns product when user owns the shop', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    const result = await verifyProductOwnership(p.id, u.id)
    expect(result.id).toBe(p.id)
  })

  it('throws NOT_FOUND for nonexistent product', async () => {
    const u = await createUser()

    await expect(verifyProductOwnership('nonexistent', u.id)).rejects.toThrow('NOT_FOUND')
  })

  it('throws FORBIDDEN when user does not own the shop', async () => {
    const u1 = await createUser()
    const u2 = await createUser()
    const s = await createShop(u1, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await expect(verifyProductOwnership(p.id, u2.id)).rejects.toThrow('FORBIDDEN')
  })
})

/* -------------------------------------------------------------------------- */
/*                            createProductInternal                           */
/* -------------------------------------------------------------------------- */

describe('createProductInternal', () => {
  it('creates a product successfully', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const result = await createProductInternal({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
      stockCount: 10,
      shopId: s.id,
    })

    expect(result.name).toBe('Handmade Vase')
    expect(result.slug).toBe('handmade-vase')
    expect(result.priceCents).toBe(2999)
    expect(result.stockCount).toBe(10)
    expect(result.isActive).toBe(true)
  })

  it('persists shipping dimensions', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const result = await createProductInternal({
      name: 'Heavy Vase',
      slug: 'heavy-vase',
      priceCents: 4999,
      stockCount: 5,
      shopId: s.id,
      weightGrams: 1200,
      lengthCm: 25,
      widthCm: 20,
      heightCm: 15,
    })

    expect(result.weightGrams).toBe(1200)
    expect(result.lengthCm).toBe(25)
    expect(result.widthCm).toBe(20)
    expect(result.heightCm).toBe(15)

    const [row] = await db.select().from(product).where(eq(product.id, result.id)).limit(1)
    expect(row.weightGrams).toBe(1200)
    expect(row.lengthCm).toBe(25)
    expect(row.widthCm).toBe(20)
    expect(row.heightCm).toBe(15)
  })

  it('rejects duplicate slug within the same shop', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      shopId: s.id,
      status: 'published',
    })

    await expect(
      createProductInternal({
        name: 'Another Vase',
        slug: 'vase',
        priceCents: 3999,
        stockCount: 10,
        shopId: s.id,
        status: 'published',
      }),
    ).rejects.toThrow('DUPLICATE_SLUG')
  })

  it('allows same slug in different shops', async () => {
    const u = await createUser()
    const s1 = await createShop(u, { name: 'Test Shop 1', slug: 'test-shop-1' })
    const s2 = await createShop(u, { name: 'Test Shop 2', slug: 'test-shop-2' })

    await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      shopId: s1.id,
    })

    const result = await createProductInternal({
      name: 'Another Vase',
      slug: 'vase',
      priceCents: 3999,
      stockCount: 10,
      shopId: s2.id,
    })

    expect(result.slug).toBe('vase')
    expect(result.shopId).toBe(s2.id)
  })

  it('rejects invalid category_id', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        stockCount: 10,
        shopId: s.id,
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).rejects.toThrow('Invalid category_id')
  })
})

/* -------------------------------------------------------------------------- */
/*                            updateProductInternal                           */
/* -------------------------------------------------------------------------- */

describe('updateProductInternal', () => {
  it('updates product fields partially', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    const result = await updateProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      name: 'Updated Vase',
      priceCents: 3999,
    })

    expect(result.name).toBe('Updated Vase')
    expect(result.priceCents).toBe(3999)
    expect(result.slug).toBe('vase') // unchanged
  })

  it('updates shipping dimensions', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    const result = await updateProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      weightGrams: 800,
      lengthCm: 18,
      widthCm: 12,
      heightCm: 8,
    })

    expect(result.weightGrams).toBe(800)
    expect(result.lengthCm).toBe(18)
    expect(result.widthCm).toBe(12)
    expect(result.heightCm).toBe(8)

    const [row] = await db.select().from(product).where(eq(product.id, p.id)).limit(1)
    expect(row.weightGrams).toBe(800)
    expect(row.lengthCm).toBe(18)
    expect(row.widthCm).toBe(12)
    expect(row.heightCm).toBe(8)
  })

  it('rejects slug change to an existing slug', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const p1 = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })
    await createProduct(s, { name: 'Bowl', slug: 'bowl', priceCents: 1999 })

    await expect(
      updateProductInternal({
        productId: p1.id,
        shopId: s.id,
        userId: u.id,
        slug: 'bowl',
      }),
    ).rejects.toThrow('DUPLICATE_SLUG')
  })

  it('throws FORBIDDEN when product does not belong to shop', async () => {
    const u = await createUser()
    const s1 = await createShop(u, { name: 'Test Shop 1', slug: 'test-shop-1' })
    const s2 = await createShop(u, { name: 'Test Shop 2', slug: 'test-shop-2' })
    const p = await createProduct(s1, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await expect(
      updateProductInternal({
        productId: p.id,
        shopId: s2.id,
        userId: u.id,
        name: 'Hacked',
      }),
    ).rejects.toThrow('FORBIDDEN')
  })

  it('throws FORBIDDEN when user does not own the product shop', async () => {
    const u1 = await createUser()
    const u2 = await createUser()
    const s = await createShop(u1, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await expect(
      updateProductInternal({
        productId: p.id,
        shopId: s.id,
        userId: u2.id,
        name: 'Hacked',
      }),
    ).rejects.toThrow('FORBIDDEN')
  })
})

/* -------------------------------------------------------------------------- */
/*                            deleteProductInternal                           */
/* -------------------------------------------------------------------------- */

describe('deleteProductInternal', () => {
  it('soft deletes a product', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, {
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      isActive: true,
    })

    const result = await deleteProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      hard: false,
    })

    expect(result.deleted).toBe(true)
    expect(result.hard).toBe(false)

    const [remaining] = await db.select().from(product).where(eq(product.id, p.id)).limit(1)
    expect(remaining.isActive).toBe(false)
  })

  it('hard deletes a product', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    const result = await deleteProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      hard: true,
    })

    expect(result.deleted).toBe(true)
    expect(result.hard).toBe(true)

    const remaining = await db.select().from(product).where(eq(product.id, p.id))
    expect(remaining).toHaveLength(0)
  })

  it('throws FORBIDDEN when user does not own the product', async () => {
    const u1 = await createUser()
    const u2 = await createUser()
    const s = await createShop(u1, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await expect(
      deleteProductInternal({
        productId: p.id,
        shopId: s.id,
        userId: u2.id,
        hard: false,
      }),
    ).rejects.toThrow('FORBIDDEN')
  })
})

/* -------------------------------------------------------------------------- */
/*                           listCreatorProductsInternal                      */
/* -------------------------------------------------------------------------- */

describe('listCreatorProductsInternal', () => {
  async function seedShopWithProducts() {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const cat = await createCategory({ name: 'Pottery', slug: 'pottery' })

    const p1 = await createProduct(s, {
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      categoryId: cat.id,
      isActive: true,
    })

    const p2 = await createProduct(s, {
      name: 'Bowl',
      slug: 'bowl',
      priceCents: 1999,
      categoryId: cat.id,
      isActive: false,
    })

    await createProductImage(p1, { url: 'http://example.com/1.jpg', sortOrder: 0 })
    await createProductImage(p1, { url: 'http://example.com/2.jpg', sortOrder: 1 })

    return { u, s, cat, p1, p2 }
  }

  it('returns paginated products with image counts', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
    })

    expect(result.products).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.totalPages).toBe(1)

    const vase = result.products.find((p) => p.slug === 'vase')
    expect(vase).toBeDefined()
    expect(vase?.imageCount).toBe(2)

    const bowl = result.products.find((p) => p.slug === 'bowl')
    expect(bowl).toBeDefined()
    expect(bowl?.imageCount).toBe(0)
  })

  it('filters by active status', async () => {
    const { s } = await seedShopWithProducts()

    const activeResult = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'true',
    })

    expect(activeResult.products).toHaveLength(1)
    expect(activeResult.products[0].slug).toBe('vase')

    const inactiveResult = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'false',
    })

    expect(inactiveResult.products).toHaveLength(1)
    expect(inactiveResult.products[0].slug).toBe('bowl')
  })

  it('filters by category', async () => {
    const { s, cat } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
      categoryId: cat.id,
    })

    expect(result.products).toHaveLength(2)
  })

  it('returns empty for nonexistent category', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('paginates correctly', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 1,
      active: 'all',
    })

    expect(result.products).toHaveLength(1)
    expect(result.total).toBe(2)
    expect(result.totalPages).toBe(2)
  })
})

/* -------------------------------------------------------------------------- */
/*                            Image Validation Tests                          */
/* -------------------------------------------------------------------------- */

describe('image validation', () => {
  it('accepts valid image keys', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      images: [
        { key: 'products/vase-1.jpg', altText: 'Front view' },
        { key: 'products/vase-2.png' },
        { key: 'products/vase-3.webp' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid image key format', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      images: [{ key: 'invalid-key.gif' }],
    })
    expect(result.success).toBe(false)
  })

  it('normalizes S3 URLs to object keys', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      images: [{ key: 'https://s3.example.com/eurtisan-uploads/products/vase-1.jpg' }],
    })
    expect(result.success).toBe(true)
    expect((result.data?.images ?? [])[0].key).toBe('products/vase-1.jpg')
  })

  it('accepts externally-hosted image URLs', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      images: [{ key: 'https://picsum.photos/seed/vase/800/600.jpg' }],
    })
    expect(result.success).toBe(true)
  })

  it('limits images to 10 per product', () => {
    const images = Array.from({ length: 11 }, (_, i) => ({
      key: `products/vase-${i}.jpg`,
    }))
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      images,
    })
    expect(result.success).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/*                         createProduct with images                          */
/* -------------------------------------------------------------------------- */

describe('createProductInternal with images', () => {
  it('creates a product with images and preserves sort order', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      shopId: s.id,
      images: [
        { key: 'products/vase-front.jpg', altText: 'Front' },
        { key: 'products/vase-side.png', altText: 'Side' },
        { key: 'products/vase-back.webp', altText: 'Back' },
      ],
    })

    expect(result.name).toBe('Vase')

    const images = await db
      .select()
      .from(productImage)
      .where(eq(productImage.productId, result.id))
      .orderBy(productImage.sortOrder)

    expect(images).toHaveLength(3)
    expect(images[0].sortOrder).toBe(0)
    expect(images[0].altText).toBe('Front')
    expect(images[1].sortOrder).toBe(1)
    expect(images[1].altText).toBe('Side')
    expect(images[2].sortOrder).toBe(2)
    expect(images[2].altText).toBe('Back')
  })

  it('rejects invalid image key format during creation', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        stockCount: 10,
        shopId: s.id,
        images: [{ key: 'invalid-key.gif' }],
      }),
    ).rejects.toThrow('Invalid image key format')
  })
})

/* -------------------------------------------------------------------------- */
/*                         updateProduct with images                          */
/* -------------------------------------------------------------------------- */

describe('updateProductInternal with images', () => {
  it('replaces images on update and cleans up orphans', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    // Seed initial images
    await createProductImage(p, { url: 'products/old-1.jpg', altText: 'Old 1', sortOrder: 0 })
    await createProductImage(p, { url: 'products/old-2.jpg', altText: 'Old 2', sortOrder: 1 })

    await updateProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      images: [{ key: 'products/vase-new.jpg', altText: 'New Front' }],
    })

    const images = await db
      .select()
      .from(productImage)
      .where(eq(productImage.productId, p.id))
      .orderBy(productImage.sortOrder)

    expect(images).toHaveLength(1)
    expect(images[0].altText).toBe('New Front')
    expect(images[0].sortOrder).toBe(0)
  })

  it('preserves existing images when images field is omitted', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await createProductImage(p, { url: 'products/old-1.jpg', altText: 'Old 1', sortOrder: 0 })

    await updateProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      name: 'Updated Vase',
    })

    const images = await db.select().from(productImage).where(eq(productImage.productId, p.id))

    expect(images).toHaveLength(1)
    expect(images[0].altText).toBe('Old 1')
  })

  it('rejects invalid image key format during update', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await createProductImage(p, { url: 'products/old-1.jpg', altText: 'Old 1', sortOrder: 0 })

    await expect(
      updateProductInternal({
        productId: p.id,
        shopId: s.id,
        userId: u.id,
        name: 'Should Not Update',
        images: [{ key: 'invalid-key.gif' }],
      }),
    ).rejects.toThrow('Invalid image key format')

    // Product name should NOT have changed
    const [row] = await db.select().from(product).where(eq(product.id, p.id))
    expect(row.name).toBe('Vase')

    // Old images should still exist
    const images = await db.select().from(productImage).where(eq(productImage.productId, p.id))
    expect(images).toHaveLength(1)
    expect(images[0].altText).toBe('Old 1')
  })
})

/* -------------------------------------------------------------------------- */
/*                           deleteProduct with images                        */
/* -------------------------------------------------------------------------- */

describe('deleteProductInternal with images', () => {
  it('hard deletes product and removes images', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await createProductImage(p, { url: '/uploads/test.jpg', altText: 'Test', sortOrder: 0 })

    const result = await deleteProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      hard: true,
    })

    expect(result.deleted).toBe(true)
    expect(result.hard).toBe(true)

    const products = await db.select().from(product).where(eq(product.id, p.id))
    expect(products).toHaveLength(0)

    const images = await db.select().from(productImage).where(eq(productImage.productId, p.id))
    expect(images).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------- */
/*                           Description Sanitization                         */
/* -------------------------------------------------------------------------- */

describe('description sanitization', () => {
  it('escapes HTML tags in description on create', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      shopId: s.id,
      description: '<script>alert("xss")</script>',
    })

    expect(result.description).toBeNull()
  })

  it('escapes HTML tags in description on update', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    const result = await updateProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      description: '<img src=x onerror=alert(1)>',
    })

    expect(result.description).toBeNull()
  })

  it('handles null description', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      shopId: s.id,
    })

    expect(result.description).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*                           toggleProductActive                              */
/* -------------------------------------------------------------------------- */

describe('toggleProductActiveInternal', () => {
  it('toggles from active to inactive', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, {
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      isActive: true,
    })

    const result = await toggleProductActiveInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
    })

    expect(result.isActive).toBe(false)

    const [updated] = await db.select().from(product).where(eq(product.id, p.id)).limit(1)
    expect(updated.isActive).toBe(false)
  })

  it('toggles from inactive to active', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, {
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      isActive: false,
    })

    const result = await toggleProductActiveInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
    })

    expect(result.isActive).toBe(true)

    const [updated] = await db.select().from(product).where(eq(product.id, p.id)).limit(1)
    expect(updated.isActive).toBe(true)
  })

  it('throws NOT_FOUND for nonexistent product', async () => {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    await expect(
      toggleProductActiveInternal({
        productId: 'nonexistent',
        shopId: s.id,
        userId: u.id,
      }),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('throws FORBIDDEN when product does not belong to shop', async () => {
    const u = await createUser()
    const s1 = await createShop(u, { name: 'Test Shop 1', slug: 'test-shop-1' })
    const s2 = await createShop(u, { name: 'Test Shop 2', slug: 'test-shop-2' })
    const p = await createProduct(s1, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await expect(
      toggleProductActiveInternal({
        productId: p.id,
        shopId: s2.id,
        userId: u.id,
      }),
    ).rejects.toThrow('FORBIDDEN')
  })

  it('throws FORBIDDEN when user does not own the product shop', async () => {
    const u1 = await createUser()
    const u2 = await createUser()
    const s = await createShop(u1, { name: 'Test Shop', slug: 'test-shop' })
    const p = await createProduct(s, { name: 'Vase', slug: 'vase', priceCents: 2999 })

    await expect(
      toggleProductActiveInternal({
        productId: p.id,
        shopId: s.id,
        userId: u2.id,
      }),
    ).rejects.toThrow('FORBIDDEN')
  })
})

/* -------------------------------------------------------------------------- */
/*                      listCreatorProducts with search                        */
/* -------------------------------------------------------------------------- */

describe('listCreatorProductsInternal with search', () => {
  async function seedShopWithProducts() {
    const u = await createUser()
    const s = await createShop(u, { name: 'Test Shop', slug: 'test-shop' })

    const p1 = await createProduct(s, {
      name: 'Ceramic Vase',
      slug: 'ceramic-vase',
      priceCents: 2999,
      isActive: true,
    })

    const p2 = await createProduct(s, {
      name: 'Wooden Bowl',
      slug: 'wooden-bowl',
      priceCents: 1999,
      isActive: true,
    })

    const p3 = await createProduct(s, {
      name: 'Ceramic Plate',
      slug: 'ceramic-plate',
      priceCents: 1599,
      isActive: false,
    })

    return { u, s, p1, p2, p3 }
  }

  it('filters products by name search', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
      search: 'ceramic',
    })

    expect(result.products).toHaveLength(2)
    expect(result.products.map((p) => p.slug).sort()).toEqual(['ceramic-plate', 'ceramic-vase'])
  })

  it('returns empty when search matches nothing', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
      search: 'nonexistent',
    })

    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('combines search with active filter', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'true',
      search: 'ceramic',
    })

    expect(result.products).toHaveLength(1)
    expect(result.products[0].slug).toBe('ceramic-vase')
  })

  it('handles empty search string', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
      search: '',
    })

    expect(result.products).toHaveLength(3)
  })

  it('handles whitespace-only search', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
      search: '   ',
    })

    expect(result.products).toHaveLength(3)
  })

  it('returns thumbnail URL for products with images', async () => {
    const { s, p1, p2 } = await seedShopWithProducts()

    await createProductImage(p1, { url: '/uploads/vase.jpg', sortOrder: 0 })
    await createProductImage(p1, { url: '/uploads/vase-back.jpg', sortOrder: 1 })
    await createProductImage(p2, { url: '/uploads/bowl.jpg', sortOrder: 0 })

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 10,
      active: 'all',
    })

    const vase = result.products.find((p) => p.slug === 'ceramic-vase')
    expect(vase?.thumbnailUrl).toBe('/uploads/vase.jpg')

    const bowl = result.products.find((p) => p.slug === 'wooden-bowl')
    expect(bowl?.thumbnailUrl).toBe('/uploads/bowl.jpg')

    const plate = result.products.find((p) => p.slug === 'ceramic-plate')
    expect(plate?.thumbnailUrl).toBeNull()
  })

  it('paginates correctly with search', async () => {
    const { s } = await seedShopWithProducts()

    const result = await listCreatorProductsInternal({
      shopId: s.id,
      page: 1,
      pageSize: 1,
      active: 'all',
      search: 'ceramic',
    })

    expect(result.products).toHaveLength(1)
    expect(result.total).toBe(2)
    expect(result.totalPages).toBe(2)
  })
})
