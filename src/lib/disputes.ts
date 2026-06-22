import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'
import { requirePrivileged2FA } from './server-auth'

export const openDisputeSchema = z.object({
  shopOrderId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
})

export const addDisputeMessageSchema = z.object({
  disputeId: z.string().uuid(),
  message: z.string().min(1).max(5000),
})

export const resolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  resolution: z.enum(['close', 'partial_refund', 'full_refund']),
  refundCents: z.number().int().min(0).optional().nullable(),
})

export type {
  CreatedDispute,
  CreatedDisputeMessage,
  DisputeDetail,
  DisputeListItem,
  PaginatedDisputes,
  ResolvedDispute,
} from './disputes.server'

export const openDispute = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(openDisputeSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { openDisputeQuery } = await import('./disputes.server')
    return openDisputeQuery(data, context.user.id)
  })

export const addDisputeMessage = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(addDisputeMessageSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { addDisputeMessageQuery } = await import('./disputes.server')
    return addDisputeMessageQuery(data.disputeId, data.message, context.user.id, context.user.role)
  })

const listOpenDisputesInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(['all', 'open', 'resolved']).optional().default('open'),
  query: z.string().optional(),
})

export const listOpenDisputes = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => listOpenDisputesInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (context.user.role !== 'admin') {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    requirePrivileged2FA(context.user as SafeUser)

    const [{ listOpenDisputesQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./disputes.server'),
      import('./audit-log.server'),
    ])
    const result = await listOpenDisputesQuery({
      page: data.page,
      pageSize: data.pageSize,
      status: data.status,
      query: data.query,
    })

    await emitAdminReadAudit(context.user, 'admin.read.dispute', 'dispute', undefined, {
      status: data.status,
      query: data.query,
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })

    return result
  })

export const getDisputeDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(addDisputeMessageSchema.pick({ disputeId: true }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const [{ getDisputeDetailQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./disputes.server'),
      import('./audit-log.server'),
    ])

    if (context.user.role === 'admin' || context.user.role === 'creator') {
      requirePrivileged2FA(context.user as SafeUser)
    }

    const result = await getDisputeDetailQuery(data.disputeId, context.user.id, context.user.role)

    await emitAdminReadAudit(context.user, 'admin.read.dispute', 'dispute', data.disputeId)

    return result
  })

export const resolveDispute = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(resolveDisputeSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (context.user.role !== 'admin') {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    requirePrivileged2FA(context.user as SafeUser)

    const [{ resolveDisputeQuery }, { emitAuditEvent }] = await Promise.all([
      import('./disputes.server'),
      import('./audit-log.server'),
    ])
    // False positive from analyzer: these calls use functions imported in the preceding Promise.all.
    const [result] = await Promise.all([
      resolveDisputeQuery(
        data.disputeId,
        {
          resolution: data.resolution,
          refundCents: data.refundCents,
        },
        { userId: context.user.id, role: context.user.role },
      ),
      emitAuditEvent(context.user, 'dispute.resolve', 'dispute', data.disputeId, {
        resolution: data.resolution,
        refundCents: data.refundCents,
      }),
    ])

    return result
  })
