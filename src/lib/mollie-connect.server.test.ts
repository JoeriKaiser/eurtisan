import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import { auditLog, shop } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createShop, createUser } from '#/test/factories'
import { encrypt } from './encryption.server'
import {
  disconnectMollieConnect,
  ensureMollieAccessToken,
  refreshMollieConnectTokens,
} from './mollie-connect.server'

describe('Mollie Connect token management', () => {
  const originalEnv: Record<string, string | undefined> = {}

  function setEnv(key: string, value: string | undefined) {
    if (!(key in originalEnv)) {
      originalEnv[key] = process.env[key]
    }
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  beforeEach(async () => {
    await clearTestTables()
    setEnv('MOLLIE_CLIENT_ID', 'test_client_id')
    setEnv('MOLLIE_CLIENT_SECRET', 'test_client_secret')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    for (const key of Object.keys(originalEnv)) {
      delete originalEnv[key]
    }
  })

  describe('refreshMollieConnectTokens', () => {
    it('throws and clears the connection when there is no refresh token', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, {
        paymentConnected: true,
        mollieRefreshToken: null,
      })

      await expect(refreshMollieConnectTokens(shopRecord.id)).rejects.toThrow(
        'No Mollie refresh token available',
      )

      const [updated] = await db.select().from(shop).where(eq(shop.id, shopRecord.id))
      expect(updated.paymentConnected).toBe(false)
      expect(updated.mollieAccessToken).toBeNull()
      expect(updated.mollieRefreshToken).toBeNull()
    })

    it('persists new tokens on a successful refresh', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, {
        paymentConnected: true,
        mollieRefreshToken: encrypt('old_refresh'),
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'new_access',
            refresh_token: 'new_refresh',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )

      const result = await refreshMollieConnectTokens(shopRecord.id)

      expect(result.accessToken).toBe('new_access')
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())

      const [updated] = await db.select().from(shop).where(eq(shop.id, shopRecord.id))
      expect(updated.mollieAccessToken).not.toBe('new_access')
      expect(updated.mollieRefreshToken).not.toBe('new_refresh')
      expect(updated.mollieTokenExpiresAt).toBeInstanceOf(Date)
    })

    it('clears the connection when Mollie reports an invalid grant', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, {
        paymentConnected: true,
        mollieRefreshToken: encrypt('stale_refresh'),
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
      )

      await expect(refreshMollieConnectTokens(shopRecord.id)).rejects.toThrow(
        'Mollie connection was revoked by the merchant',
      )

      const [updated] = await db.select().from(shop).where(eq(shop.id, shopRecord.id))
      expect(updated.paymentConnected).toBe(false)
      expect(updated.mollieRefreshToken).toBeNull()
      expect(updated.mollieAccessToken).toBeNull()
    })

    it('throws without clearing tokens on an unexpected refresh failure', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, {
        paymentConnected: true,
        mollieRefreshToken: encrypt('valid_refresh'),
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'server_error' }), { status: 500 }),
      )

      await expect(refreshMollieConnectTokens(shopRecord.id)).rejects.toThrow(
        'Mollie Connect token refresh failed (500)',
      )

      const [updated] = await db.select().from(shop).where(eq(shop.id, shopRecord.id))
      expect(updated.paymentConnected).toBe(true)
      expect(updated.mollieRefreshToken).not.toBeNull()
    })
  })

  describe('ensureMollieAccessToken', () => {
    it('returns a non-expired existing access token without calling Mollie', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, {
        paymentConnected: true,
        mollieAccessToken: encrypt('existing_access'),
        mollieTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })

      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const token = await ensureMollieAccessToken(shopRecord.id)

      expect(token).toBe('existing_access')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('refreshes the token when it is expired', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, {
        paymentConnected: true,
        mollieAccessToken: encrypt('expired_access'),
        mollieRefreshToken: encrypt('refresh_token'),
        mollieTokenExpiresAt: new Date(Date.now() - 1000),
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'refreshed_access',
            refresh_token: 'refresh_token',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )

      const token = await ensureMollieAccessToken(shopRecord.id)

      expect(token).toBe('refreshed_access')
    })
  })

  describe('disconnectMollieConnect', () => {
    it('throws 404 when the shop does not exist', async () => {
      await expect(
        disconnectMollieConnect({
          shopId: '00000000-0000-0000-0000-000000000000',
          actor: { id: 'user-1', name: 'Admin' },
          actorRole: 'admin',
        }),
      ).rejects.toMatchObject({ status: 404 })
    })

    it('throws 403 when the caller is neither the owner nor an admin', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const stranger = await createUser({ role: 'customer' })
      const shopRecord = await createShop(owner, { paymentConnected: true })

      await expect(
        disconnectMollieConnect({
          shopId: shopRecord.id,
          actor: { id: stranger.id, name: 'Stranger' },
        }),
      ).rejects.toMatchObject({ status: 403 })
    })

    it('is a no-op when the shop is not connected', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, { paymentConnected: false })

      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await disconnectMollieConnect({
        shopId: shopRecord.id,
        actor: { id: owner.id, name: owner.name },
      })

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('revokes the refresh token, clears stored tokens, and writes an audit log', async () => {
      const owner = await createUser({ role: 'creator', emailVerified: true })
      const shopRecord = await createShop(owner, {
        paymentConnected: true,
        mollieAccountId: 'org_test',
        mollieRefreshToken: encrypt('refresh_to_revoke'),
        mollieAccessToken: encrypt('access_to_revoke'),
        mollieTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 204 }))

      await disconnectMollieConnect({
        shopId: shopRecord.id,
        actor: { id: owner.id, name: owner.name },
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.mollie.com/oauth2/tokens',
        expect.objectContaining({
          method: 'DELETE',
        }),
      )

      const [updated] = await db.select().from(shop).where(eq(shop.id, shopRecord.id))
      expect(updated.paymentConnected).toBe(false)
      expect(updated.mollieAccountId).toBeNull()
      expect(updated.mollieAccessToken).toBeNull()
      expect(updated.mollieRefreshToken).toBeNull()
      expect(updated.mollieTokenExpiresAt).toBeNull()

      const logs = await db.select().from(auditLog).where(eq(auditLog.resourceId, shopRecord.id))
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('mollie_connect_disconnected')
    })
  })
})
