import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { addDisputeMessageSchema, openDisputeSchema, resolveDisputeSchema } from './disputes.server'

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

    const { listOpenDisputesQuery } = await import('./disputes.server')
    return listOpenDisputesQuery({ page: data.page, pageSize: data.pageSize })
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

    const { getDisputeDetailQuery } = await import('./disputes.server')
    return getDisputeDetailQuery(data.disputeId, context.user.id, context.user.role)
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

    const { resolveDisputeQuery } = await import('./disputes.server')
    return resolveDisputeQuery(data.disputeId, {
      resolution: data.resolution,
      refundCents: data.refundCents,
    })
  })
