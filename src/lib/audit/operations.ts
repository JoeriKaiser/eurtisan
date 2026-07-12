import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from '../auth-middleware'
import type { SafeUser } from '../server-auth'
import { requirePrivileged2FA } from '../server-auth'

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

export const listAuditLog = createServerFn({ method: 'GET', strict: { output: false } })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => listAuditLogInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context)
    requirePrivileged2FA(context.user as SafeUser)

    // Dynamic import is required: this browser-callable server-function entry cannot
    // statically depend on server-only persistence at the top level.
    const { listAuditLogQuery, emitAdminReadAudit } = await import('./operations.server')

    const result = await listAuditLogQuery({
      action: data.action,
      actorId: data.actorId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      from: data.from ? new Date(data.from) : undefined,
      to: data.to ? new Date(data.to) : undefined,
      page: data.page,
      pageSize: data.pageSize,
    })

    await emitAdminReadAudit(context.user, 'admin.read.audit_log', 'audit_log', undefined, {
      action: data.action,
      actorId: data.actorId,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      from: data.from,
      to: data.to,
      page: data.page,
      pageSize: data.pageSize,
      total: result.total,
    })

    return result
  })
