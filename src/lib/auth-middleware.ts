import { createMiddleware } from '@tanstack/react-start'

import type { UserRole } from './authz'
import type { SafeUser } from './server-auth'

export interface AuthMiddlewareContext {
  user: SafeUser | null
}

export const authMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const { auth } = await import('./auth')
    const result = await auth.api.getSession({ headers: request.headers })

    const user: SafeUser | null = result
      ? {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
          image: result.user.image ?? null,
          role: (result.user as unknown as { role: string }).role as UserRole,
          bannedAt: (result.user as unknown as { bannedAt: string | null }).bannedAt
            ? new Date((result.user as unknown as { bannedAt: string | null }).bannedAt as string)
            : null,
        }
      : null

    return next({ context: { user } satisfies AuthMiddlewareContext })
  },
)
