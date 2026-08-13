import { and, eq, ne } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop, type shopSocialPlatformEnum, shopSocials } from '#/db/schema'
import { logger } from '../logger.server'
import { sanitizeRichText, validatePlainText } from '../xss'
import { isPostgresUniqueViolation } from '../db-errors'
import { validateVatId } from '../vat'
import { validateSocialUrl } from './onboarding.server'
import { decryptJsonb, encryptJsonb } from '../encryption.server'
import type { TraderStatus } from './trader-status'

export { ImageValidationError } from '../image-utils'

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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  /** Optional business address for invoices and legal disclosures. */
  businessAddress?: BusinessAddress | null
  /** Whether the shop is registered for VAT. */
  isVatRegistered?: boolean
  /** VAT identification number (required when isVatRegistered is true). */
  vatId?: string | null
  /** Legal form of the seller: individual or business (DAC7 tax identity). */
  legalEntityType?: 'individual' | 'business' | null
  /** Seller-declared status under CRD Article 6a; independent of DAC7 identity. */
  traderStatus?: TraderStatus
  /** Seller date of birth in YYYY-MM-DD format (individual sellers, DAC7). */
  dateOfBirth?: string | null
  /** Tax identification number (DAC7). */
  taxId?: string | null
  /** Business registration number (business sellers, DAC7). */
  businessRegistrationNumber?: string | null
  /** Shop icon image key (S3 object key). */
  image?: string | null
  /** Shop banner image key (S3 object key). */
  bannerImage?: string | null
  /** Optional public announcement shown on the shop page. */
  announcement?: string | null
  /** Optional shop policies (returns, exchanges, custom orders, etc.). */
  policies?: Policies | null
  /** Optional social links to display on the shop page. */
  socials?: SocialRow[]
}

export interface BusinessAddress {
  street: string
  city: string
  postalCode: string
  country: string
}

export interface Policies {
  returns: {
    accepted: boolean
    windowDays?: number
    conditions?: string
  }
  exchanges: {
    accepted: boolean
    conditions?: string
  }
  customOrders: {
    accepted: boolean
    details?: string
  }
  paymentMethods: string[]
  additionalInfo?: string
}

export interface SocialRow {
  platform: string
  url: string
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
    if (input.shippingOrigin === null) {
      updateData.shippingOrigin = null
    } else {
      const storedOrigin = decryptJsonb<unknown>(shopRecord.shippingOrigin)
      const shippingOrigin = isObjectRecord(storedOrigin)
        ? {
            ...storedOrigin,
            street: input.shippingOrigin.street,
            city: input.shippingOrigin.city,
            postalCode: input.shippingOrigin.postalCode,
            country: input.shippingOrigin.country,
          }
        : input.shippingOrigin

      updateData.shippingOrigin = encryptJsonb(shippingOrigin)
    }
  }

  if (input.businessAddress !== undefined) {
    updateData.businessAddress = encryptJsonb(input.businessAddress)
  }

  if (input.isVatRegistered !== undefined) {
    updateData.isVatRegistered = input.isVatRegistered
  }

  if (input.vatId !== undefined) {
    updateData.vatId = input.vatId ? input.vatId.trim() : null
  }

  if (input.legalEntityType !== undefined) {
    updateData.legalEntityType = input.legalEntityType
  }

  if (input.traderStatus !== undefined) {
    updateData.traderStatus = input.traderStatus
  }

  if (input.dateOfBirth !== undefined) {
    updateData.dateOfBirth = input.dateOfBirth ? input.dateOfBirth.trim() : null
  }

  if (input.taxId !== undefined) {
    updateData.taxId = input.taxId ? input.taxId.trim() : null
  }

  if (input.businessRegistrationNumber !== undefined) {
    updateData.businessRegistrationNumber = input.businessRegistrationNumber
      ? input.businessRegistrationNumber.trim()
      : null
  }

  if (input.image !== undefined) {
    updateData.image = input.image
  }

  if (input.bannerImage !== undefined) {
    updateData.bannerImage = input.bannerImage
  }

  if (input.announcement !== undefined) {
    updateData.announcement = input.announcement ? input.announcement.trim() : null
  }

  if (input.policies !== undefined) {
    updateData.policies = input.policies
  }

  // Social links are maintained in a separate table.
  if (input.socials !== undefined) {
    await db.delete(shopSocials).where(eq(shopSocials.shopId, shopId))
    if (input.socials.length > 0) {
      const validatedSocials = input.socials.map((s, index) => ({
        id: crypto.randomUUID(),
        shopId,
        platform: String(s.platform) as (typeof shopSocialPlatformEnum.enumValues)[number],
        url: validateSocialUrl(s.url, `Social URL #${index + 1}`),
      }))
      await db.insert(shopSocials).values(validatedSocials)
    }
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

  // DAC7 tax identity validation.
  const effectiveLegalEntityType =
    input.legalEntityType !== undefined ? input.legalEntityType : shopRecord.legalEntityType
  const effectiveTaxId =
    input.taxId !== undefined
      ? input.taxId
        ? input.taxId.trim()
        : null
      : (shopRecord.taxId ?? null)
  const effectiveDateOfBirth =
    input.dateOfBirth !== undefined
      ? input.dateOfBirth
        ? input.dateOfBirth.trim()
        : null
      : (shopRecord.dateOfBirth ?? null)
  const effectiveBusinessReg =
    input.businessRegistrationNumber !== undefined
      ? input.businessRegistrationNumber
        ? input.businessRegistrationNumber.trim()
        : null
      : (shopRecord.businessRegistrationNumber ?? null)

  if (effectiveTaxId && !/^[A-Za-z0-9-]{3,30}$/.test(effectiveTaxId)) {
    throw new Error('Tax ID must be 3–30 alphanumeric characters.')
  }

  if (effectiveLegalEntityType === 'individual') {
    if (!effectiveDateOfBirth) {
      throw new Error('Date of birth is required for individual sellers.')
    }
  } else if (effectiveLegalEntityType === 'business') {
    if (!effectiveBusinessReg) {
      throw new Error('Business registration number is required for business sellers.')
    }
  }

  try {
    const [updated] = await db.update(shop).set(updateData).where(eq(shop.id, shopId)).returning()
    return updated
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'shop_slug_unique')) {
      const slug =
        typeof updateData.slug === 'string' ? updateData.slug : (input.slug ?? shopRecord.slug)
      throw new SlugCollisionError(String(slug))
    }
    throw err
  }
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
    const { deleteImageFromStorage, extractKeyFromUrl } = await import('../image-storage.server')
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
