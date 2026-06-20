import { createHash } from 'node:crypto'

import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { getRequestProtocol } from '@tanstack/react-start/server'
import type { BetterAuthOptions, DBAdapter, Where } from 'better-auth'
import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db/index'
import { createEmailProvider } from '#/integrations/email'
import { checkAuthEmailRateLimit } from './email-rate-limit.server'
import { ANONYMOUS_SESSION_COOKIE } from './cart-constants'
import { getBaseUrl } from './env.server'
import { safeRedirect } from './auth-utils'
import { logEmailEvent } from './email-send-log.server'
import { sha256Hex } from './hash.server'

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
      return adapter.create({ model, data, select, forceAllowId })
    }) as DBAdapter['create'],
    findOne: (async ({ model, where, select, join }) => {
      console.log('AUTH DB ADAPTER findOne:', model, 'where:', JSON.stringify(where))
      if (model === 'session' && where) {
        const { newWhere, tokenMap } = transformSessionWhere(where)
        const result = await adapter.findOne({ model, where: newWhere, select, join })
        return injectToken(
          result as Record<string, unknown> | null,
          tokenMap,
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
      return adapter.update({ model, where, update, ...rest })
    }) as DBAdapter['update'],
    updateMany: (async ({ model, where, update, ...rest }) => {
      if (model === 'session' && where) {
        const { newWhere } = transformSessionWhere(where)
        return adapter.updateMany({ model, where: newWhere, update, ...rest })
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
  plugins: [
    tanstackStartCookies(),
    twoFactor({
      issuer: 'Eurtisan',
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        after: async (session, context) => {
          if (!context) return
          const sessionId = context.getCookie(ANONYMOUS_SESSION_COOKIE) ?? undefined
          const { handlePostLoginCartMerge } = await import('./cart.server')
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
