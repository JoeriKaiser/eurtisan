import type { UserRole } from '../authz'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface SafeUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: UserRole
  isAnonymous?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PaginatedUsers {
  users: SafeUser[]
  total: number
  page: number
  pageSize: number
}

export interface AuthSafeUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: UserRole
  bannedAt: Date | null
  deletedAt: Date | null
  twoFactorEnabled: boolean
  isAnonymous?: boolean
}

/**
 * Narrower view of the user record returned by Better Auth.
 * Better Auth's `User` type does not include custom Drizzle columns such as
 * `bannedAt` and `deletedAt`, so we assert this validated shape when crossing
 * the auth-library boundary.
 */
export interface RawAuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  role: UserRole
  bannedAt: Date | null
  deletedAt: Date | null
  twoFactorEnabled: boolean
  isAnonymous?: boolean
}

export function toSafeUser(raw: unknown): AuthSafeUser {
  const user = raw as RawAuthUser
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    role: user.role,
    bannedAt: user.bannedAt,
    deletedAt: user.deletedAt,
    twoFactorEnabled: user.twoFactorEnabled,
    isAnonymous: user.isAnonymous ?? false,
  }
}
