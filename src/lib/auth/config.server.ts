import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'

import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { getRequestProtocol } from '@tanstack/react-start/server'
import type { BetterAuthOptions, DBAdapter, Where } from 'better-auth'
import { APIError, betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { user } from '#/db/schema'
import { createEmailProvider } from '#/integrations/email'
import { safeRedirect } from './utils'
import { ANONYMOUS_SESSION_COOKIE } from '../cart-constants'
import { checkAuthEmailRateLimit } from '../email-rate-limit.server'
import { logEmailEvent } from '../email-send-log.server'
import { decryptAccountTokens, decryptTwoFactorSecrets, encrypt } from '../encryption.server'
import { getBaseUrl } from '../env.server'
import { sha256Hex } from '../hash.server'

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function transformSessionWhere(where: Where[]) {
  const tokenMap = new Map<string, string>()
  const newWhere = where.map((clause) => {
    if (clause.field === 'token') {
      const originalValue = clause.value
      if (clause.operator === 'in' && Array.isArray(originalValue)) {
        const hashedValues = originalValue.map((t) => {
          const hash = hashSessionToken(String(t))
          tokenMap.set(hash, String(t))
          return hash
        })
        return { ...clause, field: 'tokenHash', value: hashedValues }
      }
      const hash = hashSessionToken(String(originalValue))
      tokenMap.set(hash, String(originalValue))
      return { ...clause, field: 'tokenHash', value: hash }
    }
    return clause
  })
  return { newWhere, tokenMap }
}

function injectToken(result: Record<string, unknown> | null, tokenMap: Map<string, string>) {
  if (!result) return null
  const tokenHash = result.tokenHash
  if (tokenHash && typeof tokenHash === 'string' && tokenMap.has(tokenHash)) {
    return { ...result, token: tokenMap.get(tokenHash) }
  }
  return result
}

const ENCRYPTED_ACCOUNT_FIELDS = ['accessToken', 'refreshToken', 'idToken', 'password'] as const
const ENCRYPTED_TWO_FACTOR_FIELDS = ['secret', 'backupCodes'] as const

function encryptModelData(model: string, data: Record<string, unknown>): Record<string, unknown> {
  if (model !== 'account' && model !== 'two_factor') return data
  const fields = model === 'account' ? ENCRYPTED_ACCOUNT_FIELDS : ENCRYPTED_TWO_FACTOR_FIELDS
  const encrypted: Record<string, unknown> = { ...data }
  for (const field of fields) {
    const value = encrypted[field]
    if (typeof value === 'string' && value.length > 0) {
      encrypted[field] = encrypt(value)
    }
  }
  return encrypted
}

function decryptModelResult(
  model: string,
  result: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!result) return null
  if (model === 'account')
    return decryptAccountTokens(result as Parameters<typeof decryptAccountTokens>[0]) as Record<
      string,
      unknown
    >
  if (model === 'two_factor')
    return decryptTwoFactorSecrets(
      result as Parameters<typeof decryptTwoFactorSecrets>[0],
    ) as Record<string, unknown>
  return result
}

export function wrapAdapter(adapter: DBAdapter<BetterAuthOptions>): DBAdapter<BetterAuthOptions> {
  return {
    ...adapter,
    create: (async ({ model, data, select, forceAllowId }) => {
      if (
        model === 'session' &&
        data &&
        typeof data === 'object' &&
        'token' in data &&
        data.token
      ) {
        const originalToken = String(data.token)
        const newData = { ...data, token: null, tokenHash: hashSessionToken(originalToken) }
        const result = (await adapter.create({
          model,
          data: newData,
          select,
          forceAllowId,
        })) as Record<string, unknown>
        return { ...result, token: originalToken } as unknown as typeof result
      }
      if ((model === 'account' || model === 'two_factor') && data && typeof data === 'object') {
        const encrypted = encryptModelData(model, data as Record<string, unknown>)
        const result = (await adapter.create({
          model,
          data: encrypted,
          select,
          forceAllowId,
        })) as Record<string, unknown> | null
        return decryptModelResult(model, result) as unknown as typeof result
      }
      return adapter.create({ model, data, select, forceAllowId })
    }) as DBAdapter['create'],
    findOne: (async ({ model, where, select, join }) => {
      if (model === 'session' && where) {
        const { newWhere, tokenMap } = transformSessionWhere(where)
        const result = await adapter.findOne({ model, where: newWhere, select, join })
        return injectToken(
          result as Record<string, unknown> | null,
          tokenMap,
        ) as unknown as typeof result
      }
      if ((model === 'account' || model === 'two_factor') && where) {
        const result = await adapter.findOne({ model, where, select, join })
        return decryptModelResult(
          model,
          result as Record<string, unknown> | null,
        ) as unknown as typeof result
      }
      return adapter.findOne({ model, where, select, join })
    }) as DBAdapter['findOne'],
    findMany: (async ({ model, where, ...rest }) => {
      if (model === 'session' && where) {
        const { newWhere, tokenMap } = transformSessionWhere(where)
        const results = await adapter.findMany({ model, where: newWhere, ...rest })
        return results
          .map((r) => injectToken(r as Record<string, unknown>, tokenMap))
          .filter((r): r is NonNullable<typeof r> => r !== null) as unknown as typeof results
      }
      if (model === 'account' || model === 'two_factor') {
        const results = await adapter.findMany({ model, where, ...rest })
        return results
          .map((r) => decryptModelResult(model, r as Record<string, unknown>))
          .filter((r): r is NonNullable<typeof r> => r !== null) as unknown as typeof results
      }
      return adapter.findMany({ model, where, ...rest })
    }) as DBAdapter['findMany'],
    update: (async ({ model, where, update, ...rest }) => {
      if (model === 'session' && where) {
        const { newWhere, tokenMap } = transformSessionWhere(where)
        const result = await adapter.update({ model, where: newWhere, update, ...rest })
        return injectToken(
          result as Record<string, unknown> | null,
          tokenMap,
        ) as unknown as typeof result
      }
      if ((model === 'account' || model === 'two_factor') && where) {
        const encryptedUpdate = encryptModelData(model, update as Record<string, unknown>)
        const result = await adapter.update({
          model,
          where,
          update: encryptedUpdate,
          ...rest,
        })
        return decryptModelResult(
          model,
          result as Record<string, unknown> | null,
        ) as unknown as typeof result
      }
      return adapter.update({ model, where, update, ...rest })
    }) as DBAdapter['update'],
    updateMany: (async ({ model, where, update, ...rest }) => {
      if (model === 'session' && where) {
        const { newWhere } = transformSessionWhere(where)
        return adapter.updateMany({ model, where: newWhere, update, ...rest })
      }
      if (model === 'account' || model === 'two_factor') {
        const encryptedUpdate = encryptModelData(model, update as Record<string, unknown>)
        return adapter.updateMany({ model, where, update: encryptedUpdate, ...rest })
      }
      return adapter.updateMany({ model, where, update, ...rest })
    }) as DBAdapter['updateMany'],
    delete: (async ({ model, where, ...rest }) => {
      if (model === 'session' && where) {
        const { newWhere } = transformSessionWhere(where)
        return adapter.delete({ model, where: newWhere, ...rest })
      }
      return adapter.delete({ model, where, ...rest })
    }) as DBAdapter['delete'],
    deleteMany: (async ({ model, where, ...rest }) => {
      if (model === 'session' && where) {
        const { newWhere } = transformSessionWhere(where)
        return adapter.deleteMany({ model, where: newWhere, ...rest })
      }
      return adapter.deleteMany({ model, where, ...rest })
    }) as DBAdapter['deleteMany'],
    consumeOne: adapter.consumeOne,
    count: adapter.count,
  } as DBAdapter<BetterAuthOptions>
}

const baseDrizzleAdapter = drizzleAdapter(db, {
  provider: 'pg',
})

async function sendAuthEmail(
  email: string,
  template: 'password_reset' | 'email_verification',
  data: Record<string, unknown>,
): Promise<void> {
  const rateLimit = await checkAuthEmailRateLimit(email, template)
  if (!rateLimit.allowed) {
    // Silently no-op: do not leak whether the address exists.
    return
  }

  const provider = createEmailProvider()
  const recipientHash = await sha256Hex(email.toLowerCase())

  try {
    const result = await provider.sendTransactional(email, template, data)
    await logEmailEvent({
      recipientHash,
      template,
      category: 'account_security',
      provider: provider.name,
      providerMessageId: result.messageId,
      status: 'accepted',
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    await logEmailEvent({
      recipientHash,
      template,
      category: 'account_security',
      provider: provider.name,
      status: 'failed',
      statusDetail: detail,
    })
    throw err
  }
}

export const betterAuthOptions = {
  database: (options: Parameters<typeof baseDrizzleAdapter>[0]) => {
    const adapter = baseDrizzleAdapter(options)
    return wrapAdapter(adapter as DBAdapter<BetterAuthOptions>)
  },
  trustedOrigins: [getBaseUrl()],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail(user.email, 'password_reset', {
        userName: user.name,
        resetUrl: url,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      const parsedUrl = new URL(url)
      const searchParams = parsedUrl.searchParams
      const callbackURL = safeRedirect(searchParams.get('callbackURL'))
      const verificationUrl = `${parsedUrl.origin}/verify-email?token=${token}&redirect=${encodeURIComponent(callbackURL)}`

      await sendAuthEmail(user.email, 'email_verification', {
        userName: user.name,
        verificationUrl,
      })
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'customer',
      },
      twoFactorEnabled: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    additionalFields: {
      tokenHash: {
        type: 'string',
        required: false,
      },
    },
  },
  // Disable Better Auth's built-in request rate limiting in development and
  // test environments. This prevents E2E and Vitest runs from being blocked by
  // sign-in rate limits when multiple auth setups run in quick succession.
  // Production keeps the default rate limit behavior.
  rateLimit:
    typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
      ? { enabled: false }
      : undefined,
  plugins: [
    tanstackStartCookies(),
    twoFactor({
      issuer: 'Eurtisan',
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Reject sessions for deleted accounts at login time.
          if (!session?.userId) {
            throw new Error('Invalid session data.')
          }
          const rows = await db
            .select({ deletedAt: user.deletedAt })
            .from(user)
            .where(eq(user.id, session.userId))
            .limit(1)
          if (rows[0]?.deletedAt) {
            throw APIError.from('UNAUTHORIZED', {
              code: 'ACCOUNT_DELETED',
              message: 'This account has been deactivated.',
            })
          }
          return true
        },
        after: async (session, context) => {
          if (!context) return
          const sessionId = context.getCookie(ANONYMOUS_SESSION_COOKIE) ?? undefined
          const { handlePostLoginCartMerge } = await import('../cart.server')
          await handlePostLoginCartMerge(sessionId, session.userId, () => {
            context.setCookie(ANONYMOUS_SESSION_COOKIE, '', {
              httpOnly: true,
              secure: getRequestProtocol() === 'https',
              sameSite: 'lax',
              maxAge: 0,
              path: '/',
            })
          })
        },
      },
    },
  },
} as BetterAuthOptions

export const auth = betterAuth(betterAuthOptions)
