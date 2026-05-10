import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db/index'
import { ANONYMOUS_SESSION_COOKIE, handlePostLoginCartMerge } from './cart.server'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
  databaseHooks: {
    session: {
      create: {
        after: async (session, context) => {
          if (!context) return
          const sessionId = context.getCookie(ANONYMOUS_SESSION_COOKIE) ?? undefined
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
