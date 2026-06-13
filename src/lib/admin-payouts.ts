import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type { AdminPayoutRow } from './payouts.server'

/* -------------------------------------------------------------------------- */
/*                               Auth Guard                                    */
/* -------------------------------------------------------------------------- */

/**
 * Shared admin auth guard — throws 401/403 if not authenticated or not admin.
 */
async function requireAdmin(context: { user?: { id: string; role: string } | null }) {
  if (!context.user) {
    throw new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (context.user.role !== 'admin') {
    throw new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Admin access required.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                          List Pending Payouts                               */
/* -------------------------------------------------------------------------- */

/**
 * Returns all pending payouts enriched with creator and shop details.
 * Admin only.
 */
const listPendingPayoutsInputSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const listPendingPayouts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listPendingPayoutsInputSchema)
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listPendingPayoutsQuery } = await import('./payouts.server')
    return listPendingPayoutsQuery(data.page, data.pageSize)
  })

/* -------------------------------------------------------------------------- */
/*                            Execute / Retry Payout                           */
/* -------------------------------------------------------------------------- */

const executePayoutInputSchema = z.object({
  payoutId: z.string().min(1, 'Payout ID is required.'),
})

/**
 * Executes a pending or failed payout by creating a Mollie delayed-routing route.
 * Idempotent — executing an already-sent payout returns the existing route ID.
 * Admin only.
 */
export const executePayout = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(executePayoutInputSchema)
  .handler(async ({ context, data }) => {
    const modules = await Promise.all([
      requireAdmin(context),
      import('./payouts.server'),
      import('./audit-log.server'),
    ])
    const { executePayoutQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const [result] = await Promise.all([
      executePayoutQuery(data.payoutId),
      emitAuditEvent(context.user, 'payout.execute', 'payout', data.payoutId),
    ])

    return result
  })

/**
 * @deprecated Use {@link executePayout} instead. Kept for compatibility with
 * existing admin UI call sites during migration.
 */
export const markPayoutSent = executePayout

/* -------------------------------------------------------------------------- */
/*                          List Payout History                                */
/* -------------------------------------------------------------------------- */

const listPayoutHistoryInputSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  from: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  query: z.string().optional(),
})

/**
 * Returns paginated payout history (all statuses) enriched with creator
 * and shop details.
 * Admin only.
 */
export const listPayoutHistory = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listPayoutHistoryInputSchema)
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listPayoutHistoryQuery } = await import('./payouts.server')
    return listPayoutHistoryQuery({
      page: data.page,
      pageSize: data.pageSize,
      from: data.from,
      to: data.to,
      query: data.query,
    })
  })
