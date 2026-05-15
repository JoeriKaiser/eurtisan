import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { assertAuthRateLimit } from '#/lib/rate-limit'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        await assertAuthRateLimit(request)
        return auth.handler(request)
      },
    },
  },
})
