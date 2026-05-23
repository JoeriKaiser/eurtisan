import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { listAuditLogQuery } from './audit-log.server'
import { authMiddleware } from './auth-middleware'

const listAuditLogInputSchema = z.object({
  action: z.string().optional(),
  actorId: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type ListAuditLogInput = z.infer<typeof listAuditLogInputSchema>

async function requireAdmin(context: { user?: { id: string; role: string } | null }) {
  if (!context.user) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }
  if (context.user.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const listAuditLog = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => listAuditLogInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    return listAuditLogQuery({
      action: data.action,
      actorId: data.actorId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      from: data.from ? new Date(data.from) : undefined,
      to: data.to ? new Date(data.to) : undefined,
      page: data.page,
      pageSize: data.pageSize,
    })
  })
