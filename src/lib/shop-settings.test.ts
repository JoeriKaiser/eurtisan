import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { orderItem, platformOrder, product, shop, shopOrder, user } from '#/db/schema'

import {
  checkSlugUniquePlatformWide,
  ImageValidationError,
  SlugCollisionError,
  updateShopInternal,
  uploadShopImageInternal,
} from './shop-settings.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

async function cleanupUploadsDir() {
  const dir = join(process.cwd(), 'public', 'uploads', 'shops')
  try {
    await rm(dir, { recursive: true, force: true })
  } catch {
    // Directory may not exist
  }
}

beforeEach(async () => {
  await cleanupUploadsDir()
  await db.delete(orderItem)
  await db.delete(product)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

async function seedUser(
  overrides?: Partial<typeof user.$inferInsert>,
): Promise<typeof user.$inferSelect> {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Creator',
      email: 'creator@example.com',
      emailVerified: true,
      role: 'creator',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0] as typeof user.$inferSelect)
}

async function seedShop(
  overrides?: Partial<typeof shop.$inferInsert>,
): Promise<typeof shop.$inferSelect> {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0] as typeof shop.$inferSelect)
}

// A minimal valid 1×1 red PNG as a base64 data URL.
const RED_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

// An invalid base64 string that looks like an image but has bad magic bytes.
const BAD_MAGIC_DATA_URL =
  'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// A data URL that exceeds 5MB (simulated with a long base64 string).
function oversizedDataUrl(): string {
  // ~5.1MB worth of base64 padding
  const padding = 'A'.repeat(7 * 1024 * 1024)
  return `data:image/png;base64,${padding}`
}

/* -------------------------------------------------------------------------- */
/*                       checkSlugUniquePlatformWide                          */
/* -------------------------------------------------------------------------- */

describe('checkSlugUniquePlatformWide', () => {
  it('returns true when slug is not used', async () => {
    await seedUser()
    await seedShop({ slug: 'existing-shop' })
    const isUnique = await checkSlugUniquePlatformWide('new-shop')
    expect(isUnique).toBe(true)
  })

  it('returns false when slug is already in use', async () => {
    await seedUser()
    await seedShop({ slug: 'existing-shop' })
    const isUnique = await checkSlugUniquePlatformWide('existing-shop')
    expect(isUnique).toBe(false)
  })

  it('returns true when slug matches excluded shop', async () => {
    await seedUser()
    const s = await seedShop({ id: 'my-shop', slug: 'my-slug' })
    const isUnique = await checkSlugUniquePlatformWide('my-slug', s.id)
    expect(isUnique).toBe(true)
  })

  it('returns false when slug is used by a different shop', async () => {
    await seedUser()
    await seedShop({ id: 'shop-a', slug: 'collision' })
    const isUnique = await checkSlugUniquePlatformWide('collision', 'shop-b')
    expect(isUnique).toBe(false)
  })

  it('returns true when no shops exist', async () => {
    const isUnique = await checkSlugUniquePlatformWide('anything')
    expect(isUnique).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/*                              updateShopInternal                             */
/* -------------------------------------------------------------------------- */

describe('updateShopInternal', () => {
  it('updates the shop name', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, { name: 'New Name' })
    expect(updated.name).toBe('New Name')
    expect(updated.slug).toBe('test-shop')
  })

  it('updates the shop slug when unique', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, { slug: 'new-slug' })
    expect(updated.slug).toBe('new-slug')
  })

  it('updates the shop description', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, { description: 'A new description' })
    expect(updated.description).toBe('A new description')
  })

  it('sanitizes HTML in description', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      description: '<script>alert("xss")</script>',
    })
    expect(updated.description).toBeNull()
  })

  it('throws SlugCollisionError when slug is already in use by another shop', async () => {
    await seedUser()
    await seedShop({ id: 'shop-a', slug: 'taken' })
    const s = await seedShop({ id: 'shop-b', slug: 'mine' })
    await expect(updateShopInternal(s.id, { slug: 'taken' })).rejects.toThrow(SlugCollisionError)
  })

  it('does not throw when slug is unchanged', async () => {
    await seedUser()
    const s = await seedShop({ slug: 'my-slug' })
    const updated = await updateShopInternal(s.id, { slug: 'my-slug' })
    expect(updated.slug).toBe('my-slug')
  })

  it('updates multiple fields at once', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      name: 'Renamed Shop',
      slug: 'renamed-shop',
      description: 'Updated description.',
    })
    expect(updated.name).toBe('Renamed Shop')
    expect(updated.slug).toBe('renamed-shop')
    expect(updated.description).toBe('Updated description.')
  })

  it('throws when shop does not exist', async () => {
    await seedUser()
    await expect(updateShopInternal('nonexistent', { name: 'Nope' })).rejects.toThrow(
      'Shop not found.',
    )
  })

  it('throws when name is empty after trim', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { name: '   ' })).rejects.toThrow(
      'Shop name cannot be empty.',
    )
  })

  it('throws when slug is empty after trim', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { slug: '   ' })).rejects.toThrow(
      'Shop slug cannot be empty.',
    )
  })

  it('trims whitespace from name and slug', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      name: '  Trimmed Name  ',
      slug: '  trimmed-slug  ',
    })
    expect(updated.name).toBe('Trimmed Name')
    expect(updated.slug).toBe('trimmed-slug')
  })

  it('persists updatedAt change', async () => {
    await seedUser()
    const s = await seedShop()
    const before = new Date()
    const updated = await updateShopInternal(s.id, { name: 'Updated' })
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })
})

/* -------------------------------------------------------------------------- */
/*                           uploadShopImageInternal                          */
/* -------------------------------------------------------------------------- */

describe('uploadShopImageInternal', () => {
  it('uploads a valid PNG image and returns a URL', async () => {
    await seedUser()
    const s = await seedShop()
    const result = await uploadShopImageInternal(s.id, RED_PNG_DATA_URL)
    expect(result.url).toMatch(/^\/uploads\/shops\/shop-1\/[a-f0-9-]+\.png$/)
    // Verify the shop record was updated.
    const [shopRecord] = await db.select().from(shop).where(eq(shop.id, s.id)).limit(1)
    expect(shopRecord?.image).toBe(result.url)
  })

  it('replaces the old image when uploading a new one', async () => {
    await seedUser()
    const s = await seedShop()
    const first = await uploadShopImageInternal(s.id, RED_PNG_DATA_URL)
    const second = await uploadShopImageInternal(s.id, RED_PNG_DATA_URL)
    expect(second.url).not.toBe(first.url)
    // The shop record should point to the new URL.
    const [shopRecord] = await db.select().from(shop).where(eq(shop.id, s.id)).limit(1)
    expect(shopRecord?.image).toBe(second.url)
  })

  it('throws ImageValidationError for an unsupported MIME type', async () => {
    await seedUser()
    const s = await seedShop()
    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAACAkQBADs='
    await expect(uploadShopImageInternal(s.id, gifDataUrl)).rejects.toThrow(ImageValidationError)
  })

  it('throws ImageValidationError for a data URL with bad magic bytes', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(uploadShopImageInternal(s.id, BAD_MAGIC_DATA_URL)).rejects.toThrow(
      ImageValidationError,
    )
  })

  it('throws ImageValidationError for an oversized image', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(uploadShopImageInternal(s.id, oversizedDataUrl())).rejects.toThrow(
      ImageValidationError,
    )
  })

  it('throws ImageValidationError for an invalid data URL format', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(uploadShopImageInternal(s.id, 'not-a-data-url')).rejects.toThrow(
      ImageValidationError,
    )
  })

  it('throws when shop does not exist', async () => {
    await seedUser()
    await expect(uploadShopImageInternal('nonexistent', RED_PNG_DATA_URL)).rejects.toThrow(
      'Shop not found.',
    )
  })
})
