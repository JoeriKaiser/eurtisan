import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop } from '#/db/schema'
import { getExtensionFromMimeType, sanitizeDescription, validateImageInput } from './image-utils'

export { ImageValidationError } from './image-utils'

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'shops')

/* -------------------------------------------------------------------------- */
/*                                   Errors                                   */
/* -------------------------------------------------------------------------- */

export class SlugCollisionError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is already in use by another shop.`)
    this.name = 'SlugCollisionError'
  }
}

/* -------------------------------------------------------------------------- */
/*                               Slug Validation                              */
/* -------------------------------------------------------------------------- */

/**
 * Checks whether a slug is unique across all shops (platform-wide).
 * When `excludeShopId` is provided, that shop's slug is ignored (for updates).
 */
export async function checkSlugUniquePlatformWide(
  slug: string,
  excludeShopId?: string,
): Promise<boolean> {
  const conditions = [eq(shop.slug, slug)]
  if (excludeShopId) {
    conditions.push(ne(shop.id, excludeShopId))
  }

  const existing = await db
    .select({ id: shop.id })
    .from(shop)
    .where(and(...conditions))
    .limit(1)
  return existing.length === 0
}

/* -------------------------------------------------------------------------- */
/*                               Internal Logic                               */
/* -------------------------------------------------------------------------- */

export interface ShippingOrigin {
  street: string
  city: string
  postalCode: string
  country: string
}

export type UpdateShopInput = {
  /** Shop display name (1–255 characters). */
  name?: string
  /** URL-safe slug (lowercase letters, numbers, hyphens). Must be platform-unique. */
  slug?: string
  /** Optional shop description. */
  description?: string
  /** Optional shipping origin address for label generation. */
  shippingOrigin?: ShippingOrigin | null
}

export type ShopRecord = typeof shop.$inferSelect

/**
 * Updates a shop's name, slug, and/or description.
 *
 * - Validates slug uniqueness platform-wide when the slug is changed.
 * - Throws SlugCollisionError if the new slug is already in use.
 * - Only updates fields that are provided.
 * - Automatically sanitizes the description.
 * - Caller is responsible for ownership authorization.
 */
export async function updateShopInternal(
  shopId: string,
  input: UpdateShopInput,
): Promise<ShopRecord> {
  // Verify the shop exists.
  const [shopRecord] = await db.select().from(shop).where(eq(shop.id, shopId)).limit(1)

  if (!shopRecord) {
    throw new Error('Shop not found.')
  }

  // Slug uniqueness check — platform-wide, excluding the current shop.
  if (input.slug !== undefined && input.slug !== shopRecord.slug) {
    const trimmedSlug = input.slug.trim()
    const isUnique = await checkSlugUniquePlatformWide(trimmedSlug, shopId)
    if (!isUnique) {
      throw new SlugCollisionError(trimmedSlug)
    }
  }

  // Build update payload with only provided fields.
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) {
    const trimmed = input.name.trim()
    if (trimmed.length === 0) {
      throw new Error('Shop name cannot be empty.')
    }
    updateData.name = trimmed
  }

  if (input.slug !== undefined) {
    const trimmed = input.slug.trim()
    if (trimmed.length === 0) {
      throw new Error('Shop slug cannot be empty.')
    }
    updateData.slug = trimmed
  }

  if (input.description !== undefined) {
    updateData.description = sanitizeDescription(input.description)
  }

  if (input.shippingOrigin !== undefined) {
    updateData.shippingOrigin = input.shippingOrigin
  }

  const [updated] = await db.update(shop).set(updateData).where(eq(shop.id, shopId)).returning()

  return updated
}

/**
 * Uploads a shop image, validates it, stores it on disk, and updates the shop record.
 *
 * - Accepts a base64 data URL.
 * - Delegates image validation to `validateImageInput` from `image-utils.ts`
 *   (MIME type, file size ≤5MB, magic bytes).
 * - Saves to `public/uploads/shops/<shopId>/`.
 * - Updates `shop.image` with the public URL.
 * - If the shop already had an image, the old file is deleted.
 * - Returns the public URL of the uploaded image.
 * - Caller is responsible for ownership authorization.
 */
export async function uploadShopImageInternal(
  shopId: string,
  dataUrl: string,
): Promise<{ url: string }> {
  // Verify the shop exists.
  const [shopRecord] = await db
    .select({ id: shop.id, image: shop.image })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!shopRecord) {
    throw new Error('Shop not found.')
  }

  // Validate the image payload using the shared validator from image-utils.
  const { buffer, mimeType } = validateImageInput({ dataUrl })

  // Save to disk.
  const shopDir = join(UPLOAD_DIR, shopId)
  await mkdir(shopDir, { recursive: true })

  const ext = getExtensionFromMimeType(mimeType)
  const filename = `${crypto.randomUUID()}.${ext}`
  const filepath = join(shopDir, filename)
  const url = `/uploads/shops/${shopId}/${filename}`

  await writeFile(filepath, buffer)

  // Delete the old image file if one existed.
  if (shopRecord.image) {
    const oldPath = join(process.cwd(), 'public', shopRecord.image)
    try {
      await rm(oldPath, { force: true })
    } catch {
      // Old file may not exist; ignore.
    }
  }

  // Update the shop record.
  await db.update(shop).set({ image: url, updatedAt: new Date() }).where(eq(shop.id, shopId))

  return { url }
}
