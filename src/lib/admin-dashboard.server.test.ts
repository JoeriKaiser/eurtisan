import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { auditLog, platformOrder, shop, user } from '#/db/schema'
import {
  getAdminDashboardStatsQuery,
  getDashboardTrendsQuery,
  getRecentAuditEntriesQuery,
  getRecentOrdersQuery,
  getRecentSignupsQuery,
} from './admin-dashboard.server'

beforeEach(async () => {
  await db.delete(auditLog)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
})

describe('admin-dashboard.server', () => {
  describe('getAdminDashboardStatsQuery', () => {
    it('returns zeros when database is empty', async () => {
      const stats = await getAdminDashboardStatsQuery()
      expect(stats.totalUsers).toBe(0)
      expect(stats.activeShops).toBe(0)
      expect(stats.openDisputes).toBe(0)
      expect(stats.pendingPayouts).toBe(0)
    })

    it('counts active shops (non-suspended)', async () => {
      await db.insert(user).values({
        id: 'u-1',
        name: 'Alice',
        email: 'alice@test.com',
        role: 'creator',
      })
      await db.insert(shop).values({
        id: 's-1',
        ownerId: 'u-1',
        name: 'Shop One',
        slug: 'shop-one',
        isSuspended: false,
      })
      await db.insert(shop).values({
        id: 's-2',
        ownerId: 'u-1',
        name: 'Shop Two',
        slug: 'shop-two',
        isSuspended: true,
      })

      const stats = await getAdminDashboardStatsQuery()
      expect(stats.totalUsers).toBe(1)
      expect(stats.activeShops).toBe(1)
    })
  })

  describe('getRecentSignupsQuery', () => {
    it('returns empty array when no users', async () => {
      const signups = await getRecentSignupsQuery(5)
      expect(signups).toEqual([])
    })

    it('returns most recent signups ordered newest first', async () => {
      await db.insert(user).values({
        id: 'u-old',
        name: 'Old',
        email: 'old@test.com',
        role: 'customer',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
      await db.insert(user).values({
        id: 'u-new',
        name: 'New',
        email: 'new@test.com',
        role: 'customer',
        createdAt: new Date('2026-05-01T00:00:00Z'),
      })

      const signups = await getRecentSignupsQuery(5)
      expect(signups).toHaveLength(2)
      expect(signups[0].id).toBe('u-new')
      expect(signups[1].id).toBe('u-old')
    })
  })

  describe('getRecentOrdersQuery', () => {
    it('returns empty array when no orders', async () => {
      const orders = await getRecentOrdersQuery(5)
      expect(orders).toEqual([])
    })

    it('returns recent orders ordered newest first', async () => {
      await db.insert(user).values({
        id: 'u-1',
        name: 'Alice',
        email: 'alice@test.com',
        role: 'customer',
      })
      const [ord1] = await db
        .insert(platformOrder)
        .values({
          userId: 'u-1',
          status: 'paid',
          totalCents: 1000,
          shippingAddress: {},
          billingAddress: {},
          createdAt: new Date('2026-01-01T00:00:00Z'),
        })
        .returning()
      const [ord2] = await db
        .insert(platformOrder)
        .values({
          userId: 'u-1',
          status: 'shipped',
          totalCents: 2000,
          shippingAddress: {},
          billingAddress: {},
          createdAt: new Date('2026-05-01T00:00:00Z'),
        })
        .returning()

      const orders = await getRecentOrdersQuery(5)
      expect(orders).toHaveLength(2)
      expect(orders[0].id).toBe(ord2.id)
      expect(orders[1].id).toBe(ord1.id)
    })
  })

  describe('getDashboardTrendsQuery', () => {
    it('returns 30 days of zeroes when database is empty', async () => {
      const trends = await getDashboardTrendsQuery(30)
      expect(trends.signups).toHaveLength(30)
      expect(trends.revenue).toHaveLength(30)
      expect(trends.orders).toHaveLength(30)
      expect(trends.disputes).toHaveLength(30)
      expect(trends.signups.every((d) => d.value === 0)).toBe(true)
      expect(trends.revenue.every((d) => d.value === 0)).toBe(true)
    })

    it('includes non-zero values for days with data', async () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      await db.insert(user).values({
        id: 'u-today',
        name: 'Today',
        email: 'today@test.com',
        role: 'customer',
        createdAt: today,
      })

      const trends = await getDashboardTrendsQuery(30)
      expect(trends.signups).toHaveLength(30)
      expect(trends.signups.some((d) => d.value > 0)).toBe(true)
    })
  })

  describe('getRecentAuditEntriesQuery', () => {
    it('returns empty array when no audit entries', async () => {
      const entries = await getRecentAuditEntriesQuery(5)
      expect(entries).toEqual([])
    })

    it('returns most recent audit entries ordered newest first', async () => {
      await db.insert(user).values({
        id: 'u-audit',
        name: 'Audit',
        email: 'audit@test.com',
        role: 'admin',
      })
      await db.insert(auditLog).values({
        actorId: 'u-audit',
        actorName: 'Old Admin',
        action: 'shop.approve',
        resourceType: 'shop',
        resourceId: 's-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
      await db.insert(auditLog).values({
        actorId: 'u-audit',
        actorName: 'New Admin',
        action: 'shop.suspend',
        resourceType: 'shop',
        resourceId: 's-2',
        createdAt: new Date('2026-05-01T00:00:00Z'),
      })

      const entries = await getRecentAuditEntriesQuery(5)
      expect(entries).toHaveLength(2)
      expect(entries[0].actorName).toBe('New Admin')
      expect(entries[1].actorName).toBe('Old Admin')
    })
  })
})
