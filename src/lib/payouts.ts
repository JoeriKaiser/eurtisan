import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type { CreatorPayoutLine } from './payouts.server'
export { PLATFORM_FEE_PERCENT } from './platform-constants'

/**
 * Returns paginated payout line items for a specific shop.
 *
 * Access is restricted to the shop's creator. Admin users bypass the ownership check.
 * Derives payouts from shop_order records where status is `completed`, `delivered`,
 * or `refunded`. Amounts are in EUR cents and reflect subtotal minus platform fee.
 * Refunded orders appear as negative adjustment line items.
 */
export const listCreatorPayouts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1, 'Shop ID is required.'),
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
      status: z.enum(['pending', 'in_transit', 'sent', 'failed', 'reversed', 'all']).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({
      user: context.user as never,
      session: {} as never,
    })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { listCreatorPayoutsQuery } = await import('./payouts.server')
    return listCreatorPayoutsQuery(data.shopId, {
      page: data.page,
      pageSize: data.pageSize,
      status: data.status,
    })
  })

/**
 * Returns the Mollie Connect authorization URL.
 */
export const getMollieConnectUrl = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({
      user: context.user as never,
      session: {} as never,
    })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { getMollieConnectUrlQuery } = await import('./payouts.server')
    const url = await getMollieConnectUrlQuery(data.shopId, context.user.id)
    return { url }
  })

/**
 * Disconnects the connected Mollie account.
 */
export const disconnectMollie = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({
      user: context.user as never,
      session: {} as never,
    })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { disconnectMollieQuery } = await import('./payouts.server')
    return disconnectMollieQuery(data.shopId)
  })
