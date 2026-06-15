import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'

export type { ShopLifecycleError } from './shop-lifecycle.server'

const shopIdSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required.'),
})

export const pauseShop = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(shopIdSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { pauseShopQuery, ShopLifecycleError } = await import('./shop-lifecycle.server')
    try {
      await pauseShopQuery(data.shopId, context.user)
      return { success: true as const }
    } catch (err) {
      if (err instanceof ShopLifecycleError) {
        throw new Response(JSON.stringify({ error: err.code, message: err.message }), {
          status: err.code === 'NOT_FOUND' ? 404 : 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  })

export const resumeShop = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(shopIdSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { resumeShopQuery, ShopLifecycleError } = await import('./shop-lifecycle.server')
    try {
      await resumeShopQuery(data.shopId, context.user)
      return { success: true as const }
    } catch (err) {
      if (err instanceof ShopLifecycleError) {
        throw new Response(JSON.stringify({ error: err.code, message: err.message }), {
          status: err.code === 'NOT_FOUND' ? 404 : 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  })

export const archiveShop = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(shopIdSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { archiveShopQuery, ShopLifecycleError } = await import('./shop-lifecycle.server')
    try {
      await archiveShopQuery(data.shopId, context.user)
      return { success: true as const }
    } catch (err) {
      if (err instanceof ShopLifecycleError) {
        throw new Response(JSON.stringify({ error: err.code, message: err.message }), {
          status: err.code === 'NOT_FOUND' ? 404 : 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  })

export const requestShopDeletion = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(shopIdSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { requestShopDeletionQuery, ShopLifecycleError } = await import('./shop-lifecycle.server')
    try {
      const scheduledAt = await requestShopDeletionQuery(data.shopId, context.user)
      return { success: true as const, scheduledAt: scheduledAt.toISOString() }
    } catch (err) {
      if (err instanceof ShopLifecycleError) {
        throw new Response(JSON.stringify({ error: err.code, message: err.message }), {
          status: err.code === 'NOT_FOUND' ? 404 : 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  })

export const cancelShopDeletion = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(shopIdSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { cancelShopDeletionQuery, ShopLifecycleError } = await import('./shop-lifecycle.server')
    try {
      await cancelShopDeletionQuery(data.shopId, context.user)
      return { success: true as const }
    } catch (err) {
      if (err instanceof ShopLifecycleError) {
        throw new Response(JSON.stringify({ error: err.code, message: err.message }), {
          status: err.code === 'NOT_FOUND' ? 404 : 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  })
