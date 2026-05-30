import { and, eq, ne } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop } from '#/db/schema'
import { logger } from './logger.server'
import { sanitizeRichText, validatePlainText } from './xss'
import { validateVatId } from './vat'

export { ImageValidationError } from './image-utils'

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

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
  /** Whether the shop is registered for VAT. */
  isVatRegistered?: boolean
  /** VAT identification number (required when isVatRegistered is true). */
  vatId?: string | null
  /** Shop icon image key (S3 object key). */
  image?: string | null
  /** Shop banner image key (S3 object key). */
  bannerImage?: string | null
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
    const validated = validatePlainText(input.name, 'Shop name')
    if (validated.length === 0) {
      throw new Error('Shop name cannot be empty.')
    }
    updateData.name = validated
  }

  if (input.slug !== undefined) {
    const trimmed = input.slug.trim()
    if (trimmed.length === 0) {
      throw new Error('Shop slug cannot be empty.')
    }
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      throw new Error('Slug must be URL-safe: lowercase letters, numbers, and hyphens only.')
    }
    updateData.slug = trimmed
  }

  if (input.description !== undefined) {
    updateData.description = sanitizeRichText(input.description)
  }

  if (input.shippingOrigin !== undefined) {
    updateData.shippingOrigin = input.shippingOrigin
  }

  if (input.isVatRegistered !== undefined) {
    updateData.isVatRegistered = input.isVatRegistered
  }

  if (input.vatId !== undefined) {
    updateData.vatId = input.vatId ? input.vatId.trim() : null
  }

  if (input.image !== undefined) {
    updateData.image = input.image
  }

  if (input.bannerImage !== undefined) {
    updateData.bannerImage = input.bannerImage
  }

  // VAT validation: when VAT registered, a valid VAT ID is required.
  const effectiveIsVatRegistered =
    input.isVatRegistered !== undefined ? input.isVatRegistered : shopRecord.isVatRegistered
  if (effectiveIsVatRegistered) {
    const effectiveVatId =
      input.vatId !== undefined ? (input.vatId ? input.vatId.trim() : null) : shopRecord.vatId
    if (!effectiveVatId) {
      throw new Error('VAT ID is required when VAT registered.')
    }
    const validation = validateVatId(effectiveVatId)
    if (!validation.valid) {
      throw new Error(validation.message ?? 'Invalid VAT ID format.')
    }
  }

  const [updated] = await db.update(shop).set(updateData).where(eq(shop.id, shopId)).returning()

  return updated
}

/**
 * Updates a shop's image reference and cleans up the old image from S3.
 *
 * - Accepts an S3 object key (the client uploads directly to S3).
 * - Updates `shop.image` with the new key.
 * - Deletes the old image from S3 if one existed.
 * - Returns the new image key.
 * - Caller is responsible for ownership authorization.
 */
export async function uploadShopImageInternal(
  shopId: string,
  key: string,
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

  // Delete the old image from S3 if one existed.
  if (shopRecord.image) {
    const { deleteImageFromStorage, extractKeyFromUrl } = await import('./image-storage.server')
    const oldKey = extractKeyFromUrl(shopRecord.image)
    if (oldKey) {
      try {
        await deleteImageFromStorage(oldKey)
      } catch (err) {
        logger.error(`Failed to delete old shop image from S3: ${oldKey}`, err)
      }
    }
  }

  // Update the shop record.
  await db.update(shop).set({ image: key, updatedAt: new Date() }).where(eq(shop.id, shopId))

  return { url: key }
}
