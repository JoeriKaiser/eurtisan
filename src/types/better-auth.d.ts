import type { UserRole } from '#/lib/authz'

declare module 'better-auth' {
  interface User {
    role: UserRole
    bannedAt: Date | null
    deletedAt: Date | null
    twoFactorEnabled: boolean
  }
}
