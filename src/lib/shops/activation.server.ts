import '@tanstack/react-start/server-only'

import { and, eq, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { meilisearchSyncQueue, product, shop, user } from '#/db/schema'
import { logger } from '#/lib/logger.server'

export interface ShopActivationResult {
  activated: boolean
  reason?: 'not_approved' | 'two_factor_required' | 'payment_not_connected' | 'listing_not_ready'
  listingId?: string
}

/**
 * Activates an approved, payment-connected shop and its onboarding listing in
 * one transaction. A shop is never marked active while its first product is
 * still a draft or inactive.
 */
export async function activateApprovedShopAndListing(
  shopId: string,
): Promise<ShopActivationResult> {
  const record = await db.query.shop.findFirst({ where: eq(shop.id, shopId) })
  if (!record || (record.status !== 'approved' && record.status !== 'active')) {
    return { activated: false, reason: 'not_approved' }
  }
  const owner = await db.query.user.findFirst({
    where: eq(user.id, record.ownerId),
    columns: { twoFactorEnabled: true },
  })
  if (!owner?.twoFactorEnabled) {
    return { activated: false, reason: 'two_factor_required' }
  }
  if (!record.paymentConnected) {
    return { activated: false, reason: 'payment_not_connected' }
  }
  if (!record.onboardingListingId) {
    return { activated: false, reason: 'listing_not_ready' }
  }

  const listing = await db.query.product.findFirst({
    where: and(eq(product.id, record.onboardingListingId), eq(product.shopId, shopId)),
  })
  if (!listing || listing.stockCount < 1 || listing.priceCents < 50) {
    return { activated: false, reason: 'listing_not_ready' }
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(product)
      .set({
        status: 'published',
        isActive: true,
        publishedAt: sql`coalesce(${product.publishedAt}, now())`,
        updatedAt: now,
      })
      .where(eq(product.id, listing.id))

    await tx.insert(meilisearchSyncQueue).values({ productId: listing.id, action: 'index' })

    await tx.update(shop).set({ status: 'active', updatedAt: now }).where(eq(shop.id, shopId))
  })

  logger.info('Seller shop activated with onboarding listing', {
    shopId,
    listingId: listing.id,
    event: 'seller_onboarding_activated',
    firstProductPublished: true,
    approvalToActivationMs: record.reviewedAt
      ? Math.max(0, now.getTime() - record.reviewedAt.getTime())
      : null,
  })
  return { activated: true, listingId: listing.id }
}
