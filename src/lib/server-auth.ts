import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'

import { shop, user } from '#/db/schema'
import { authMiddleware } from './auth-middleware'
import type { UserRole } from './authz'
import { validatePlainText } from './xss'

export interface SafeUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: UserRole
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 0,
  creator: 1,
  admin: 2,
}

/**
 * Returns the currently authenticated user, or null if unauthenticated.
 * Safe to call from any route — does not throw.
 */
export const getCurrentUser = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SafeUser | null> => {
    return context.user ?? null
  })

/**
 * Returns the currently authenticated user, or throws if unauthenticated.
 * Use in protected routes.
 */
export const requireAuthUser = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SafeUser> => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    return context.user
  })

/**
 * Verifies the current user meets the minimum role requirement.
 * Throws if unauthenticated or role is insufficient.
 */
export const requireRoleUser = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { minRole: UserRole }) => data)
  .handler(async ({ context, data }): Promise<SafeUser> => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    const userLevel = ROLE_HIERARCHY[context.user.role] ?? -1
    const requiredLevel = ROLE_HIERARCHY[data.minRole]
    if (userLevel < requiredLevel) {
      throw new Error('FORBIDDEN')
    }
    return context.user
  })

/**
 * Verifies the current user owns the given shop.
 * Admin users bypass ownership check.
 * Throws if unauthenticated, shop not found, or user does not own it.
 */
export const verifyShopOwnership = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { shopId: string }) => data)
  .handler(async ({ context, data }): Promise<SafeUser> => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    if (context.user.role === 'admin') {
      return context.user
    }

    const { db } = await import('#/db/index')
    const shopRecord = await db.query.shop.findFirst({
      where: eq(shop.id, data.shopId),
    })

    if (!shopRecord || shopRecord.ownerId !== context.user.id) {
      throw new Error('FORBIDDEN')
    }

    return context.user
  })

/**
 * Upgrades the authenticated customer to a creator.
 * Optionally creates an initial shop record.
 */
export const becomeCreator = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { shopName?: string; shopSlug?: string }) => data)
  .handler(async ({ context, data }): Promise<SafeUser> => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    if (context.user.role !== 'customer') {
      throw new Error('FORBIDDEN')
    }

    const { db } = await import('#/db/index')
    await db
      .update(user)
      .set({ role: 'creator', updatedAt: new Date() })
      .where(eq(user.id, context.user.id))

    if (data.shopName && data.shopSlug) {
      await db.insert(shop).values({
        id: crypto.randomUUID(),
        name: validatePlainText(data.shopName, 'Shop name'),
        slug: data.shopSlug,
        ownerId: context.user.id,
      })
    }

    return {
      ...context.user,
      role: 'creator',
    }
  })
