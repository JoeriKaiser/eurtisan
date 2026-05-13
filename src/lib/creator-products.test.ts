import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { categories, product, productImage, shop, user } from '#/db/schema'

import {
  checkSlugUniqueness,
  createProductInternal,
  createProductSchema,
  deleteProductInternal,
  listCreatorProductsInternal,
  updateProductInternal,
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

beforeEach(async () => {
  await db.delete(productImage)
  await db.delete(product)
  await db.delete(categories)
  await db.delete(shop)
  await db.delete(user)
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
      stockCount: 10,
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input without optional fields', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade-vase',
      priceCents: 2999,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createProductSchema.safeParse({
      name: '',
      slug: 'handmade-vase',
      priceCents: 2999,
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 100 chars', () => {
    const result = createProductSchema.safeParse({
      name: 'a'.repeat(101),
      slug: 'handmade-vase',
      priceCents: 2999,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid slug', () => {
    const result = createProductSchema.safeParse({
      name: 'Handmade Vase',
      slug: 'handmade_vase!!!',
      priceCents: 2999,
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
      categoryId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
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
    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()
    expect(await validateCategory(cat.id)).toBe(true)
  })

  it('returns false for nonexistent category', async () => {
    expect(await validateCategory('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
  })
})

describe('checkSlugUniqueness', () => {
  it('returns true when slug is unique', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    expect(await checkSlugUniqueness('new-slug', s.id)).toBe(true)
  })

  it('returns false when slug exists in shop', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
    })

    expect(await checkSlugUniqueness('vase', s.id)).toBe(false)
  })

  it('returns true when excluding the same product', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
    })

    expect(await checkSlugUniqueness('vase', s.id, 'prod-1')).toBe(true)
  })
})

describe('verifyProductOwnership', () => {
  it('returns product when user owns the shop', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({ id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999, shopId: s.id })
      .returning()

    const result = await verifyProductOwnership(p.id, u.id)
    expect(result.id).toBe(p.id)
  })

  it('throws NOT_FOUND for nonexistent product', async () => {
    await expect(verifyProductOwnership('nonexistent', 'user-1')).rejects.toThrow('NOT_FOUND')
  })

  it('throws FORBIDDEN when user does not own the shop', async () => {
    const [u1] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [u2] = await db
      .insert(user)
      .values({ id: 'user-2', name: 'Test2', email: 'test2@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u1.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({ id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999, shopId: s.id })
      .returning()

    await expect(verifyProductOwnership(p.id, u2.id)).rejects.toThrow('FORBIDDEN')
  })
})

/* -------------------------------------------------------------------------- */
/*                            createProductInternal                           */
/* -------------------------------------------------------------------------- */

describe('createProductInternal', () => {
  it('creates a product successfully', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

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

  it('rejects duplicate slug within the same shop', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
    })

    await expect(
      createProductInternal({
        name: 'Another Vase',
        slug: 'vase',
        priceCents: 3999,
        shopId: s.id,
      }),
    ).rejects.toThrow('DUPLICATE_SLUG')
  })

  it('allows same slug in different shops', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s1] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop 1', slug: 'test-shop-1', ownerId: u.id })
      .returning()

    const [s2] = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Test Shop 2', slug: 'test-shop-2', ownerId: u.id })
      .returning()

    await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s1.id,
    })

    const result = await createProductInternal({
      name: 'Another Vase',
      slug: 'vase',
      priceCents: 3999,
      shopId: s2.id,
    })

    expect(result.slug).toBe('vase')
    expect(result.shopId).toBe(s2.id)
  })

  it('rejects invalid category_id', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

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

  it('rejects slug change to an existing slug', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await db.insert(product).values([
      { id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 2999, shopId: s.id },
      { id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 1999, shopId: s.id },
    ])

    await expect(
      updateProductInternal({
        productId: 'prod-1',
        shopId: s.id,
        userId: u.id,
        slug: 'bowl',
      }),
    ).rejects.toThrow('DUPLICATE_SLUG')
  })

  it('throws FORBIDDEN when product does not belong to shop', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s1] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop 1', slug: 'test-shop-1', ownerId: u.id })
      .returning()

    const [s2] = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Test Shop 2', slug: 'test-shop-2', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s1.id,
      })
      .returning()

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
    const [u1] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [u2] = await db
      .insert(user)
      .values({ id: 'user-2', name: 'Test2', email: 'test2@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u1.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        isActive: true,
      })
      .returning()

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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

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
    const [u1] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [u2] = await db
      .insert(user)
      .values({ id: 'user-2', name: 'Test2', email: 'test2@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u1.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [cat] = await db
      .insert(categories)
      .values({ name: 'Pottery', slug: 'pottery' })
      .returning()

    const [p1] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        categoryId: cat.id,
        isActive: true,
      })
      .returning()

    const [p2] = await db
      .insert(product)
      .values({
        id: 'prod-2',
        name: 'Bowl',
        slug: 'bowl',
        priceCents: 1999,
        shopId: s.id,
        categoryId: cat.id,
        isActive: false,
      })
      .returning()

    await db.insert(productImage).values([
      { id: 'img-1', productId: p1.id, url: 'http://example.com/1.jpg', sortOrder: 0 },
      { id: 'img-2', productId: p1.id, url: 'http://example.com/2.jpg', sortOrder: 1 },
    ])

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
/*                            Image Helpers                                   */
/* -------------------------------------------------------------------------- */

function makeJpegDataUrl(size = 100): string {
  // Minimal JPEG-ish byte sequence with valid magic bytes
  const header = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ])
  const padding = Buffer.alloc(size, 0x00)
  const footer = Buffer.from([0xff, 0xd9])
  const buffer = Buffer.concat([header, padding, footer])
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

function makePngDataUrl(size = 100): string {
  // Minimal PNG-ish byte sequence with valid magic bytes
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const padding = Buffer.alloc(size, 0x00)
  const footer = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
  const buffer = Buffer.concat([header, padding, footer])
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function makeWebpDataUrl(size = 100): string {
  // Minimal WebP-ish byte sequence with valid magic bytes
  const riff = Buffer.from([0x52, 0x49, 0x46, 0x46])
  const fileSize = Buffer.alloc(4)
  fileSize.writeUInt32LE(size + 12, 0)
  const webp = Buffer.from([0x57, 0x45, 0x42, 0x50])
  const padding = Buffer.alloc(size, 0x00)
  const buffer = Buffer.concat([riff, fileSize, webp, padding])
  return `data:image/webp;base64,${buffer.toString('base64')}`
}

function makeInvalidTypeDataUrl(): string {
  const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
  return `data:image/gif;base64,${buffer.toString('base64')}`
}

function makeOversizedDataUrl(): string {
  // 5MB + 1 byte JPEG-ish data
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
  const padding = Buffer.alloc(5 * 1024 * 1024 + 1, 0x00)
  const footer = Buffer.from([0xff, 0xd9])
  const buffer = Buffer.concat([header, padding, footer])
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

function makeMismatchedMagicBytesDataUrl(): string {
  // Claims to be JPEG but has PNG magic bytes
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  const padding = Buffer.alloc(100, 0x00)
  const buffer = Buffer.concat([header, padding])
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

function makeRiffNotWebpDataUrl(): string {
  // Valid RIFF header but not a WEBP file (WAVE instead)
  const riff = Buffer.from([0x52, 0x49, 0x46, 0x46])
  const fileSize = Buffer.alloc(4)
  fileSize.writeUInt32LE(100, 0)
  const wave = Buffer.from([0x57, 0x41, 0x56, 0x45]) // "WAVE"
  const padding = Buffer.alloc(92, 0x00)
  const buffer = Buffer.concat([riff, fileSize, wave, padding])
  return `data:image/webp;base64,${buffer.toString('base64')}`
}

/* -------------------------------------------------------------------------- */
/*                            Image Validation Tests                          */
/* -------------------------------------------------------------------------- */

describe('image validation', () => {
  it('accepts valid JPEG images', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      images: [{ dataUrl: makeJpegDataUrl(), altText: 'Front view' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid PNG images', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      images: [{ dataUrl: makePngDataUrl() }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid WebP images', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      images: [{ dataUrl: makeWebpDataUrl() }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid image type', () => {
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      images: [{ dataUrl: makeInvalidTypeDataUrl() }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects oversized images at runtime', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        images: [{ dataUrl: makeOversizedDataUrl() }],
      }),
    ).rejects.toThrow('File too large')
  })

  it('limits images to 10 per product', () => {
    const images = Array.from({ length: 11 }, () => ({ dataUrl: makeJpegDataUrl() }))
    const result = createProductSchema.safeParse({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      images,
    })
    expect(result.success).toBe(false)
  })

  it('rejects RIFF files that are not WebP', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        images: [{ dataUrl: makeRiffNotWebpDataUrl() }],
      }),
    ).rejects.toThrow('File content does not match declared type')
  })
})

/* -------------------------------------------------------------------------- */
/*                         createProduct with images                          */
/* -------------------------------------------------------------------------- */

describe('createProductInternal with images', () => {
  it('creates a product with images and preserves sort order', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      stockCount: 10,
      shopId: s.id,
      images: [
        { dataUrl: makeJpegDataUrl(), altText: 'Front' },
        { dataUrl: makePngDataUrl(), altText: 'Side' },
        { dataUrl: makeWebpDataUrl(), altText: 'Back' },
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

  it('rejects invalid image type during creation', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        images: [{ dataUrl: makeInvalidTypeDataUrl() }],
      }),
    ).rejects.toThrow('Invalid file type')
  })

  it('rejects oversized image during creation', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        images: [{ dataUrl: makeOversizedDataUrl() }],
      }),
    ).rejects.toThrow('File too large')
  })

  it('rolls back product creation when image processing fails', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await expect(
      createProductInternal({
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        images: [{ dataUrl: makeMismatchedMagicBytesDataUrl() }],
      }),
    ).rejects.toThrow('File content does not match declared type')

    // Product should NOT have been created
    const products = await db.select().from(product).where(eq(product.slug, 'vase'))
    expect(products).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------- */
/*                         updateProduct with images                          */
/* -------------------------------------------------------------------------- */

describe('updateProductInternal with images', () => {
  it('replaces images on update and cleans up orphans', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

    // Seed initial images
    await db.insert(productImage).values([
      { id: 'img-1', productId: p.id, url: '/old/1.jpg', altText: 'Old 1', sortOrder: 0 },
      { id: 'img-2', productId: p.id, url: '/old/2.jpg', altText: 'Old 2', sortOrder: 1 },
    ])

    await updateProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      images: [{ dataUrl: makeJpegDataUrl(), altText: 'New Front' }],
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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

    await db
      .insert(productImage)
      .values([{ id: 'img-1', productId: p.id, url: '/old/1.jpg', altText: 'Old 1', sortOrder: 0 }])

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

  it('rolls back product update when image replacement fails', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

    await db
      .insert(productImage)
      .values([{ id: 'img-1', productId: p.id, url: '/old/1.jpg', altText: 'Old 1', sortOrder: 0 }])

    await expect(
      updateProductInternal({
        productId: p.id,
        shopId: s.id,
        userId: u.id,
        name: 'Should Not Update',
        images: [{ dataUrl: makeMismatchedMagicBytesDataUrl() }],
      }),
    ).rejects.toThrow('File content does not match declared type')

    // Product name should NOT have changed
    const [row] = await db.select().from(product).where(eq(product.id, p.id))
    expect(row.name).toBe('Vase')

    // Old images should still exist (transaction rolled back before deletion)
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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

    await db
      .insert(productImage)
      .values([
        { id: 'img-1', productId: p.id, url: '/uploads/test.jpg', altText: 'Test', sortOrder: 0 },
      ])

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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
      description: '<script>alert("xss")</script>',
    })

    expect(result.description).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('escapes HTML tags in description on update', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

    const result = await updateProductInternal({
      productId: p.id,
      shopId: s.id,
      userId: u.id,
      description: '<img src=x onerror=alert(1)>',
    })

    expect(result.description).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('handles null description', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const result = await createProductInternal({
      name: 'Vase',
      slug: 'vase',
      priceCents: 2999,
      shopId: s.id,
    })

    expect(result.description).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*                           toggleProductActive                              */
/* -------------------------------------------------------------------------- */

import { toggleProductActiveInternal } from './creator-products.server'

describe('toggleProductActiveInternal', () => {
  it('toggles from active to inactive', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        isActive: true,
      })
      .returning()

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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        isActive: false,
      })
      .returning()

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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await expect(
      toggleProductActiveInternal({
        productId: 'nonexistent',
        shopId: s.id,
        userId: u.id,
      }),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('throws FORBIDDEN when product does not belong to shop', async () => {
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s1] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop 1', slug: 'test-shop-1', ownerId: u.id })
      .returning()

    const [s2] = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Test Shop 2', slug: 'test-shop-2', ownerId: u.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s1.id,
      })
      .returning()

    await expect(
      toggleProductActiveInternal({
        productId: p.id,
        shopId: s2.id,
        userId: u.id,
      }),
    ).rejects.toThrow('FORBIDDEN')
  })

  it('throws FORBIDDEN when user does not own the product shop', async () => {
    const [u1] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [u2] = await db
      .insert(user)
      .values({ id: 'user-2', name: 'Test2', email: 'test2@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u1.id })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
      })
      .returning()

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
    const [u] = await db
      .insert(user)
      .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: u.id })
      .returning()

    await db.insert(product).values([
      {
        id: 'prod-1',
        name: 'Ceramic Vase',
        slug: 'ceramic-vase',
        priceCents: 2999,
        shopId: s.id,
        isActive: true,
      },
      {
        id: 'prod-2',
        name: 'Wooden Bowl',
        slug: 'wooden-bowl',
        priceCents: 1999,
        shopId: s.id,
        isActive: true,
      },
      {
        id: 'prod-3',
        name: 'Ceramic Plate',
        slug: 'ceramic-plate',
        priceCents: 1599,
        shopId: s.id,
        isActive: false,
      },
    ])

    return { u, s }
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
    const { s } = await seedShopWithProducts()

    await db.insert(productImage).values([
      { id: 'img-1', productId: 'prod-1', url: '/uploads/vase.jpg', sortOrder: 0 },
      { id: 'img-2', productId: 'prod-1', url: '/uploads/vase-back.jpg', sortOrder: 1 },
      { id: 'img-3', productId: 'prod-2', url: '/uploads/bowl.jpg', sortOrder: 0 },
    ])

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
