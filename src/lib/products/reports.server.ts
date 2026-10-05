import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { meilisearchSyncQueue, product, productReport, shop } from '#/db/schema'
import { isPostgresUniqueViolation } from '../db-errors'
import { logger } from '../logger.server'
import { assertUserRateLimit } from '../rate-limit.server'
import { sanitizeRichText } from '../xss'

export type ProductReportReason = 'illegal' | 'ip' | 'fraud' | 'offensive' | 'other'

export async function reportProductQuery(
  productId: string,
  reporterUserId: string,
  reason: ProductReportReason,
  details: string | null,
): Promise<{ alreadyReported: boolean }> {
  await assertUserRateLimit(reporterUserId, 10, 15 * 60 * 1000)

  const [record] = await db
    .select({ id: product.id, shopOwnerId: shop.ownerId })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(eq(product.id, productId))
    .limit(1)

  if (!record) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Product not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (record.shopOwnerId === reporterUserId) {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'You cannot report your own listing' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    await db.insert(productReport).values({
      productId,
      reporterUserId,
      reason,
      details: details ? sanitizeRichText(details) : null,
    })
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'product_report_product_reporter_unique')) {
      return { alreadyReported: true }
    }
    throw err
  }

  return { alreadyReported: false }
}

export async function listOpenProductReportsQuery(page: number, pageSize: number) {
  const validatedPageSize = Math.min(100, Math.max(1, pageSize))
  const [totalResult] = await db
    .select({ total: count() })
    .from(productReport)
    .where(eq(productReport.status, 'open'))
  const total = totalResult?.total ?? 0
  const offset = (Math.max(1, page) - 1) * validatedPageSize

  const rows = await db
    .select({
      id: productReport.id,
      productId: productReport.productId,
      productName: product.name,
      reason: productReport.reason,
      details: productReport.details,
      reporterUserId: productReport.reporterUserId,
      createdAt: productReport.createdAt,
    })
    .from(productReport)
    .innerJoin(product, eq(productReport.productId, product.id))
    .where(eq(productReport.status, 'open'))
    .orderBy(desc(productReport.createdAt))
    .limit(validatedPageSize)
    .offset(offset)

  return { reports: rows, total, page: Math.max(1, page), pageSize: validatedPageSize }
}

export async function resolveProductReportQuery(
  productId: string,
  restrict: boolean,
  decision: {
    ground: 'illegal' | 'terms'
    explanation: string
    actorUserId: string
  },
): Promise<void> {
  const [record] = await db
    .select({
      id: product.id,
      shopId: product.shopId,
      slug: product.slug,
      isActive: product.isActive,
      ownerId: shop.ownerId,
      shopSlug: shop.slug,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(eq(product.id, productId))
    .limit(1)

  if (!record) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Product not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (restrict) {
    await db.transaction(async (tx) => {
      await tx
        .update(product)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(product.id, productId))

      await tx.insert(meilisearchSyncQueue).values({
        productId,
        action: 'delete' as const,
      })
    })
  }

  const openReports = await db
    .select({ id: productReport.id, reporterUserId: productReport.reporterUserId })
    .from(productReport)
    .where(and(eq(productReport.productId, productId), eq(productReport.status, 'open')))

  if (openReports.length > 0) {
    await db
      .update(productReport)
      .set({
        status: restrict ? 'upheld' : 'dismissed',
        resolvedAt: new Date(),
        resolvedByUserId: decision.actorUserId,
      })
      .where(and(eq(productReport.productId, productId), eq(productReport.status, 'open')))
  }

  try {
    const { createNotification } = await import('../notifications.server')
    if (restrict) {
      await createNotification(record.ownerId, 'product_moderated', {
        productId,
        productSlug: record.slug,
        shopSlug: record.shopSlug,
        restriction: 'hidden',
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
      await createNotification(report.reporterUserId, 'product_report_resolved', {
        productId,
        productSlug: record.slug,
        shopSlug: record.shopSlug,
        outcome: restrict ? 'upheld' : 'dismissed',
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
  } catch (err) {
    logger.error('Failed to send product moderation notifications', err, { productId })
  }
}
