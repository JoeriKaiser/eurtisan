import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { product, productReport, shop, shopReport, user } from '#/db/schema'
import { AuthError } from '../authz'
import type { SafeUser } from '../server-auth'
import { requireReporterUser } from './contract'
import {
  createProductReportQuery,
  createShopReportQuery,
  getAdminListingReportsQuery,
  resolveListingReportQuery,
} from './operations.server'

beforeEach(async () => {
  await db.delete(productReport)
  await db.delete(shopReport)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

afterAll(async () => {
  await db.delete(productReport)
  await db.delete(shopReport)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      emailVerified: true,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
  return db
    .insert(product)
    .values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 10,
      shopId: 'shop-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

function adminActor(id = 'admin-1'): SafeUser {
  return {
    id,
    name: 'Admin',
    email: 'admin@example.com',
    emailVerified: true,
    image: null,
    role: 'admin',
    bannedAt: null,
    deletedAt: null,
    twoFactorEnabled: true,
  }
}

function customerActor(): SafeUser {
  return { ...adminActor('customer-1'), id: 'customer-1', role: 'customer' }
}

/* -------------------------------------------------------------------------- */
/*                       Contract authentication boundary                      */
/* -------------------------------------------------------------------------- */

describe('requireReporterUser', () => {
  it('rejects an unauthenticated caller with 401', () => {
    // Reporting is open to every authenticated user and to nobody else — this
    // is the exact guard the create contracts run before their handlers.
    try {
      requireReporterUser({ user: null })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(401)
    }
  })

  it('passes the authenticated user through', () => {
    const actor = adminActor()
    expect(requireReporterUser({ user: actor })).toBe(actor)
  })
})

/* -------------------------------------------------------------------------- */
/*                             Creating notices                               */
/* -------------------------------------------------------------------------- */

describe('createProductReportQuery', () => {
  it('records an open notice with sanitized details', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()

    const result = await createProductReportQuery(
      'prod-1',
      'user-1',
      'counterfeit',
      '<strong>Fake</strong><script>alert(1)</script>',
    )
    expect(result.alreadyReported).toBe(false)

    const [record] = await db
      .select()
      .from(productReport)
      .where(eq(productReport.productId, 'prod-1'))
    expect(record.reason).toBe('counterfeit')
    expect(record.details).toBe('<strong>Fake</strong>')
    expect(record.status).toBe('open')
    expect(record.reporterUserId).toBe('user-1')
    expect(record.resolvedAt).toBeNull()
  })

  it('treats a second notice from the same person as already on record', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()

    await createProductReportQuery('prod-1', 'user-1', 'fraud', null)
    const second = await createProductReportQuery('prod-1', 'user-1', 'other', 'again')
    expect(second.alreadyReported).toBe(true)

    const rows = await db.select().from(productReport)
    expect(rows).toHaveLength(1)
  })

  it('rejects a report for a product that does not exist', async () => {
    await seedUser()
    await expect(
      createProductReportQuery('missing-product', 'user-1', 'other', null),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('is ownership-independent: the seller may report their own listing', async () => {
    // DSA Art. 16 does not gatekeep who may file a notice; triage happens later.
    const owner = await seedUser()
    await seedShop({ ownerId: owner.id })
    await seedProduct()

    const result = await createProductReportQuery('prod-1', owner.id, 'unsafe', 'battery risk')
    expect(result.alreadyReported).toBe(false)
  })
})

describe('createShopReportQuery', () => {
  it('records a notice against a shop', async () => {
    await seedUser()
    await seedShop()

    const result = await createShopReportQuery('shop-1', 'user-1', 'illegal_goods', null)
    expect(result.alreadyReported).toBe(false)

    const [record] = await db.select().from(shopReport).where(eq(shopReport.shopId, 'shop-1'))
    expect(record.status).toBe('open')
  })

  it('rejects a report for a shop that does not exist', async () => {
    await seedUser()
    await expect(createShopReportQuery('nope', 'user-1', 'fraud', null)).rejects.toMatchObject({
      status: 404,
    })
  })
})

/* -------------------------------------------------------------------------- */
/*                              Admin triage queue                            */
/* -------------------------------------------------------------------------- */

describe('getAdminListingReportsQuery', () => {
  it('merges both queues newest first with names resolved', async () => {
    await seedUser({ id: 'shop-owner', email: 'owner@example.com' })
    await seedUser({ id: 'reporter-a', email: 'a@example.com' })
    await seedUser({ id: 'reporter-b', email: 'b@example.com' })
    await seedShop({ ownerId: 'shop-owner' })
    await seedProduct()

    await db.insert(productReport).values({
      productId: 'prod-1',
      reporterUserId: 'reporter-a',
      reason: 'counterfeit',
      createdAt: new Date('2026-01-01T10:00:00Z'),
    })
    await db.insert(shopReport).values({
      shopId: 'shop-1',
      reporterUserId: 'reporter-b',
      reason: 'fraud',
      createdAt: new Date('2026-01-02T10:00:00Z'),
    })

    const result = await getAdminListingReportsQuery(adminActor(), 'all', 1, 20)
    expect(result.total).toBe(2)
    expect(result.reports.map((r) => r.targetType)).toEqual(['shop', 'product'])
    expect(result.reports[0]?.targetName).toBe('Test Shop')
    expect(result.reports[1]?.targetName).toBe('Vase')
    expect(result.reports[1]?.shopName).toBe('Test Shop')
    expect(result.reports[1]?.reporterName).toBe('Test')
  })

  it('filters by status and paginates across both tables', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()

    // Every notice needs its own reporter: the unique index is per person.
    await seedUser({ id: 'user-2', email: 'two@example.com' })
    await db.insert(productReport).values([
      {
        productId: 'prod-1',
        reporterUserId: 'user-1',
        reason: 'counterfeit',
        status: 'actioned',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        productId: 'prod-1',
        reporterUserId: 'user-2',
        reason: 'fraud',
        createdAt: new Date('2026-01-03T10:00:00Z'),
      },
    ])
    await db.insert(shopReport).values({
      shopId: 'shop-1',
      reporterUserId: 'user-2',
      reason: 'unsafe',
      createdAt: new Date('2026-01-02T10:00:00Z'),
    })

    const openPage = await getAdminListingReportsQuery(adminActor(), 'open', 1, 20)
    expect(openPage.total).toBe(2)
    expect(openPage.reports.map((r) => r.reason)).toEqual(['fraud', 'unsafe'])

    const pageOne = await getAdminListingReportsQuery(adminActor(), 'all', 1, 2)
    expect(pageOne.reports).toHaveLength(2)
    const pageTwo = await getAdminListingReportsQuery(adminActor(), 'all', 2, 2)
    expect(pageTwo.reports).toHaveLength(1)
    expect(pageTwo.page).toBe(2)
  })

  it('refuses non-admin callers', async () => {
    await expect(getAdminListingReportsQuery(customerActor(), 'all', 1, 20)).rejects.toMatchObject({
      status: 403,
    })
    try {
      await getAdminListingReportsQuery(customerActor(), 'all', 1, 20)
    } catch (err) {
      expect(err instanceof AuthError).toBe(true)
    }
  })
})

/* -------------------------------------------------------------------------- */
/*                            Resolving notices                               */
/* -------------------------------------------------------------------------- */

describe('resolveListingReportQuery', () => {
  async function seedOpenReports() {
    await seedUser()
    await seedUser({ id: 'admin-1', email: 'admin@example.com' })
    await seedShop()
    await seedProduct()
    await db.insert(productReport).values({
      id: '11111111-1111-4111-8111-111111111111',
      productId: 'prod-1',
      reporterUserId: 'user-1',
      reason: 'counterfeit',
    })
    await db.insert(shopReport).values({
      id: '22222222-2222-4222-8222-222222222222',
      shopId: 'shop-1',
      reporterUserId: 'user-1',
      reason: 'fraud',
    })
  }

  it('records outcome, note, resolver and timestamp on a product report', async () => {
    await seedOpenReports()

    await resolveListingReportQuery(adminActor(), {
      reportId: '11111111-1111-4111-8111-111111111111',
      targetType: 'product',
      outcome: 'actioned',
      note: 'Listing removed after confirming the counterfeit.',
    })

    const [resolved] = await db
      .select()
      .from(productReport)
      .where(eq(productReport.id, '11111111-1111-4111-8111-111111111111'))
    expect(resolved.status).toBe('actioned')
    expect(resolved.resolutionNote).toBe('Listing removed after confirming the counterfeit.')
    expect(resolved.resolvedByUserId).toBe('admin-1')
    expect(resolved.resolvedAt).toBeInstanceOf(Date)
  })

  it('dismisses a shop report', async () => {
    await seedOpenReports()

    await resolveListingReportQuery(adminActor(), {
      reportId: '22222222-2222-4222-8222-222222222222',
      targetType: 'shop',
      outcome: 'dismissed',
      note: 'Goods are legal in the declared category.',
    })

    const [resolved] = await db
      .select()
      .from(shopReport)
      .where(eq(shopReport.id, '22222222-2222-4222-8222-222222222222'))
    expect(resolved.status).toBe('dismissed')
    expect(resolved.resolutionNote).not.toBeNull()
  })

  it('refuses a decision without a usable note', async () => {
    await seedOpenReports()

    await expect(
      resolveListingReportQuery(adminActor(), {
        reportId: '11111111-1111-4111-8111-111111111111',
        targetType: 'product',
        outcome: 'dismissed',
        note: '<script></script>',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('never rewrites a recorded decision', async () => {
    await seedOpenReports()
    await resolveListingReportQuery(adminActor(), {
      reportId: '11111111-1111-4111-8111-111111111111',
      targetType: 'product',
      outcome: 'dismissed',
      note: 'First decision.',
    })

    await expect(
      resolveListingReportQuery(adminActor(), {
        reportId: '11111111-1111-4111-8111-111111111111',
        targetType: 'product',
        outcome: 'actioned',
        note: 'Second thoughts.',
      }),
    ).rejects.toMatchObject({ status: 409 })

    const [unchanged] = await db
      .select()
      .from(productReport)
      .where(eq(productReport.id, '11111111-1111-4111-8111-111111111111'))
    expect(unchanged.status).toBe('dismissed')
    expect(unchanged.resolutionNote).toBe('First decision.')
  })

  it('answers 404 for a report that does not exist', async () => {
    await expect(
      resolveListingReportQuery(adminActor(), {
        reportId: '33333333-3333-4333-8333-333333333333',
        targetType: 'shop',
        outcome: 'dismissed',
        note: 'Nothing there.',
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('refuses non-admin callers', async () => {
    await seedOpenReports()
    await expect(
      resolveListingReportQuery(customerActor(), {
        reportId: '11111111-1111-4111-8111-111111111111',
        targetType: 'product',
        outcome: 'actioned',
        note: 'Escalation attempt.',
      }),
    ).rejects.toBeInstanceOf(AuthError)

    const [untouched] = await db
      .select()
      .from(productReport)
      .where(eq(productReport.id, '11111111-1111-4111-8111-111111111111'))
      .limit(1)
    expect(untouched?.status).toBe('open')
  })
})
