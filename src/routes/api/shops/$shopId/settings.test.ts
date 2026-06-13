import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import { shop, user } from '#/db/schema'
import { Route } from './settings'

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

const handlers = (
  Route.options.server as {
    handlers: {
      GET: (ctx: { request: Request; params: { shopId: string } }) => Promise<Response>
      PATCH: (ctx: { request: Request; params: { shopId: string } }) => Promise<Response>
    }
  }
).handlers

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

describe('GET /api/shops/$shopId/settings', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.delete(shop)
    await db.delete(user)
  })

  it('returns shop details for the owner', async () => {
    await seedUser()
    await seedShop({ description: 'A lovely shop' })

    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'creator' },
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings')
    const res = await handlers.GET({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('shop-1')
    expect(body.name).toBe('Test Shop')
    expect(body.slug).toBe('test-shop')
    expect(body.description).toBe('A lovely shop')
  })

  it('returns 403 when shop does not exist', async () => {
    await seedUser()

    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'creator' },
    })

    const req = new Request('http://localhost:3000/api/shops/missing-shop/settings')
    const res = await handlers.GET({ request: req, params: { shopId: 'missing-shop' } })

    expect(res.status).toBe(403)
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

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings')
    const res = await handlers.GET({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(403)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null)

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings')
    const res = await handlers.GET({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/shops/$shopId/settings', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.delete(shop)
    await db.delete(user)
  })

  it('updates and returns the shop for the owner', async () => {
    await seedUser()
    await seedShop()

    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'creator' },
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'Updated Shop' }),
    })
    const res = await handlers.PATCH({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated Shop')
    expect(body.slug).toBe('test-shop')
  })

  it('returns 400 on invalid body', async () => {
    await seedUser()
    await seedShop()

    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'creator' },
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ slug: 'Invalid Slug!' }),
    })
    const res = await handlers.PATCH({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(400)
  })

  it('returns 409 on slug collision', async () => {
    await seedUser()
    await seedShop({ id: 'shop-1', slug: 'test-shop' })
    await db.insert(shop).values({
      id: 'shop-2',
      name: 'Other Shop',
      slug: 'taken-slug',
      ownerId: 'user-1',
    })

    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user-1', role: 'creator' },
    })

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ slug: 'taken-slug' }),
    })
    const res = await handlers.PATCH({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Conflict')
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

    const req = new Request('http://localhost:3000/api/shops/shop-1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'Updated Shop' }),
    })
    const res = await handlers.PATCH({ request: req, params: { shopId: 'shop-1' } })

    expect(res.status).toBe(403)
  })
})
