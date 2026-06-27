import { and, count, eq, ilike, ne, sql } from 'drizzle-orm'
import z from 'zod'
import { db } from '#/db/index'
import {
  product,
  shop,
  shopSocials,
  type shopSocialPlatformEnum,
  type shopStatusEnum,
  user,
} from '#/db/schema'
import type { PoliciesData, ShippingOriginData, ShopDraft } from './sell-onboarding'
import { sanitizeRichText, validatePlainText } from './xss'
import { encryptJsonb } from './encryption.server'
import { SUPPORTED_CURRENCY } from './currency'

const PROFANITY_LIST = new Set(['shit', 'fuck', 'damn', 'bitch', 'asshole', 'cunt', 'dick', 'piss'])

const DANGEROUS_SCHEMES = ['javascript:', 'vbscript:', 'data:']

function hasDangerousScheme(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return DANGEROUS_SCHEMES.some((scheme) => lower.startsWith(scheme))
}

function isAllowedImageUrl(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return (
    lower.startsWith('/uploads/') || lower.startsWith('http://') || lower.startsWith('https://')
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
    shippingOrigin: (record.shippingOrigin as ShippingOriginData | null) ?? null,
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
    isSuspended: record.isSuspended,
    moderationNote: record.moderationNote,
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

  if (user.role === 'customer') {
    const { user: userTable } = await import('#/db/schema')
    await db
      .update(userTable)
      .set({ role: 'creator', updatedAt: new Date() })
      .where(eq(userTable.id, user.id))
  }

  const id = crypto.randomUUID()
  await db.insert(shop).values({
    id,
    name: 'My Shop',
    slug: `shop-${id.slice(0, 8)}`,
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

  if (payload.step < 1 || payload.step > 8) {
    throw new Error('INVALID_ONBOARDING_STEP')
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    onboardingStep: Math.max(record.onboardingStep, payload.step),
  }

  const d = payload.data

  if (d.name !== undefined) updateData.name = validatePlainText(String(d.name), 'Shop name')
  if (d.slug !== undefined) updateData.slug = String(d.slug).trim()
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

export async function getSellerShopsInternal(userId: string) {
  const shops = await db
    .select({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      image: shop.image,
      status: shop.status,
      onboardingStep: shop.onboardingStep,
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
) {
  const record = await verifyShopOwnershipOrAdmin(draftId, userId, userRole)

  if (record.status !== 'draft' && record.status !== 'changes_requested') {
    throw new Error('FORBIDDEN')
  }

  // Fail-Safe Onboarding Check for DAC7 Compliance
  if (!record.taxId || record.taxId.trim() === '') {
    throw new Error('MISSING_TAX_ID')
  }
  if (record.legalEntityType === 'individual') {
    if (!record.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(record.dateOfBirth)) {
      throw new Error('MISSING_OR_INVALID_DOB')
    }
  } else if (record.legalEntityType === 'business') {
    if (!record.businessRegistrationNumber || record.businessRegistrationNumber.trim() === '') {
      throw new Error('MISSING_BUSINESS_REGISTRATION')
    }
  }

  const [listingCount] = await db
    .select({ count: count(product.id) })
    .from(product)
    .where(eq(product.shopId, draftId))

  if (!listingCount || listingCount.count === 0) {
    throw new Error('MISSING_LISTING')
  }

  await db
    .update(shop)
    .set({
      status: 'pending_review',
      submittedAt: new Date(),
      resubmissionCount: sql`${shop.resubmissionCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(shop.id, draftId))

  return { success: true }
}

export async function getShopStatusInternal(userId: string, userRole: string, shopId: string) {
  const record = await verifyShopOwnershipOrAdmin(shopId, userId, userRole)

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status,
    onboardingStep: record.onboardingStep,
    moderationNote: record.moderationNote,
    paymentConnected: record.paymentConnected,
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
  data: { shopId: string; action: 'approve' | 'request_changes' | 'reject'; note?: string },
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
      updatedAt: new Date(),
    })
    .where(eq(shop.id, data.shopId))

  return { success: true, status: newStatus }
}
