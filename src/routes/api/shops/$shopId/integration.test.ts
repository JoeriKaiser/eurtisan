import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'

vi.mock('#/lib/auth/config.server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('#/db/index', () => ({
  db: {
    query: {
      shop: {
        findFirst: vi.fn(),
      },
    },
  },
}))

import { db } from '#/db/index'
import { auth } from '#/lib/auth'

const mockGetSession = auth.api.getSession as unknown as ReturnType<typeof vi.fn>
const mockFindFirst = db.query.shop.findFirst as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

function makeUser(role: string, id = 'user-1') {
  return {
    id,
    name: 'Test',
    email: `${id}@test.com`,
    emailVerified: true,
    image: null,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeSession(userId: string) {
  return {
    id: 'session-1',
    token: 'tok-1',
    expiresAt: new Date(Date.now() + 3600_000),
    userId,
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('GET /api/shops/:shopId/dashboard (read scope)', () => {
  const dashboardHandler = async () =>
    new Response(JSON.stringify({ message: 'Dashboard data' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/dashboard'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      dashboardHandler,
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 for customer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('customer'),
      session: makeSession('user-1'),
    })

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/dashboard'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      dashboardHandler,
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 for creator without ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-2'),
      session: makeSession('user-2'),
    })
    mockFindFirst.mockResolvedValue(undefined)

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/dashboard'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      dashboardHandler,
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.message).toContain('Shop not found')
  })

  it('returns 200 for creator with ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-1'),
      session: makeSession('user-1'),
    })
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/dashboard'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      dashboardHandler,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toBe('Dashboard data')
  })

  it('returns 200 for admin without ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('admin', 'admin-1'),
      session: makeSession('admin-1'),
    })

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/dashboard'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      dashboardHandler,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toBe('Dashboard data')
  })
})

describe('PATCH /api/shops/:shopId/settings (update scope)', () => {
  const makeSettingsHandler = (req: Request) => async () => {
    const body = await req.json().catch(() => ({}))
    return new Response(JSON.stringify({ message: 'Settings updated', data: body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeSettingsHandler(req),
    )

    expect(response.status).toBe(401)
  })

  it('returns 403 for customer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('customer'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeSettingsHandler(req),
    )

    expect(response.status).toBe(403)
  })

  it('returns 200 for creator with ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-1'),
      session: makeSession('user-1'),
    })
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeSettingsHandler(req),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toBe('Settings updated')
  })
})

describe('POST /api/shops/:shopId/products (create scope)', () => {
  const makeProductsHandler = (req: Request) => async () => {
    const body = await req.json().catch(() => ({}))
    return new Response(JSON.stringify({ message: 'Product created', product: body }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/shops/shop-1/products', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Product' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeProductsHandler(req),
    )

    expect(response.status).toBe(401)
  })

  it('returns 403 for customer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('customer'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/products', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Product' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeProductsHandler(req),
    )

    expect(response.status).toBe(403)
  })

  it('returns 201 for creator with ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-1'),
      session: makeSession('user-1'),
    })
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/products', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Product' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeProductsHandler(req),
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.message).toBe('Product created')
  })
})

describe('PATCH /api/shops/:shopId/products/:productId (update scope)', () => {
  const makeUpdateProductHandler = (req: Request) => async () => {
    const body = await req.json().catch(() => ({}))
    return new Response(JSON.stringify({ message: 'Product updated', data: body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeUpdateProductHandler(req),
    )

    expect(response.status).toBe(401)
  })

  it('returns 403 for customer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('customer'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeUpdateProductHandler(req),
    )

    expect(response.status).toBe(403)
  })

  it('returns 403 for creator without ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-2'),
      session: makeSession('user-2'),
    })
    mockFindFirst.mockResolvedValue(undefined)

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeUpdateProductHandler(req),
    )

    expect(response.status).toBe(403)
  })

  it('returns 200 for creator with ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-1'),
      session: makeSession('user-1'),
    })
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      makeUpdateProductHandler(req),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toBe('Product updated')
  })
})

describe('DELETE /api/shops/:shopId/products/:productId (delete scope)', () => {
  const deleteProductHandler = async () =>
    new Response(JSON.stringify({ message: 'Product deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1?hard=true', {
      method: 'DELETE',
      headers: { Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      deleteProductHandler,
    )

    expect(response.status).toBe(401)
  })

  it('returns 403 for customer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('customer'),
      session: makeSession('user-1'),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1?hard=true', {
      method: 'DELETE',
      headers: { Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      deleteProductHandler,
    )

    expect(response.status).toBe(403)
  })

  it('returns 403 for creator without ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-2'),
      session: makeSession('user-2'),
    })
    mockFindFirst.mockResolvedValue(undefined)

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1?hard=true', {
      method: 'DELETE',
      headers: { Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      deleteProductHandler,
    )

    expect(response.status).toBe(403)
  })

  it('returns 200 for creator with ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-1'),
      session: makeSession('user-1'),
    })
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/products/prod-1?hard=true', {
      method: 'DELETE',
      headers: { Origin: 'http://localhost:3000' },
    })

    const response = await authPipeline(
      req,
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      deleteProductHandler,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toBe('Product deleted')
  })
})

describe('GET /api/shops/:shopId/orders (read scope)', () => {
  const ordersHandler = async () =>
    new Response(JSON.stringify({ message: 'Order list', orders: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/orders'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      ordersHandler,
    )

    expect(response.status).toBe(401)
  })

  it('returns 403 for customer', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('customer'),
      session: makeSession('user-1'),
    })

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/orders'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      ordersHandler,
    )

    expect(response.status).toBe(403)
  })

  it('returns 200 for creator with ownership', async () => {
    mockGetSession.mockResolvedValue({
      user: makeUser('creator', 'user-1'),
      session: makeSession('user-1'),
    })
    mockFindFirst.mockResolvedValue({
      id: 'shop-1',
      name: 'Test Shop',
      description: null,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const response = await authPipeline(
      new Request('http://localhost/api/shops/shop-1/orders'),
      [requireRole('creator'), (ctx) => requireShopOwnership(ctx, 'shop-1')],
      ordersHandler,
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toBe('Order list')
  })
})
