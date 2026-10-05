import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { meilisearchSyncQueue, notification, product, shop, shopReport } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createShop, createUser } from '#/test/factories'
import { listOpenShopReportsQuery, reportShopQuery, resolveShopReportQuery } from './reports.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('reportShopQuery', () => {
  it('creates a record in shop_report with status open and returns { alreadyReported: false }', async () => {
    const owner = await createUser({ role: 'creator' })
    const reporter = await createUser({ role: 'customer' })
    const shopRecord = await createShop(owner)

    const result = await reportShopQuery(
      shopRecord.id,
      reporter.id,
      'fraud',
      'This seller is engaging in fraudulent activities',
    )

    expect(result).toEqual({ alreadyReported: false })

    const reports = await db.select().from(shopReport).where(eq(shopReport.shopId, shopRecord.id))

    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      shopId: shopRecord.id,
      reporterUserId: reporter.id,
      reason: 'fraud',
      details: 'This seller is engaging in fraudulent activities',
      status: 'open',
      resolvedAt: null,
      resolvedByUserId: null,
    })
  })

  it('sanitizes details HTML when creating a report', async () => {
    const owner = await createUser({ role: 'creator' })
    const reporter = await createUser({ role: 'customer' })
    const shopRecord = await createShop(owner)

    const result = await reportShopQuery(
      shopRecord.id,
      reporter.id,
      'illegal',
      '<script>alert("xss")</script><p>Unsafe seller</p>',
    )

    expect(result).toEqual({ alreadyReported: false })

    const [savedReport] = await db
      .select()
      .from(shopReport)
      .where(eq(shopReport.shopId, shopRecord.id))

    expect(savedReport?.details).toBe('<p>Unsafe seller</p>')
    expect(savedReport?.details).not.toContain('<script>')
  })

  it('duplicate report by same user returns { alreadyReported: true } without throwing unique constraint error', async () => {
    const owner = await createUser({ role: 'creator' })
    const reporter = await createUser({ role: 'customer' })
    const shopRecord = await createShop(owner)

    const first = await reportShopQuery(
      shopRecord.id,
      reporter.id,
      'ip',
      'Infringing on registered trademark',
    )
    expect(first).toEqual({ alreadyReported: false })

    const duplicate = await reportShopQuery(
      shopRecord.id,
      reporter.id,
      'ip',
      'Infringing on registered trademark again',
    )
    expect(duplicate).toEqual({ alreadyReported: true })

    const count = await db.select().from(shopReport).where(eq(shopReport.shopId, shopRecord.id))

    expect(count).toHaveLength(1)
  })

  it('owner reporting own shop throws 403 (Forbidden)', async () => {
    const owner = await createUser({ role: 'creator' })
    const shopRecord = await createShop(owner)

    await expect(
      reportShopQuery(shopRecord.id, owner.id, 'fraud', 'Self-reporting attempt'),
    ).rejects.toMatchObject({ status: 403 })

    try {
      await reportShopQuery(shopRecord.id, owner.id, 'fraud', 'Self-reporting attempt')
      expect.unreachable('Should have thrown 403 Response')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      const res = err as Response
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body).toEqual({
        error: 'Forbidden',
        message: 'You cannot report your own shop',
      })
    }
  })

  it('non-existent shop throws 404 (Not Found)', async () => {
    const reporter = await createUser({ role: 'customer' })

    await expect(
      reportShopQuery('00000000-0000-0000-0000-000000000000', reporter.id, 'illegal', null),
    ).rejects.toMatchObject({ status: 404 })

    try {
      await reportShopQuery('00000000-0000-0000-0000-000000000000', reporter.id, 'illegal', null)
      expect.unreachable('Should have thrown 404 Response')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      const res = err as Response
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body).toEqual({
        error: 'Not Found',
        message: 'Shop not found',
      })
    }
  })
})

describe('listOpenShopReportsQuery', () => {
  it('returns paginated open shop reports with total count and shop name', async () => {
    const owner1 = await createUser({ role: 'creator' })
    const owner2 = await createUser({ role: 'creator' })
    const reporter1 = await createUser({ role: 'customer' })
    const reporter2 = await createUser({ role: 'customer' })

    const shop1 = await createShop(owner1, { name: 'Ceramics Atelier' })
    const shop2 = await createShop(owner2, { name: 'Linen Studio' })

    await reportShopQuery(shop1.id, reporter1.id, 'fraud', 'Misleading location')
    await reportShopQuery(shop2.id, reporter2.id, 'offensive', 'Inappropriate imagery')

    const result = await listOpenShopReportsQuery(1, 10)

    expect(result.total).toBe(2)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(10)
    expect(result.reports).toHaveLength(2)

    const shopNames = result.reports.map((r) => r.shopName)
    expect(shopNames).toContain('Ceramics Atelier')
    expect(shopNames).toContain('Linen Studio')

    for (const report of result.reports) {
      expect(report.shopName).toBeDefined()
      expect(report.reason).toBeDefined()
      expect(report.reporterUserId).toBeDefined()
      expect(report.createdAt).toBeInstanceOf(Date)
    }
  })

  it('paginates open reports correctly', async () => {
    const owner1 = await createUser({ role: 'creator' })
    const owner2 = await createUser({ role: 'creator' })
    const reporter1 = await createUser({ role: 'customer' })
    const reporter2 = await createUser({ role: 'customer' })

    const shop1 = await createShop(owner1, { name: 'Shop One' })
    const shop2 = await createShop(owner2, { name: 'Shop Two' })

    await reportShopQuery(shop1.id, reporter1.id, 'ip', 'Report 1')
    await reportShopQuery(shop2.id, reporter2.id, 'illegal', 'Report 2')

    const page1 = await listOpenShopReportsQuery(1, 1)
    expect(page1.total).toBe(2)
    expect(page1.reports).toHaveLength(1)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(1)

    const page2 = await listOpenShopReportsQuery(2, 1)
    expect(page2.total).toBe(2)
    expect(page2.reports).toHaveLength(1)
    expect(page2.page).toBe(2)
    expect(page2.pageSize).toBe(1)

    expect(page1.reports[0].id).not.toBe(page2.reports[0].id)
  })

  it('excludes resolved reports from total count and results', async () => {
    const owner1 = await createUser({ role: 'creator' })
    const owner2 = await createUser({ role: 'creator' })
    const reporter1 = await createUser({ role: 'customer' })
    const reporter2 = await createUser({ role: 'customer' })
    const admin = await createUser({ role: 'admin' })

    const shop1 = await createShop(owner1, { name: 'Active Shop' })
    const shop2 = await createShop(owner2, { name: 'Resolved Shop' })

    await reportShopQuery(shop1.id, reporter1.id, 'fraud', 'Ongoing investigation')
    await reportShopQuery(shop2.id, reporter2.id, 'other', 'Resolved issue')

    // Resolve shop2 report
    await resolveShopReportQuery(shop2.id, false, {
      ground: 'terms',
      explanation: 'No violation found',
      actorUserId: admin.id,
    })

    const result = await listOpenShopReportsQuery(1, 10)
    expect(result.total).toBe(1)
    expect(result.reports).toHaveLength(1)
    expect(result.reports[0].shopId).toBe(shop1.id)
    expect(result.reports[0].shopName).toBe('Active Shop')
  })
})

describe('resolveShopReportQuery (uphold)', () => {
  it('upholding report sets shop status to suspended, records decision, and emits notifications', async () => {
    const owner = await createUser({ role: 'creator' })
    const reporter1 = await createUser({ role: 'customer' })
    const reporter2 = await createUser({ role: 'customer' })
    const admin = await createUser({ role: 'admin' })
    const shopRecord = await createShop(owner, { status: 'active', isSuspended: false })
    await db.insert(product).values({
      id: 'prod-suspended-test',
      shopId: shopRecord.id,
      name: 'Sample listing',
      slug: 'sample-listing',
      priceCents: 1000,
      stockCount: 5,
      status: 'published',
      isActive: true,
    })

    await reportShopQuery(shopRecord.id, reporter1.id, 'fraud', 'Counterfeit items suspected')
    await reportShopQuery(shopRecord.id, reporter2.id, 'illegal', 'Prohibited material listed')

    const decision = {
      ground: 'illegal' as const,
      explanation: 'Confirmed unlawful items offered for sale violating DSA regulations.',
      actorUserId: admin.id,
    }

    await resolveShopReportQuery(shopRecord.id, true, decision)

    // Verify shop status is updated to suspended
    const [updatedShop] = await db.select().from(shop).where(eq(shop.id, shopRecord.id))

    expect(updatedShop.status).toBe('suspended')
    expect(updatedShop.isSuspended).toBe(true)
    expect(updatedShop.isSuspended).toBe(true)

    // Verify all products of suspended shop are enqueued to meilisearchSyncQueue
    const syncEntries = await db
      .select()
      .from(meilisearchSyncQueue)
      .where(eq(meilisearchSyncQueue.productId, 'prod-suspended-test'))
    expect(syncEntries).toHaveLength(1)
    expect(syncEntries[0].action).toBe('index')
    // Verify shop reports are marked upheld with reviewedBy and timestamp
    const reports = await db.select().from(shopReport).where(eq(shopReport.shopId, shopRecord.id))

    expect(reports).toHaveLength(2)
    for (const rep of reports) {
      expect(rep.status).toBe('upheld')
      expect(rep.resolvedByUserId).toBe(admin.id)
      expect(rep.resolvedAt).toBeInstanceOf(Date)
    }

    // Verify shop owner received DSA Article 17 Statement of Reasons notification
    const ownerNotifications = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, owner.id))

    expect(ownerNotifications).toHaveLength(1)
    expect(ownerNotifications[0].type).toBe('shop_moderated')
    expect(ownerNotifications[0].data).toMatchObject({
      shopId: shopRecord.id,
      shopSlug: shopRecord.slug,
      restriction: 'suspended',
      territorialScope: 'all',
      duration: 'indefinite',
      explanation: decision.explanation,
      promptedByNotice: true,
      automatedMeans: false,
      ground: 'illegal',
      redress: ['contact_support', 'judicial_remedy'],
    })

    // Verify both reporters received shop_report_resolved notifications
    const reporter1Notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, reporter1.id))

    expect(reporter1Notifications).toHaveLength(1)
    expect(reporter1Notifications[0].type).toBe('shop_report_resolved')
    expect(reporter1Notifications[0].data).toMatchObject({
      shopId: shopRecord.id,
      shopSlug: shopRecord.slug,
      outcome: 'upheld',
      redress: ['contact_support', 'judicial_remedy'],
    })

    const reporter2Notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, reporter2.id))

    expect(reporter2Notifications).toHaveLength(1)
    expect(reporter2Notifications[0].type).toBe('shop_report_resolved')
    expect(reporter2Notifications[0].data).toMatchObject({
      shopId: shopRecord.id,
      shopSlug: shopRecord.slug,
      outcome: 'upheld',
      redress: ['contact_support', 'judicial_remedy'],
    })
  })
})

describe('resolveShopReportQuery (dismiss)', () => {
  it('dismissing report leaves shop active, sets report to dismissed, and emits notification to reporters', async () => {
    const owner = await createUser({ role: 'creator' })
    const reporter = await createUser({ role: 'customer' })
    const admin = await createUser({ role: 'admin' })
    const shopRecord = await createShop(owner, { status: 'active', isSuspended: false })

    await reportShopQuery(shopRecord.id, reporter.id, 'offensive', 'Subjectively offensive banner')

    const decision = {
      ground: 'terms' as const,
      explanation: 'Content complies with Community Guidelines and terms of service.',
      actorUserId: admin.id,
    }

    await resolveShopReportQuery(shopRecord.id, false, decision)

    // Verify shop remains active and not suspended
    const [updatedShop] = await db.select().from(shop).where(eq(shop.id, shopRecord.id))

    expect(updatedShop.status).toBe('active')
    expect(updatedShop.isSuspended).toBe(false)

    // Verify shop report status is dismissed with reviewedBy
    const [rep] = await db.select().from(shopReport).where(eq(shopReport.shopId, shopRecord.id))

    expect(rep.status).toBe('dismissed')
    expect(rep.resolvedByUserId).toBe(admin.id)
    expect(rep.resolvedAt).toBeInstanceOf(Date)

    // Verify reporter received shop_report_resolved notification with outcome dismissed
    const reporterNotifications = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, reporter.id))

    expect(reporterNotifications).toHaveLength(1)
    expect(reporterNotifications[0].type).toBe('shop_report_resolved')
    expect(reporterNotifications[0].data).toMatchObject({
      shopId: shopRecord.id,
      outcome: 'dismissed',
      redress: ['contact_support', 'judicial_remedy'],
    })

    // Verify shop owner does NOT receive shop_moderated notification when dismissed
    const ownerNotifications = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, owner.id))

    expect(ownerNotifications).toHaveLength(0)
  })

  it('throws 404 (Not Found) when resolving reports for a non-existent shop', async () => {
    const admin = await createUser({ role: 'admin' })

    await expect(
      resolveShopReportQuery('00000000-0000-0000-0000-000000000000', true, {
        ground: 'illegal',
        explanation: 'Missing shop',
        actorUserId: admin.id,
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
