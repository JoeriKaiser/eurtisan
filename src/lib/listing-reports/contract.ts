import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { authMiddleware } from '../auth-middleware'
import { requirePrivileged2FA, type SafeUser } from '../server-auth'
import { LISTING_REPORT_REASONS } from './types'

/**
 * The authentication guard every listing-report server function runs before
 * its handler body.
 *
 * Exported — unlike the inline checks in `../reviews.ts` — so the boundary
 * rule itself has a direct test (`contract.test.ts`): reporting is open to
 * any authenticated user and closed to everyone else, which is exactly the
 * kind of promise that should be pinned rather than restated four times.
 */
export function requireReporterUser(context: { user: SafeUser | null }): SafeUser {
  if (!context.user) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return context.user
}

export const createProductReport = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      productId: z.string().min(1).max(255),
      // DSA Article 16(2) requires a notice to carry a substantiated
      // explanation, so a ground is mandatory; `details` carries the
      // substantiation when the ground alone is not enough.
      reason: z.enum(LISTING_REPORT_REASONS),
      details: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const reporter = requireReporterUser(context)

    // Dynamic imports below are deliberate: operations.server is server-only
    // (`*.server.ts`), so a static import would pull it into the browser
    // bundle where the server-only marker throws at load.
    const { createProductReportQuery } = await import('./operations.server')
    return createProductReportQuery(data.productId, reporter.id, data.reason, data.details ?? null)
  })

export const createShopReport = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1).max(255),
      reason: z.enum(LISTING_REPORT_REASONS),
      details: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const reporter = requireReporterUser(context)

    // Server-only module: see createProductReport above for why this stays dynamic.
    const { createShopReportQuery } = await import('./operations.server')
    return createShopReportQuery(data.shopId, reporter.id, data.reason, data.details ?? null)
  })

const adminStatusSchema = z
  .enum(['all', 'open', 'reviewed', 'actioned', 'dismissed'])
  .default('all')

export const getAdminListingReports = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      status: adminStatusSchema,
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ context, data }) => {
    const actor = requireReporterUser(context)
    requirePrivileged2FA(actor)

    // Server-only modules: see createProductReport above for why these stay dynamic.
    const [{ getAdminListingReportsQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./operations.server'),
      import('../audit-log.server'),
    ])
    const result = await getAdminListingReportsQuery(actor, data.status, data.page, data.pageSize)

    await emitAdminReadAudit(actor, 'admin.read.listing_report', 'listing_report', undefined, {
      status: data.status,
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })

    return result
  })

export const resolveListingReport = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      reportId: z.string().uuid(),
      targetType: z.enum(['product', 'shop']),
      outcome: z.enum(['actioned', 'dismissed']),
      // Required: a decision without its grounds cannot be audited or later
      // stated to the people entitled to know.
      note: z.string().min(1).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const actor = requireReporterUser(context)
    requirePrivileged2FA(actor)

    // Server-only modules: see createProductReport above for why these stay dynamic.
    const [{ resolveListingReportQuery }, { emitAuditEvent }] = await Promise.all([
      import('./operations.server'),
      import('../audit-log.server'),
    ])
    await resolveListingReportQuery(actor, data)

    await emitAuditEvent(actor, 'listing_report.resolve', 'listing_report', data.reportId, {
      targetType: data.targetType,
      outcome: data.outcome,
    })

    return { success: true } as const
  })
