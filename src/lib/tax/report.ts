import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { authMiddleware } from '../auth-middleware'
import { requirePrivileged2FA, type SafeUser } from '../server-auth'

export type {
  TaxReportPeriod,
  VatByCountryRate,
  ReverseChargeSummary,
  PlatformFeeSummary,
  RecentInvoice,
  ShopTaxReport,
} from './report.server'

export const getShopTaxReport = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1, 'Shop ID is required.'),
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required. Please sign in.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('../authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { getShopTaxReportQuery } = await import('./report.server')
    return getShopTaxReportQuery(data.shopId, { year: data.year, month: data.month })
  })
