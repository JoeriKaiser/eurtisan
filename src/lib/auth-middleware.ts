import { createMiddleware } from '@tanstack/react-start'

import type { SafeUser } from './user-types'

export interface AuthMiddlewareContext {
  user: SafeUser | null
}

export const authMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const { loadAuthMiddlewareUser } = await import('./auth-middleware.server')
    const user = await loadAuthMiddlewareUser(request)

    return next({ context: { user } satisfies AuthMiddlewareContext })
  },
)
