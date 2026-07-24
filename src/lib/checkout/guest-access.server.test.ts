import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import { emailOutbox, guestOrderAccess, platformOrder } from '#/db/schema'
import { decrypt } from '#/lib/encryption.server'
import { sha256Hex } from '#/lib/hash.server'
import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'
import { createPaidOrder } from '#/test/scenarios'
import {
  canAccessOrder,
  claimGuestOrdersForVerifiedUser,
  exchangeGuestOrderAccessToken,
  GUEST_ORDER_ACCESS_COOKIE,
  issueGuestOrderAccess,
} from './guest-access.server'

const { setCookie } = vi.hoisted(() => ({ setCookie: vi.fn() }))
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: vi.fn(() => undefined),
  getRequestProtocol: vi.fn(() => 'https'),
  setCookie: (...args: unknown[]) => setCookie(...args),
}))

describe('guest order access', () => {
  beforeEach(async () => {
    setCookie.mockClear()
    await clearTestTables()
  })
  afterEach(clearTestTables)

  it('stores only hashes and encrypted delivery data when issuing an access link', async () => {
    const scenario = await createPaidOrder()

    await issueGuestOrderAccess({
      platformOrderId: scenario.platformOrder.id,
      orderNumber: scenario.platformOrder.orderNumber,
      email: ' Guest@example.com ',
      buyerName: 'Guest Buyer',
    })

    const [access] = await db
      .select()
      .from(guestOrderAccess)
      .where(eq(guestOrderAccess.platformOrderId, scenario.platformOrder.id))
    expect(access).toBeDefined()
    expect(access?.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(access?.emailHash).toMatch(/^[a-f0-9]{64}$/)
    expect(access?.expiresAt.getTime()).toBeGreaterThan(Date.now())

    const [outbox] = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.template, 'guest_order_access'))
    const data = outbox?.data as Record<string, unknown>
    expect(outbox?.userId).toBeNull()
    expect(outbox?.recipientEmail).not.toContain('guest@example.com')
    expect(data.accessUrl).toBeUndefined()
    expect(data.encryptedAccessToken).toEqual(expect.any(String))
    expect(JSON.stringify(data)).not.toContain('guest-order-access?token=')
  })

  it('claims only matching guest orders for a verified user', async () => {
    const scenario = await createPaidOrder()
    const verifiedUser = await createUser({
      email: 'verified@example.com',
      emailVerified: true,
    })
    await db
      .update(platformOrder)
      .set({
        userId: verifiedUser.id,
        isGuest: true,
        buyerEmailHash: await sha256Hex('verified@example.com'),
      })
      .where(eq(platformOrder.id, scenario.platformOrder.id))
    await issueGuestOrderAccess({
      platformOrderId: scenario.platformOrder.id,
      orderNumber: scenario.platformOrder.orderNumber,
      email: 'verified@example.com',
      buyerName: 'Guest Buyer',
    })

    await expect(canAccessOrder(scenario.platformOrder.id, verifiedUser.id)).resolves.toBe(false)
    await expect(
      claimGuestOrdersForVerifiedUser({
        userId: verifiedUser.id,
        email: 'different@example.com',
      }),
    ).resolves.toBe(0)
    await expect(
      claimGuestOrdersForVerifiedUser({
        userId: verifiedUser.id,
        email: 'verified@example.com',
      }),
    ).resolves.toBe(1)

    const [claimed] = await db
      .select({ userId: platformOrder.userId, isGuest: platformOrder.isGuest })
      .from(platformOrder)
      .where(eq(platformOrder.id, scenario.platformOrder.id))
    expect(claimed).toEqual({ userId: verifiedUser.id, isGuest: false })
    await expect(canAccessOrder(scenario.platformOrder.id, verifiedUser.id)).resolves.toBe(true)
    expect(
      await db
        .select()
        .from(guestOrderAccess)
        .where(eq(guestOrderAccess.platformOrderId, scenario.platformOrder.id)),
    ).toHaveLength(0)
  })

  it('exchanges a valid token for an order-scoped secure cookie', async () => {
    const scenario = await createPaidOrder()
    await issueGuestOrderAccess({
      platformOrderId: scenario.platformOrder.id,
      orderNumber: scenario.platformOrder.orderNumber,
      email: 'guest@example.com',
      buyerName: 'Guest Buyer',
    })
    const [outbox] = await db
      .select({ data: emailOutbox.data })
      .from(emailOutbox)
      .where(eq(emailOutbox.template, 'guest_order_access'))
    const encryptedToken = (outbox?.data as Record<string, unknown>).encryptedAccessToken
    expect(encryptedToken).toEqual(expect.any(String))

    const platformOrderId = await exchangeGuestOrderAccessToken(decrypt(encryptedToken as string))

    expect(platformOrderId).toBe(scenario.platformOrder.id)
    expect(setCookie).toHaveBeenCalledWith(
      GUEST_ORDER_ACCESS_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }),
    )
  })
})
