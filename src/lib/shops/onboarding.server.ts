import { and, asc, count, eq, ilike, ne, sql } from 'drizzle-orm'
import z from 'zod'
import { db } from '#/db/index'
import {
  product,
  productImage,
  shop,
  shopSocials,
  type shopSocialPlatformEnum,
  type shopStatusEnum,
  user,
} from '#/db/schema'
import { SELLER_TERMS_VERSION } from '../sell-onboarding'
import type {
  BusinessAddressData,
  PoliciesData,
  ShippingOriginData,
  ShopDraft,
  Step7Listing,
} from '../sell-onboarding'
import { sanitizeRichText, validatePlainText } from '../xss'
import { decryptJsonb, encryptJsonb } from '../encryption.server'
import { SUPPORTED_CURRENCY } from '../currency'
import { logger } from '../logger.server'

const PROFANITY_LIST = new Set(['shit', 'fuck', 'damn', 'bitch', 'asshole', 'cunt', 'dick', 'piss'])

const DANGEROUS_SCHEMES = ['javascript:', 'vbscript:', 'data:']

function hasDangerousScheme(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return DANGEROUS_SCHEMES.some((scheme) => lower.startsWith(scheme))
}

function isAllowedImageUrl(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return (
    /^(?:shops|products)\/[a-f0-9-]{36}\.(?:jpe?g|png|webp)$/.test(lower) ||
    lower.startsWith('/uploads/') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://')
  )
}

export function validateImageUrl(value: unknown, fieldName = 'Image URL'): string | null {
  if (value === null || value === undefined || value === '') return null
  const str = String(value).trim()
  if (hasDangerousScheme(str) || !isAllowedImageUrl(str)) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `${fieldName} must be a valid image URL.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return str
}

export function validateSocialUrl(value: unknown, fieldName = 'Social URL'): string {
  const str = value === null || value === undefined ? '' : String(value).trim()
  if (hasDangerousScheme(str)) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `${fieldName} contains an unsafe URL scheme.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const parsed = z.string().url().safeParse(str)
  if (!parsed.success) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `${fieldName} must be a valid URL.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return parsed.data
}

function checkProfanity(text: string): boolean {
  const lower = text.toLowerCase()
  // Intentionally sequential: substring matching requires iterating all patterns.
  for (const word of PROFANITY_LIST) {
    if (lower.indexOf(word) !== -1) return true
  }
  return false
}

export async function verifyShopOwnershipOrAdmin(shopId: string, userId: string, userRole: string) {
  const shopRecord = await db.query.shop.findFirst({
    where: eq(shop.id, shopId),
  })
  if (!shopRecord) throw new Error('NOT_FOUND')
  if (userRole !== 'admin' && shopRecord.ownerId !== userId) throw new Error('FORBIDDEN')
  return shopRecord
}

export async function getShopDraftQuery(
  draftId: string,
  userId: string,
  userRole: string,
): Promise<ShopDraft> {
  const [record, socials] = await Promise.all([
    verifyShopOwnershipOrAdmin(draftId, userId, userRole),
    db.select().from(shopSocials).where(eq(shopSocials.shopId, draftId)),
  ])

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    tagline: record.tagline,
    description: record.description,
    category: record.category,
    tags: record.tags ?? [],
    image: record.image,
    bannerImage: record.bannerImage,
    productionType: record.productionType,
    hasProductionPartner: record.hasProductionPartner,
    productionPartnerDetails: record.productionPartnerDetails,
    languages: record.languages ?? [],
    shippingOrigin: decryptJsonb<ShippingOriginData | null>(record.shippingOrigin) ?? null,
    businessAddress: decryptJsonb<BusinessAddressData | null>(record.businessAddress) ?? null,
    currency: record.currency,
    isVatRegistered: record.isVatRegistered,
    vatId: record.vatId,
    legalEntityType: record.legalEntityType,
    dateOfBirth: record.dateOfBirth,
    taxId: record.taxId,
    businessRegistrationNumber: record.businessRegistrationNumber,
    policies: (record.policies as PoliciesData | null) ?? null,
    announcement: record.announcement,
    status: record.status,
    onboardingStep: record.onboardingStep,
    onboardingCompletedAt: record.onboardingCompletedAt,
    onboardingListingId: record.onboardingListingId,
    sellerTermsAcceptedAt: record.sellerTermsAcceptedAt,
    sellerTermsVersion: record.sellerTermsVersion,
    isSuspended: record.isSuspended,
    moderationNote: record.moderationNote,
    moderationStage: record.moderationStage,
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewedAt,
    reviewedBy: record.reviewedBy,
    resubmissionCount: record.resubmissionCount,
    mollieAccountId: record.mollieAccountId,
    paymentConnected: record.paymentConnected,
    paymentConnectedAt: record.paymentConnectedAt,
    ownerId: record.ownerId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    socials,
  }
}

const MAX_DRAFT_SHOPS = 10

export async function createShopDraftInternal(user: { id: string; role: string }) {
  const [draftCount] = await db
    .select({ count: count(shop.id) })
    .from(shop)
    .where(and(eq(shop.ownerId, user.id), eq(shop.status, 'draft')))

  if (draftCount && Number(draftCount.count) >= MAX_DRAFT_SHOPS) {
    throw new Response(
      JSON.stringify({
        error: 'Too Many Drafts',
        message: `You can only have up to ${MAX_DRAFT_SHOPS} draft shops. Please complete or delete an existing draft before creating a new one.`,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const id = crypto.randomUUID()
  await db.insert(shop).values({
    id,
    name: '',
    slug: `draft-${id}`,
    ownerId: user.id,
    status: 'draft',
    onboardingStep: 1,
    currency: SUPPORTED_CURRENCY,
  })

  return { id }
}

export async function saveOnboardingStepInternal(
  userId: string,
  userRole: string,
  payload: { draftId: string; step: number; data: Record<string, unknown> },
) {
  const record = await verifyShopOwnershipOrAdmin(payload.draftId, userId, userRole)

  if (record.status !== 'draft' && record.status !== 'changes_requested') {
    throw new Error('FORBIDDEN')
  }

  if (payload.step < 1 || payload.step > 5) {
    throw new Error('INVALID_ONBOARDING_STEP')
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    onboardingStep: Math.max(Math.min(record.onboardingStep, 5), Math.min(payload.step + 1, 5)),
  }

  const d = payload.data

  if (d.name !== undefined) updateData.name = validatePlainText(String(d.name), 'Shop name')
  if (d.slug !== undefined) {
    const normalizedSlug = String(d.slug).trim()
    const availability = await checkSlugAvailabilityInternal(normalizedSlug, payload.draftId)
    if (!availability.available) throw new Error('SLUG_TAKEN')
    updateData.slug = normalizedSlug
  }
  if (d.tagline !== undefined) updateData.tagline = d.tagline ? String(d.tagline) : null
  if (d.description !== undefined)
    updateData.description = d.description ? sanitizeRichText(String(d.description)) : null
  if (d.category !== undefined) updateData.category = d.category ? String(d.category) : null
  if (d.productionType !== undefined)
    updateData.productionType = d.productionType ? String(d.productionType) : null
  if (d.tags !== undefined) updateData.tags = Array.isArray(d.tags) ? d.tags : []
  if (d.languages !== undefined)
    updateData.languages = Array.isArray(d.languages) ? d.languages : []
  if (d.hasProductionPartner !== undefined)
    updateData.hasProductionPartner = Boolean(d.hasProductionPartner)
  if (d.productionPartnerDetails !== undefined)
    updateData.productionPartnerDetails = d.productionPartnerDetails
      ? String(d.productionPartnerDetails)
      : null
  if (d.image !== undefined) updateData.image = validateImageUrl(d.image, 'Shop image')
  if (d.bannerImage !== undefined)
    updateData.bannerImage = validateImageUrl(d.bannerImage, 'Shop banner image')
  if (d.shippingOrigin !== undefined) updateData.shippingOrigin = encryptJsonb(d.shippingOrigin)
  if (d.businessAddress !== undefined) updateData.businessAddress = encryptJsonb(d.businessAddress)
  if (d.currency !== undefined) updateData.currency = SUPPORTED_CURRENCY
  if (d.isVatRegistered !== undefined) updateData.isVatRegistered = Boolean(d.isVatRegistered)
  if (d.vatId !== undefined) updateData.vatId = d.vatId ? String(d.vatId).trim() : null
  if (d.legalEntityType !== undefined)
    updateData.legalEntityType = d.legalEntityType ? String(d.legalEntityType) : null
  if (d.dateOfBirth !== undefined)
    updateData.dateOfBirth = d.dateOfBirth ? String(d.dateOfBirth).trim() : null
  if (d.taxId !== undefined) updateData.taxId = d.taxId ? String(d.taxId).trim() : null
  if (d.businessRegistrationNumber !== undefined)
    updateData.businessRegistrationNumber = d.businessRegistrationNumber
      ? String(d.businessRegistrationNumber).trim()
      : null
  if (d.policies !== undefined) updateData.policies = d.policies
  if (d.announcement !== undefined)
    updateData.announcement = d.announcement ? String(d.announcement) : null
  if (d.productId !== undefined) updateData.onboardingListingId = String(d.productId)
  if (d.termsAgreed === true && d.termsVersion) {
    updateData.sellerTermsAcceptedAt = new Date()
    updateData.sellerTermsVersion = String(d.termsVersion)
  }

  await db.update(shop).set(updateData).where(eq(shop.id, payload.draftId))

  if (d.socials !== undefined && Array.isArray(d.socials)) {
    await db.delete(shopSocials).where(eq(shopSocials.shopId, payload.draftId))
    const socialRows = d.socials as Array<{ platform: string; url: string }>
    if (socialRows.length > 0) {
      const validatedSocials = socialRows.map((s, index) => ({
        id: crypto.randomUUID(),
        shopId: payload.draftId,
        platform: String(s.platform) as (typeof shopSocialPlatformEnum.enumValues)[number],
        url: validateSocialUrl(s.url, `Social URL #${index + 1}`),
      }))
      await db.insert(shopSocials).values(validatedSocials)
    }
  }

  return { success: true }
}

export async function checkSlugAvailabilityInternal(slug: string, excludeShopId?: string) {
  const conditions = [eq(shop.slug, slug)]
  if (excludeShopId) {
    conditions.push(ne(shop.id, excludeShopId))
  }
  const existing = await db
    .select({ id: shop.id })
    .from(shop)
    .where(and(...conditions))
    .limit(1)
  return { available: existing.length === 0 }
}

export async function checkShopNameInternal(name: string, excludeShopId?: string) {
  const profanity = checkProfanity(name)

  const conditions = [ilike(shop.name, name)]
  if (excludeShopId) {
    conditions.push(ne(shop.id, excludeShopId))
  }
  const similar = await db
    .select({ id: shop.id })
    .from(shop)
    .where(and(...conditions))
    .limit(1)

  return {
    profanity,
    similarExists: similar.length > 0,
  }
}

export async function saveDraftListingInternal(
  actor: { id: string; name: string; role: string },
  data: Step7Listing & { draftId: string; slug: string },
) {
  const record = await verifyShopOwnershipOrAdmin(data.draftId, actor.id, actor.role)
  if (record.status !== 'draft' && record.status !== 'changes_requested') {
    throw new Error('FORBIDDEN')
  }

  const { createProductInternal, updateProductInternal } = await import(
    '../creator-products.server'
  )
  const productId = data.productId ?? record.onboardingListingId
  const productData = {
    name: data.name,
    description: data.description,
    slug: data.slug,
    priceCents: data.priceCents,
    stockCount: data.stockCount,
    categoryId: data.categoryId,
    vatRateCategory: data.vatRateCategory,
    weightGrams: data.weightGrams,
    lengthCm: data.lengthCm,
    widthCm: data.widthCm,
    heightCm: data.heightCm,
    images: data.images,
  }

  const saved = productId
    ? await updateProductInternal(
        {
          productId,
          shopId: data.draftId,
          userId: actor.id,
          ...productData,
          status: 'draft',
          isActive: false,
        },
        { id: actor.id, name: actor.name },
      )
    : await createProductInternal(
        {
          shopId: data.draftId,
          ...productData,
          status: 'draft',
          isActive: false,
        },
        { id: actor.id, name: actor.name },
      )

  await db
    .update(shop)
    .set({
      onboardingListingId: saved.id,
      onboardingStep: Math.max(Math.min(record.onboardingStep, 5), 4),
      updatedAt: new Date(),
    })
    .where(eq(shop.id, data.draftId))

  return saved
}

export async function getOnboardingListingInternal(shopId: string) {
  const [record] = await db
    .select({ onboardingListingId: shop.onboardingListingId })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)
  if (!record?.onboardingListingId) return null

  const [listing, images] = await Promise.all([
    db.query.product.findFirst({ where: eq(product.id, record.onboardingListingId) }),
    db
      .select({
        key: productImage.url,
        altText: productImage.altText,
        sortOrder: productImage.sortOrder,
      })
      .from(productImage)
      .where(eq(productImage.productId, record.onboardingListingId))
      .orderBy(asc(productImage.sortOrder)),
  ])
  if (!listing) return null
  return { ...listing, images }
}

export interface OnboardingReadinessItem {
  id: 'profile' | 'seller' | 'product' | 'delivery'
  path: 'identity' | 'location' | 'listing' | 'policies'
  complete: boolean
}

export async function getOnboardingReadinessInternal(shopId: string) {
  const [record, listing] = await Promise.all([
    db.query.shop.findFirst({ where: eq(shop.id, shopId) }),
    getOnboardingListingInternal(shopId),
  ])
  if (!record) throw new Error('NOT_FOUND')

  const origin = decryptJsonb<ShippingOriginData | null>(record.shippingOrigin)
  const address = decryptJsonb<BusinessAddressData | null>(record.businessAddress)
  const policies = record.policies as PoliciesData | null
  const isProfileComplete = Boolean(
    record.name.trim().length >= 4 &&
      !record.slug.startsWith('draft-') &&
      record.category &&
      record.productionType &&
      record.productionType !== 'digital' &&
      record.description &&
      record.description.length >= 50 &&
      record.image,
  )
  const hasValidIdentity =
    Boolean(record.taxId) &&
    (record.legalEntityType === 'individual'
      ? Boolean(record.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(record.dateOfBirth))
      : Boolean(record.businessRegistrationNumber))
  const isSellerComplete = Boolean(
    origin?.country &&
      origin.city &&
      origin.postalCode &&
      address?.street &&
      address.city &&
      address.postalCode &&
      address.country &&
      hasValidIdentity,
  )
  const isProductComplete = Boolean(
    listing &&
      listing.name.length >= 5 &&
      listing.description &&
      listing.description.length >= 20 &&
      listing.priceCents >= 50 &&
      listing.stockCount >= 1 &&
      listing.categoryId &&
      listing.weightGrams &&
      listing.lengthCm &&
      listing.widthCm &&
      listing.heightCm &&
      listing.images.length > 0,
  )
  const isDeliveryComplete = Boolean(
    origin?.processingTimeDays?.min &&
      origin.processingTimeDays.max &&
      origin.processingTimeDays.min <= origin.processingTimeDays.max &&
      policies?.mandatoryRightsAcknowledged,
  )
  const items: OnboardingReadinessItem[] = [
    { id: 'profile', path: 'identity', complete: isProfileComplete },
    { id: 'seller', path: 'location', complete: isSellerComplete },
    { id: 'product', path: 'listing', complete: isProductComplete },
    { id: 'delivery', path: 'policies', complete: isDeliveryComplete },
  ]

  return {
    ready: items.every((item) => item.complete),
    items,
    listing,
  }
}

export async function deleteShopDraftInternal(userId: string, shopId: string) {
  const record = await verifyShopOwnershipOrAdmin(shopId, userId, 'customer')
  if (record.status !== 'draft' && record.status !== 'changes_requested') {
    throw new Error('FORBIDDEN')
  }
  await db.delete(shop).where(eq(shop.id, shopId))
  return { success: true as const }
}

export async function getSellerShopsInternal(userId: string) {
  const shops = await db
    .select({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      image: shop.image,
      status: shop.status,
      onboardingStep: shop.onboardingStep,
      moderationNote: shop.moderationNote,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
      productCount: count(product.id),
    })
    .from(shop)
    .leftJoin(product, eq(product.shopId, shop.id))
    .where(eq(shop.ownerId, userId))
    .groupBy(shop.id)
    .orderBy(shop.createdAt)

  return shops.map((s) => ({
    ...s,
    productCount: Number(s.productCount),
  }))
}

export async function submitShopForReviewInternal(
  userId: string,
  userRole: string,
  draftId: string,
  terms: { termsAgreed: true; termsVersion: typeof SELLER_TERMS_VERSION },
) {
  const record = await verifyShopOwnershipOrAdmin(draftId, userId, userRole)

  if (record.status !== 'draft' && record.status !== 'changes_requested') {
    throw new Error('FORBIDDEN')
  }
  if (!terms.termsAgreed || terms.termsVersion !== SELLER_TERMS_VERSION) {
    throw new Error('SELLER_TERMS_REQUIRED')
  }

  const readiness = await getOnboardingReadinessInternal(draftId)
  const incomplete = readiness.items.filter((item) => !item.complete).map((item) => item.id)
  if (incomplete.length > 0) {
    throw new Error(`INCOMPLETE_ONBOARDING:${incomplete.join(',')}`)
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(shop)
      .set({
        status: 'pending_review',
        onboardingStep: 5,
        onboardingCompletedAt: now,
        sellerTermsAcceptedAt: now,
        sellerTermsVersion: SELLER_TERMS_VERSION,
        submittedAt: now,
        resubmissionCount: sql`${shop.resubmissionCount} + 1`,
        updatedAt: now,
      })
      .where(eq(shop.id, draftId))

    await tx.update(user).set({ role: 'creator', updatedAt: now }).where(eq(user.id, userId))
  })

  logger.info('Seller shop submitted for review', {
    shopId: draftId,
    event: 'seller_onboarding_submitted',
    resubmission: record.resubmissionCount > 0,
  })
  return { success: true as const }
}

export async function getShopStatusInternal(userId: string, userRole: string, shopId: string) {
  const record = await verifyShopOwnershipOrAdmin(shopId, userId, userRole)
  const [owner, onboardingListing] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, record.ownerId) }),
    record.onboardingListingId
      ? db.query.product.findFirst({ where: eq(product.id, record.onboardingListingId) })
      : Promise.resolve(undefined),
  ])

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status,
    onboardingStep: record.onboardingStep,
    moderationNote: record.moderationNote,
    moderationStage: record.moderationStage,
    paymentConnected: record.paymentConnected,
    twoFactorEnabled: owner?.twoFactorEnabled ?? false,
    onboardingListingPublished:
      onboardingListing?.status === 'published' && onboardingListing.isActive === true,
    mollieAccountId: record.mollieAccountId,
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewedAt,
    updatedAt: record.updatedAt,
  }
}

export async function getShopsForModerationInternal(status: string) {
  const conditions = []
  if (status !== 'all') {
    conditions.push(eq(shop.status, status as (typeof shopStatusEnum.enumValues)[number]))
  } else {
    conditions.push(
      sql`${shop.status} IN ('pending_review', 'changes_requested', 'approved', 'rejected')`,
    )
  }

  const rows = await db
    .select({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      image: shop.image,
      status: shop.status,
      ownerId: shop.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      submittedAt: shop.submittedAt,
      resubmissionCount: shop.resubmissionCount,
      paymentConnected: shop.paymentConnected,
      createdAt: shop.createdAt,
    })
    .from(shop)
    .innerJoin(user, eq(shop.ownerId, user.id))
    .where(and(...conditions))
    .orderBy(shop.submittedAt)

  return rows
}

export async function moderateShopInternal(
  adminUserId: string,
  data: {
    shopId: string
    action: 'approve' | 'request_changes' | 'reject'
    note?: string
    stage?: number
  },
) {
  const record = await db.query.shop.findFirst({
    where: eq(shop.id, data.shopId),
  })
  if (!record) throw new Error('NOT_FOUND')

  const newStatus =
    data.action === 'approve'
      ? 'approved'
      : data.action === 'request_changes'
        ? 'changes_requested'
        : 'rejected'

  await db
    .update(shop)
    .set({
      status: newStatus,
      reviewedAt: new Date(),
      reviewedBy: adminUserId,
      moderationNote: data.note ?? null,
      moderationStage: data.action === 'request_changes' ? (data.stage ?? null) : null,
      onboardingStep:
        data.action === 'request_changes' && data.stage ? data.stage : record.onboardingStep,
      updatedAt: new Date(),
    })
    .where(eq(shop.id, data.shopId))

  let finalStatus: typeof newStatus | 'active' = newStatus
  if (newStatus === 'approved' && record.paymentConnected) {
    const { activateApprovedShopAndListing } = await import('./activation.server')
    const activation = await activateApprovedShopAndListing(data.shopId)
    if (activation.activated) finalStatus = 'active'
  }

  const [{ createNotification, sendNotificationEmail }, { getBaseUrl }] = await Promise.all([
    import('../notifications.server'),
    import('../env.server'),
  ])
  const statusPath = `/sell/status/${data.shopId}`
  const statusLabel = finalStatus === 'active' ? 'active' : newStatus
  await createNotification(record.ownerId, 'shop_moderation_update', {
    shopId: data.shopId,
    shopName: record.name,
    status: statusLabel,
    statusLabel,
    note: data.note ?? '',
    stage: data.action === 'request_changes' ? (data.stage ?? null) : null,
    targetPath: statusPath,
  })
  await sendNotificationEmail({
    userId: record.ownerId,
    template: 'shop_moderation_update',
    category: 'seller_updates',
    idempotencyKey: `shop:${data.shopId}:moderation:${record.resubmissionCount}:${data.action}`,
    data: {
      shopName: record.name,
      status: statusLabel,
      note: data.note ?? '',
      statusUrl: `${getBaseUrl()}${statusPath}`,
    },
  })

  logger.info('Seller onboarding moderation outcome recorded', {
    shopId: data.shopId,
    event: 'seller_onboarding_moderated',
    outcome: finalStatus,
    stage: data.action === 'request_changes' ? (data.stage ?? null) : null,
  })
  return { success: true, status: finalStatus }
}
