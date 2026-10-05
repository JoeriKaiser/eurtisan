import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { meilisearchSyncQueue, notification, product, productReport } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createProduct, createShop, createUser } from '#/test/factories'
import {
  listOpenProductReportsQuery,
  reportProductQuery,
  resolveProductReportQuery,
} from './reports.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('reportProductQuery', () => {
  it('creates an open product_report record and returns alreadyReported false', async () => {
    const owner = await createUser()
    const shop = await createShop(owner)
    const prod = await createProduct(shop)
    const reporter = await createUser()

    const result = await reportProductQuery(
      prod.id,
      reporter.id,
      'illegal',
      'Prohibited hazardous material',
    )

    expect(result).toEqual({ alreadyReported: false })

    const [report] = await db
      .select()
      .from(productReport)
      .where(eq(productReport.productId, prod.id))

    expect(report).toBeDefined()
    expect(report.productId).toBe(prod.id)
    expect(report.reporterUserId).toBe(reporter.id)
    expect(report.reason).toBe('illegal')
    expect(report.details).toBe('Prohibited hazardous material')
    expect(report.status).toBe('open')
    expect(report.resolvedAt).toBeNull()
    expect(report.resolvedByUserId).toBeNull()
    expect(report.createdAt).toBeInstanceOf(Date)
  })

  it('handles duplicate report by same user without error and returns alreadyReported true', async () => {
    const owner = await createUser()
    const shop = await createShop(owner)
    const prod = await createProduct(shop)
    const reporter = await createUser()

    const first = await reportProductQuery(
      prod.id,
      reporter.id,
      'fraud',
      'Suspicious counterfeit item',
    )
    expect(first).toEqual({ alreadyReported: false })

    const second = await reportProductQuery(
      prod.id,
      reporter.id,
      'fraud',
      'Duplicate attempt with new details',
    )
    expect(second).toEqual({ alreadyReported: true })

    const reports = await db
      .select()
      .from(productReport)
      .where(eq(productReport.productId, prod.id))

    expect(reports).toHaveLength(1)
    expect(reports[0].details).toBe('Suspicious counterfeit item')
  })

  it('throws 403 Forbidden when owner attempts to report their own product', async () => {
    const owner = await createUser()
    const shop = await createShop(owner)
    const prod = await createProduct(shop)

    try {
      await reportProductQuery(prod.id, owner.id, 'ip', 'Accidental self-report')
      expect.unreachable('Should have thrown 403 Forbidden')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      const res = err as Response
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Forbidden')
      expect(body.message).toBe('You cannot report your own listing')
    }

    const reports = await db
      .select()
      .from(productReport)
      .where(eq(productReport.productId, prod.id))
    expect(reports).toHaveLength(0)
  })

  it('throws 404 Not Found when product does not exist', async () => {
    const reporter = await createUser()

    try {
      await reportProductQuery('00000000-0000-0000-0000-000000000000', reporter.id, 'other', null)
      expect.unreachable('Should have thrown 404 Not Found')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      const res = err as Response
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('Not Found')
      expect(body.message).toBe('Product not found')
    }
  })
})

describe('listOpenProductReportsQuery', () => {
  it('returns paginated open reports with total count, product title, and reporter user id', async () => {
    const owner = await createUser()
    const shop = await createShop(owner)
    const prod1 = await createProduct(shop, { name: 'Ceramic Teapot' })
    const prod2 = await createProduct(shop, { name: 'Linen Blanket' })

    const reporter1 = await createUser({ name: 'Alice Reporter', email: 'alice@example.com' })
    const reporter2 = await createUser({ name: 'Bob Reporter', email: 'bob@example.com' })
    const reporter3 = await createUser({ name: 'Charlie Reporter', email: 'charlie@example.com' })

    await reportProductQuery(prod1.id, reporter1.id, 'illegal', 'Banned chemical glaze')
    await reportProductQuery(prod1.id, reporter2.id, 'offensive', 'Inappropriate symbol')
    await reportProductQuery(prod2.id, reporter3.id, 'fraud', 'Misleading thread count')

    // Seed a resolved report to verify it is excluded from open reports
    const prod3 = await createProduct(shop, { name: 'Wooden Spoon' })
    const admin = await createUser({ role: 'admin' })
    await reportProductQuery(prod3.id, reporter1.id, 'other', 'Resolved earlier')
    await resolveProductReportQuery(prod3.id, false, {
      ground: 'terms',
      explanation: 'No violation found',
      actorUserId: admin.id,
    })

    const page1 = await listOpenProductReportsQuery(1, 2)
    expect(page1.total).toBe(3)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(2)
    expect(page1.reports).toHaveLength(2)

    for (const item of page1.reports) {
      expect(item.id).toBeDefined()
      expect(item.productId).toBeDefined()
      expect(typeof item.productName).toBe('string')
      expect(item.reason).toBeDefined()
      expect(item.reporterUserId).toBeDefined()
      expect(item.createdAt).toBeInstanceOf(Date)
    }

    const page2 = await listOpenProductReportsQuery(2, 2)
    expect(page2.total).toBe(3)
    expect(page2.page).toBe(2)
    expect(page2.pageSize).toBe(2)
    expect(page2.reports).toHaveLength(1)

    const allProductNames = [
      ...page1.reports.map((r) => r.productName),
      ...page2.reports.map((r) => r.productName),
    ]
    expect(allProductNames).toContain('Ceramic Teapot')
    expect(allProductNames).toContain('Linen Blanket')
    expect(allProductNames).not.toContain('Wooden Spoon')
  })
})

describe('resolveProductReportQuery', () => {
  it('upholds reports: sets product isActive false, updates report to upheld, and notifies owner and reporters', async () => {
    const owner = await createUser()
    const shop = await createShop(owner)
    const prod = await createProduct(shop, { isActive: true })
    const admin = await createUser({ role: 'admin' })

    const reporter1 = await createUser()
    const reporter2 = await createUser()

    await reportProductQuery(prod.id, reporter1.id, 'illegal', 'Prohibited weapon component')
    await reportProductQuery(prod.id, reporter2.id, 'ip', 'Trademark infringement')

    await resolveProductReportQuery(prod.id, true, {
      ground: 'illegal',
      explanation: 'Listing violates DSA compliance policy regarding prohibited goods.',
      actorUserId: admin.id,
    })

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))

    expect(updatedProduct.isActive).toBe(false)

    const [syncEntry] = await db
      .select()
      .from(meilisearchSyncQueue)
      .where(eq(meilisearchSyncQueue.productId, prod.id))
    expect(syncEntry).toBeDefined()
    expect(syncEntry.action).toBe('delete')
    const updatedReports = await db
      .select()
      .from(productReport)
      .where(eq(productReport.productId, prod.id))

    expect(updatedReports).toHaveLength(2)
    for (const r of updatedReports) {
      expect(r.status).toBe('upheld')
      expect(r.resolvedByUserId).toBe(admin.id)
      expect(r.resolvedAt).toBeInstanceOf(Date)
    }

    const [ownerNotification] = await db
      .select()
      .from(notification)
      .where(and(eq(notification.userId, owner.id), eq(notification.type, 'product_moderated')))

    expect(ownerNotification).toBeDefined()
    expect(ownerNotification.data).toMatchObject({
      productId: prod.id,
      productSlug: prod.slug,
      shopSlug: shop.slug,
      restriction: 'hidden',
      territorialScope: 'all',
      duration: 'indefinite',
      explanation: 'Listing violates DSA compliance policy regarding prohibited goods.',
      promptedByNotice: true,
      automatedMeans: false,
      ground: 'illegal',
      redress: ['contact_support', 'judicial_remedy'],
    })

    for (const reporter of [reporter1, reporter2]) {
      const [reporterNotification] = await db
        .select()
        .from(notification)
        .where(
          and(
            eq(notification.userId, reporter.id),
            eq(notification.type, 'product_report_resolved'),
          ),
        )

      expect(reporterNotification).toBeDefined()
      expect(reporterNotification.data).toMatchObject({
        productId: prod.id,
        productSlug: prod.slug,
        shopSlug: shop.slug,
        outcome: 'upheld',
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
  })

  it('dismisses reports: leaves product active, updates report to dismissed, and notifies reporters only', async () => {
    const owner = await createUser()
    const shop = await createShop(owner)
    const prod = await createProduct(shop, { isActive: true })
    const admin = await createUser({ role: 'admin' })

    const reporter1 = await createUser()
    const reporter2 = await createUser()

    await reportProductQuery(prod.id, reporter1.id, 'offensive', 'Not offensive upon review')
    await reportProductQuery(prod.id, reporter2.id, 'other', 'Benign description')

    await resolveProductReportQuery(prod.id, false, {
      ground: 'terms',
      explanation: 'Content complies with community standards and EU regulations.',
      actorUserId: admin.id,
    })

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))

    expect(updatedProduct.isActive).toBe(true)

    const updatedReports = await db
      .select()
      .from(productReport)
      .where(eq(productReport.productId, prod.id))

    expect(updatedReports).toHaveLength(2)
    for (const r of updatedReports) {
      expect(r.status).toBe('dismissed')
      expect(r.resolvedByUserId).toBe(admin.id)
      expect(r.resolvedAt).toBeInstanceOf(Date)
    }

    const ownerNotifications = await db
      .select()
      .from(notification)
      .where(and(eq(notification.userId, owner.id), eq(notification.type, 'product_moderated')))
    expect(ownerNotifications).toHaveLength(0)

    for (const reporter of [reporter1, reporter2]) {
      const [reporterNotification] = await db
        .select()
        .from(notification)
        .where(
          and(
            eq(notification.userId, reporter.id),
            eq(notification.type, 'product_report_resolved'),
          ),
        )

      expect(reporterNotification).toBeDefined()
      expect(reporterNotification.data).toMatchObject({
        productId: prod.id,
        outcome: 'dismissed',
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
  })

  it('throws 404 Not Found when resolving a non-existent product', async () => {
    const admin = await createUser({ role: 'admin' })

    try {
      await resolveProductReportQuery('00000000-0000-0000-0000-000000000000', true, {
        ground: 'illegal',
        explanation: 'Non-existent product test',
        actorUserId: admin.id,
      })
      expect.unreachable('Should have thrown 404 Not Found')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      const res = err as Response
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('Not Found')
    }
  })
})
