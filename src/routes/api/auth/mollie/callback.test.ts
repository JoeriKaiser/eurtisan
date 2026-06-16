import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import { shop } from '#/db/schema'
import { signMollieState, verifyMollieState } from '#/lib/auth-utils'
import { clearTestTables } from '#/test/cleanup'
import { createShop, createUser } from '#/test/factories'
import { Route } from './callback'

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

async function seedUser(id: string) {
  return createUser({ id, name: 'Owner', email: `${id}@example.com` })
}

async function seedShop(id: string, ownerId: string) {
  return createShop(ownerId, { id, name: 'Test Shop', slug: `test-shop-${id}` })
}

describe('Mollie Connect OAuth Callback', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    await clearTestTables()
  })

  describe('Cryptographic State Helpers', () => {
    it('generates a signed state and successfully verifies it', () => {
      const shopId = 'shop-123'
      const userId = 'user-456'
      const state = signMollieState(shopId, userId)

      expect(state).toContain(shopId)
      expect(state).toContain(userId)

      const verifiedShopId = verifyMollieState(state, userId)
      expect(verifiedShopId).toBe(shopId)
    })

    it('fails verification if the user ID does not match', () => {
      const state = signMollieState('shop-123', 'user-456')
      const verifiedShopId = verifyMollieState(state, 'user-attacker')
      expect(verifiedShopId).toBeNull()
    })

    it('fails verification if the state signature is tampered', () => {
      const state = signMollieState('shop-123', 'user-456')
      const tampered = state.replace('user-456', 'user-457')
      const verifiedShopId = verifyMollieState(tampered, 'user-456')
      expect(verifiedShopId).toBeNull()
    })

    it('fails verification if the state token has expired', () => {
      const state = signMollieState('shop-123', 'user-456')
      // verify with maxAgeMs = -1 (expired instantly)
      const verifiedShopId = verifyMollieState(state, 'user-456', -1)
      expect(verifiedShopId).toBeNull()
    })
  })

  describe('GET Handler', () => {
    const getHandler = (
      Route.options.server as {
        handlers: { GET: (ctx: { request: Request }) => Promise<Response> }
      }
    ).handlers.GET

    it('returns 400 if code or state is missing', async () => {
      const reqEmpty = new Request('https://eurtisan.eu/api/auth/mollie/callback')
      const resEmpty = await getHandler({ request: reqEmpty })
      expect(resEmpty.status).toBe(400)

      const reqNoState = new Request('https://eurtisan.eu/api/auth/mollie/callback?code=123')
      const resNoState = await getHandler({ request: reqNoState })
      expect(resNoState.status).toBe(400)
    })

    it('returns 401 if user is not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce(null)

      const req = new Request('https://eurtisan.eu/api/auth/mollie/callback?code=123&state=abc')
      const res = await getHandler({ request: req })

      expect(res.status).toBe(401)
    })

    it('returns 403 if the state parameter is invalid/not matching user', async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: 'user-auth' },
      })

      // Generates state for user-other, verified against user-auth -> should fail
      const state = signMollieState('shop-123', 'user-other')
      const req = new Request(
        `https://eurtisan.eu/api/auth/mollie/callback?code=123&state=${encodeURIComponent(state)}`,
      )
      const res = await getHandler({ request: req })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Forbidden')
    })

    it('returns 404 if the shop does not exist', async () => {
      mockGetSession.mockResolvedValueOnce({
        user: { id: 'user-auth' },
      })

      const state = signMollieState('shop-nonexistent', 'user-auth')
      const req = new Request(
        `https://eurtisan.eu/api/auth/mollie/callback?code=123&state=${encodeURIComponent(state)}`,
      )
      const res = await getHandler({ request: req })

      expect(res.status).toBe(404)
    })

    it('returns 403 if the user does not own the shop and is not admin', async () => {
      // Seed a user
      await seedUser('user-owner')
      // Seed a shop owned by user-owner
      await seedShop('shop-123', 'user-owner')

      mockGetSession.mockResolvedValueOnce({
        user: { id: 'user-attacker', role: 'creator' },
      })

      const state = signMollieState('shop-123', 'user-attacker')
      const req = new Request(
        `https://eurtisan.eu/api/auth/mollie/callback?code=123&state=${encodeURIComponent(state)}`,
      )
      const res = await getHandler({ request: req })

      expect(res.status).toBe(403)
    })

    it('returns 502 when Mollie Connect credentials are missing', async () => {
      await seedUser('user-owner')
      await seedShop('shop-123', 'user-owner')

      mockGetSession.mockResolvedValueOnce({
        user: { id: 'user-owner', role: 'creator' },
      })

      const state = signMollieState('shop-123', 'user-owner')
      const req = new Request(
        `https://eurtisan.eu/api/auth/mollie/callback?code=123&state=${encodeURIComponent(state)}`,
      )
      const res = await getHandler({ request: req })

      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error).toBe('Bad Gateway')
    })

    it('connects payouts and redirects successfully when user owns the shop', async () => {
      await seedUser('user-owner')
      await seedShop('shop-123', 'user-owner')

      mockGetSession.mockResolvedValueOnce({
        user: { id: 'user-owner', role: 'creator' },
      })

      vi.stubEnv('MOLLIE_CLIENT_ID', 'test-client-id')
      vi.stubEnv('MOLLIE_CLIENT_SECRET', 'test-client-secret')

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            organization_id: 'org_12345',
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const state = signMollieState('shop-123', 'user-owner')
      const req = new Request(
        `https://eurtisan.eu/api/auth/mollie/callback?code=123&state=${encodeURIComponent(state)}`,
      )
      const res = await getHandler({ request: req })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toContain(
        '/creator/payouts?shopId=shop-123&success=mollie_connected',
      )

      // Verify DB was updated
      const [updatedShop] = await db.select().from(shop).where(eq(shop.id, 'shop-123'))
      expect(updatedShop.paymentConnected).toBe(true)
      expect(updatedShop.mollieAccountId).toBe('org_12345')

      fetchSpy.mockRestore()
    })

    it('connects payouts and redirects successfully if user is admin (even if not owner)', async () => {
      await seedUser('user-owner')
      await seedShop('shop-123', 'user-owner')

      mockGetSession.mockResolvedValueOnce({
        user: { id: 'user-admin', role: 'admin' },
      })

      vi.stubEnv('MOLLIE_CLIENT_ID', 'test-client-id')
      vi.stubEnv('MOLLIE_CLIENT_SECRET', 'test-client-secret')

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            organization_id: 'org_67890',
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const state = signMollieState('shop-123', 'user-admin')
      const req = new Request(
        `https://eurtisan.eu/api/auth/mollie/callback?code=123&state=${encodeURIComponent(state)}`,
      )
      const res = await getHandler({ request: req })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toContain(
        '/creator/payouts?shopId=shop-123&success=mollie_connected',
      )

      // Verify DB was updated
      const [updatedShop] = await db.select().from(shop).where(eq(shop.id, 'shop-123'))
      expect(updatedShop.paymentConnected).toBe(true)
      expect(updatedShop.mollieAccountId).toBe('org_67890')

      fetchSpy.mockRestore()
    })
  })
})
