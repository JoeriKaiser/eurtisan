import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from '../auth-middleware'
import { requireAdminSignInResponse } from '../authz'
import type { SafeUser } from '../server-auth'
import { requirePrivileged2FA } from '../server-auth'

export type { AdminPayoutRow } from '../payouts.server'

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
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ listPendingPayoutsQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('../payouts.server'),
      import('../audit-log.server'),
    ])
    const result = await listPendingPayoutsQuery(data.page, data.pageSize)

    await emitAdminReadAudit(context.user, 'admin.read.payout', 'payout', undefined, {
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })

    return result
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
      requireAdminSignInResponse(context),
      import('../payouts.server'),
      import('../audit-log.server'),
    ])
    requirePrivileged2FA(context.user as SafeUser)
    const { executePayoutQuery } = modules[1]
    const { emitAuditEvent } = modules[2]
    const [result] = await Promise.all([
      executePayoutQuery(data.payoutId),
      emitAuditEvent(context.user, 'payout.execute', 'payout', data.payoutId),
    ])

    return result
  })

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
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ listPayoutHistoryQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('../payouts.server'),
      import('../audit-log.server'),
    ])
    const result = await listPayoutHistoryQuery({
      page: data.page,
      pageSize: data.pageSize,
      from: data.from,
      to: data.to,
      query: data.query,
    })

    await emitAdminReadAudit(context.user, 'admin.read.payout', 'payout', undefined, {
      query: data.query,
      from: data.from?.toISOString(),
      to: data.to?.toISOString(),
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })

    return result
  })
