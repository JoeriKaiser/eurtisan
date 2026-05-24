import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db/index'
import { createEmailProvider } from '#/integrations/email'
import { ANONYMOUS_SESSION_COOKIE } from './cart'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
      const verificationUrl = `${parsedUrl.origin}/verify-email?token=${token}&email=${encodeURIComponent(user.email)}&redirect=${encodeURIComponent(callbackURL)}`

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
              secure: true,
              sameSite: 'lax',
              maxAge: 0,
              path: '/',
            })
          })
        },
      },
    },
  },
})
