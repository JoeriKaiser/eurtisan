import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { meilisearchSyncQueue, product, shop, shopReport } from '#/db/schema'
import { isPostgresUniqueViolation } from '../db-errors'
import { logger } from '../logger.server'
import { assertUserRateLimit } from '../rate-limit.server'
import { sanitizeRichText } from '../xss'
import type { ProductReportReason } from '../products/reports.server'

export async function reportShopQuery(
  shopId: string,
  reporterUserId: string,
  reason: ProductReportReason,
  details: string | null,
): Promise<{ alreadyReported: boolean }> {
  await assertUserRateLimit(reporterUserId, 10, 15 * 60 * 1000)

  const [record] = await db
    .select({ id: shop.id, ownerId: shop.ownerId })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!record) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (record.ownerId === reporterUserId) {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'You cannot report your own shop' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    await db.insert(shopReport).values({
      shopId,
      reporterUserId,
      reason,
      details: details ? sanitizeRichText(details) : null,
    })
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'shop_report_shop_reporter_unique')) {
      return { alreadyReported: true }
    }
    throw err
  }

  return { alreadyReported: false }
}

export async function listOpenShopReportsQuery(page: number, pageSize: number) {
  const validatedPageSize = Math.min(100, Math.max(1, pageSize))
  const [totalResult] = await db
    .select({ total: count() })
    .from(shopReport)
    .where(eq(shopReport.status, 'open'))
  const total = totalResult?.total ?? 0
  const offset = (Math.max(1, page) - 1) * validatedPageSize

  const rows = await db
    .select({
      id: shopReport.id,
      shopId: shopReport.shopId,
      shopName: shop.name,
      reason: shopReport.reason,
      details: shopReport.details,
      reporterUserId: shopReport.reporterUserId,
      createdAt: shopReport.createdAt,
    })
    .from(shopReport)
    .innerJoin(shop, eq(shopReport.shopId, shop.id))
    .where(eq(shopReport.status, 'open'))
    .orderBy(desc(shopReport.createdAt))
    .limit(validatedPageSize)
    .offset(offset)

  return { reports: rows, total, page: Math.max(1, page), pageSize: validatedPageSize }
}

export async function resolveShopReportQuery(
  shopId: string,
  restrict: boolean,
  decision: {
    ground: 'illegal' | 'terms'
    explanation: string
    actorUserId: string
  },
): Promise<void> {
  const [record] = await db
    .select({ id: shop.id, ownerId: shop.ownerId, slug: shop.slug, isSuspended: shop.isSuspended })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!record) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (restrict) {
    await db.transaction(async (tx) => {
      await tx
        .update(shop)
        .set({ isSuspended: true, status: 'suspended', updatedAt: new Date() })
        .where(eq(shop.id, shopId))

      const products = await tx
        .select({ id: product.id })
        .from(product)
        .where(eq(product.shopId, shopId))

      if (products.length > 0) {
        await tx.insert(meilisearchSyncQueue).values(
          products.map((row) => ({
            productId: row.id,
            action: 'index' as const,
          })),
        )
      }
    })
  }

  const openReports = await db
    .select({ id: shopReport.id, reporterUserId: shopReport.reporterUserId })
    .from(shopReport)
    .where(and(eq(shopReport.shopId, shopId), eq(shopReport.status, 'open')))

  if (openReports.length > 0) {
    await db
      .update(shopReport)
      .set({
        status: restrict ? 'upheld' : 'dismissed',
        resolvedAt: new Date(),
        resolvedByUserId: decision.actorUserId,
      })
      .where(and(eq(shopReport.shopId, shopId), eq(shopReport.status, 'open')))
  }

  try {
    const { createNotification } = await import('../notifications.server')
    if (restrict) {
      await createNotification(record.ownerId, 'shop_moderated', {
        shopId,
        shopSlug: record.slug,
        restriction: 'suspended',
        territorialScope: 'all',
        duration: 'indefinite',
        explanation: decision.explanation,
        promptedByNotice: openReports.length > 0,
        automatedMeans: false,
        ground: decision.ground,
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
    for (const report of openReports) {
      await createNotification(report.reporterUserId, 'shop_report_resolved', {
        shopId,
        shopSlug: record.slug,
        outcome: restrict ? 'upheld' : 'dismissed',
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
  } catch (err) {
    logger.error('Failed to send shop moderation notifications', err, { shopId })
  }
}
