import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { getRequestProtocol } from '@tanstack/react-start/server'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db/index'
import { createEmailProvider } from '#/integrations/email'
import { ANONYMOUS_SESSION_COOKIE } from './cart-constants'
import { getBaseUrl } from './env.server'

export const betterAuthOptions = {
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  trustedOrigins: [getBaseUrl()],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const emailProvider = createEmailProvider()
      await emailProvider.sendTransactional(user.email, 'password_reset', {
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
      const callbackURL = parsedUrl.searchParams.get('callbackURL') || '/'
      const verificationUrl = `${parsedUrl.origin}/verify-email?token=${token}&redirect=${encodeURIComponent(callbackURL)}`

      const emailProvider = createEmailProvider()
      await emailProvider.sendTransactional(user.email, 'email_verification', {
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
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  plugins: [tanstackStartCookies()],
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
