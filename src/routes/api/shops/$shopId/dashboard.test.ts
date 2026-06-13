import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import { platformOrder, product, shop, shopOrder, user } from '#/db/schema'
import { Route } from './dashboard'

const mockGetSession = vi.fn()

vi.mock('#/lib/auth', () => ({
  auth: {
    api: {
      get getSession() {
        return mockGetSession
      },
    },
  },
}))

const getHandler = (
  Route.options.server as {
    handlers: { GET: (ctx: { request: Request; params: { shopId: string } }) => Promise<Response> }
  }
).handlers.GET

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Creator',
      email: 'creator@example.com',
      emailVerified: true,
      role: 'creator',
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

async function seedBuyer() {
  return db
    .insert(user)
    .values({
      id: 'buyer-1',
      name: 'Test Buyer',
      email: 'buyer@example.com',
      emailVerified: true,
      role: 'customer',
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPlatformOrder(buyerId: string) {
  return db
    .insert(platformOrder)
    .values({
      userId: buyerId,
      shippingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      },
      billingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      },
      totalCents: 1000,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(overrides?: Partial<typeof shopOrder.$inferInsert>) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId: 'placeholder',
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

describe('GET /api/shops/$shopId/dashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
  })

  it('returns real per-shop metrics for the owner', async () => {
    await seedUser()
    await seedShop()
    await seedProduct({ stockCount: 3, isActive: true })
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)
    await seedShopOrder({ platformOrderId: po.id, status: 'paid', subtotalCents: 5000 })

    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'creator' },
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/dashboard')
    const res = await getHandler({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      pendingOrdersCount: 1,
      lowStockProductCount: 1,
      revenueThisMonthCents: 5000,
      totalActiveProducts: 1,
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null)

    const req = new Request('http://localhost:3000/api/shops/shop-1/dashboard')
    const res = await getHandler({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-owner creator', async () => {
    await seedUser()
    await seedShop()
    await db.insert(user).values({
      id: 'user-2',
      name: 'Other Creator',
      email: 'other@example.com',
      emailVerified: true,
      role: 'creator',
    })

    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user-2', role: 'creator' },
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/dashboard')
    const res = await getHandler({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(403)
  })
})
