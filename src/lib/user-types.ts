import type { UserRole } from './authz'

export interface SafeUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: UserRole
  bannedAt: Date | null
}
