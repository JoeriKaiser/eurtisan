import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import {
  checkAccountLockout,
  recordFailedSignIn,
  recordSuccessfulSignIn,
} from '#/lib/auth-lockout.server'
import {
  assertAuthRateLimit,
  checkRateLimit,
  extractClientIp,
  isAuthRateLimitedAction,
} from '#/lib/rate-limit'

async function assertAuthGetRateLimit(request: Request): Promise<void> {
  const ip = extractClientIp(request)
  const result = await checkRateLimit(`auth:get:${ip}`, 100, 60_000)
  if (!result.allowed) {
    throw new Response(
      JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfterSeconds),
        },
      },
    )
  }
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await assertAuthGetRateLimit(request)
        return auth.handler(request)
      },
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
