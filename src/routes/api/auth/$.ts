import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import {
  checkAccountLockout,
  recordFailedSignIn,
  recordSuccessfulSignIn,
} from '#/lib/auth-lockout.server'
import { assertAuthRateLimit, isAuthRateLimitedAction } from '#/lib/rate-limit'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        const url = new URL(request.url)
        const isAuthAction = isAuthRateLimitedAction(request)
        let email: string | undefined

        if (isAuthAction) {
          const cloned = request.clone()
          const body = await cloned.json().catch(() => ({}))
          email = body?.email
        }

        await assertAuthRateLimit(request, email)

        if (url.pathname === '/api/auth/sign-in/email' && email) {
          const lockout = await checkAccountLockout(email)
          if (lockout.locked) {
            return new Response(
              JSON.stringify({
                error: 'Account locked',
                message: 'Too many failed login attempts. Please try again later.',
              }),
              {
                status: 423,
                headers: {
                  'Content-Type': 'application/json',
                  'Retry-After': String(lockout.retryAfterSeconds),
                },
              },
            )
          }
        }

        const response = await auth.handler(request)

        if (url.pathname === '/api/auth/sign-in/email' && email) {
          if (response.ok) {
            await recordSuccessfulSignIn(email)
          } else if (response.status === 401) {
            await recordFailedSignIn(email)
          }
        }

        return response
      },
    },
  },
})
