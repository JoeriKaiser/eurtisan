import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTestTables } from '#/test/cleanup'
import {
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import { Route } from './dashboard'

const mockGetSession = vi.fn()

vi.mock('#/lib/auth/config.server', () => ({
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

async function seedUser() {
  return createUser({
    id: 'user-1',
    name: 'Test Creator',
    email: 'creator@example.com',
    role: 'creator',
  })
}

async function seedShop() {
  return createShop('user-1', { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' })
}

async function seedProduct(overrides?: Parameters<typeof createProduct>[1]) {
  return createProduct('shop-1', { id: 'prod-1', name: 'Vase', slug: 'vase', ...overrides })
}

async function seedBuyer() {
  return createUser({
    id: 'buyer-1',
    name: 'Test Buyer',
    email: 'buyer@example.com',
    role: 'customer',
  })
}

async function seedPlatformOrder(buyerId: string) {
  return createPlatformOrder(buyerId, {
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
}

async function seedShopOrder(overrides?: Parameters<typeof createShopOrder>[2]) {
  return createShopOrder('placeholder', 'shop-1', {
    shippingMethod: 'standard',
    shippingCostCents: 100,
    subtotalCents: 900,
    status: 'paid',
    ...overrides,
  })
}

describe('GET /api/shops/$shopId/dashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearTestTables()
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
      netRevenueThisMonthCents: 4500,
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
    await createUser({
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
