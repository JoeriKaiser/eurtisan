import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop, type shop as shopSchema } from '#/db/schema'
import { decryptIfEncrypted, encrypt } from './encryption.server'
import { getMollieClientId, getMollieClientSecret } from './env.server'
import { logger } from './logger.server'
import { writeAuditLog, type AuditActor } from './audit-logger'
export type { AuditActor }

export type Shop = typeof shopSchema.$inferSelect

const MOLLIE_OAUTH_BASE = 'https://api.mollie.com/oauth2'
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

interface MollieTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS) <= new Date()
}

/**
 * Refreshes a shop's Mollie Connect tokens and persists the new values.
 *
 * Returns the decrypted access token. If the refresh fails (including because
 * the merchant revoked the grant at Mollie), the shop's payment connection is
 * marked as disconnected and an error is thrown.
 */
export async function refreshMollieConnectTokens(
  shopId: string,
  tx?: Omit<typeof db, '$client'>,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const activeDb = tx ?? db

  const [shopRecord] = await activeDb
    .select({
      id: shop.id,
      mollieRefreshToken: shop.mollieRefreshToken,
      mollieTokenExpiresAt: shop.mollieTokenExpiresAt,
    })
    .from(shop)
    .where(eq(shop.id, shopId))
    .for('update')
    .limit(1)

  if (!shopRecord) {
    throw new Error(`Shop ${shopId} not found`)
  }

  const refreshToken = decryptIfEncrypted(shopRecord.mollieRefreshToken)
  if (!refreshToken) {
    await clearMollieConnectTokens(activeDb, shopId)
    throw new Error(`No Mollie refresh token available for shop ${shopId}`)
  }

  const clientId = getMollieClientId()
  const clientSecret = getMollieClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Mollie Connect client credentials are not configured')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(`${MOLLIE_OAUTH_BASE}/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body,
  })

  if (!response.ok) {
    const responseBody = await response.text()
    logger.error('Mollie Connect token refresh failed', new Error(responseBody), {
      alert: true,
      shopId,
      status: response.status,
    })

    // If Mollie reports the grant is invalid, the merchant disconnected us.
    if (response.status === 400 && responseBody.includes('invalid_grant')) {
      await clearMollieConnectTokens(activeDb, shopId)
      throw new Error('Mollie connection was revoked by the merchant')
    }

    throw new Error(`Mollie Connect token refresh failed (${response.status})`)
  }

  const data = (await response.json()) as MollieTokenResponse
  const accessToken = data.access_token
  const newRefreshToken = data.refresh_token ?? refreshToken

  if (!accessToken) {
    throw new Error('Mollie Connect token refresh response missing access_token')
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : new Date(Date.now() + 3600 * 1000)

  await activeDb
    .update(shop)
    .set({
      mollieAccessToken: encrypt(accessToken),
      mollieRefreshToken: encrypt(newRefreshToken),
      mollieTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(shop.id, shopId))

  return { accessToken, expiresAt }
}

/**
 * Returns a valid Mollie Connect access token for the shop, refreshing it
 * automatically when it is missing or about to expire.
 */
export async function ensureMollieAccessToken(shopId: string): Promise<string> {
  const [shopRecord] = await db
    .select({
      mollieAccessToken: shop.mollieAccessToken,
      mollieTokenExpiresAt: shop.mollieTokenExpiresAt,
    })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!shopRecord) {
    throw new Error(`Shop ${shopId} not found`)
  }

  const existing = decryptIfEncrypted(shopRecord.mollieAccessToken)
  if (existing && !isExpired(shopRecord.mollieTokenExpiresAt)) {
    return existing
  }

  const { accessToken } = await refreshMollieConnectTokens(shopId)
  return accessToken
}

async function clearMollieConnectTokens(
  activeDb: Omit<typeof db, '$client'>,
  shopId: string,
): Promise<void> {
  await activeDb
    .update(shop)
    .set({
      mollieAccessToken: null,
      mollieRefreshToken: null,
      mollieTokenExpiresAt: null,
      mollieAccountId: null,
      paymentConnected: false,
      updatedAt: new Date(),
    })
    .where(eq(shop.id, shopId))
}

async function revokeMollieToken(
  token: string,
  tokenTypeHint: 'access_token' | 'refresh_token',
): Promise<void> {
  const clientId = getMollieClientId()
  const clientSecret = getMollieClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Mollie Connect client credentials are not configured')
  }

  const response = await fetch(`${MOLLIE_OAUTH_BASE}/tokens`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      token_type_hint: tokenTypeHint,
      token,
    }),
  })

  if (!response.ok && response.status !== 401 && response.status !== 400) {
    const body = await response.text()
    throw new Error(`Mollie token revocation failed (${response.status}): ${body}`)
  }
}

export interface DisconnectMollieConnectInput {
  shopId: string
  actor: AuditActor
  actorRole?: string
}

/**
 * Disconnects a shop from Mollie Connect.
 *
 * Revokes the refresh token at Mollie (which invalidates all access tokens for
 * this authorization), clears the stored tokens, and writes an audit log entry.
 */
export async function disconnectMollieConnect(input: DisconnectMollieConnectInput): Promise<void> {
  const [shopRecord] = await db
    .select({
      id: shop.id,
      ownerId: shop.ownerId,
      mollieRefreshToken: shop.mollieRefreshToken,
      mollieAccessToken: shop.mollieAccessToken,
      paymentConnected: shop.paymentConnected,
    })
    .from(shop)
    .where(eq(shop.id, input.shopId))
    .limit(1)

  if (!shopRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (shopRecord.ownerId !== input.actor.id && input.actorRole !== 'admin') {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'You do not own this shop.' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  if (!shopRecord.paymentConnected) {
    return
  }

  const refreshToken = decryptIfEncrypted(shopRecord.mollieRefreshToken)
  const accessToken = decryptIfEncrypted(shopRecord.mollieAccessToken)

  try {
    // Revoking the refresh token invalidates all access tokens for the grant.
    if (refreshToken) {
      await revokeMollieToken(refreshToken, 'refresh_token')
    } else if (accessToken) {
      await revokeMollieToken(accessToken, 'access_token')
    }
  } catch (err) {
    logger.error('Mollie Connect token revocation failed during disconnect', err, {
      alert: true,
      shopId: input.shopId,
    })
    // Continue to clear local tokens even if Mollie's revocation fails.
  }

  await db.transaction(async (tx) => {
    await tx
      .update(shop)
      .set({
        mollieAccessToken: null,
        mollieRefreshToken: null,
        mollieTokenExpiresAt: null,
        mollieAccountId: null,
        paymentConnected: false,
        updatedAt: new Date(),
      })
      .where(eq(shop.id, input.shopId))

    await writeAuditLog({
      actor: input.actor,
      action: 'mollie_connect_disconnected',
      resourceType: 'shop',
      resourceId: input.shopId,
    })
  })
}
