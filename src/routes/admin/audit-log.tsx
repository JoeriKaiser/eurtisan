import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listAuditLog } from '#/lib/audit-log'
import { AdminAuditLogPage } from '#/route-components/admin/audit-log'
import { AdminAuditLogPending } from '#/route-components/admin/audit-log.pending'
import { AdminAuditLogError } from '#/route-components/admin/audit-log.error'

const auditLogSearchSchema = z.object({
  action: z.string().optional().default(''),
  actorId: z.string().optional().default(''),
  resourceType: z.string().optional().default(''),
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

export const Route = createFileRoute('/admin/audit-log')({
  validateSearch: auditLogSearchSchema,
  loaderDeps: ({ search: { action, actorId, resourceType, from, to, page, pageSize } }) => ({
    action,
    actorId,
    resourceType,
    from,
    to,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    return listAuditLog({
      data: {
        action: deps.action || undefined,
        actorId: deps.actorId || undefined,
        resourceType: deps.resourceType || undefined,
        from: deps.from || undefined,
        to: deps.to || undefined,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
  },
  head: () => ({ meta: [{ title: 'Audit Log | Admin | Eurtisan' }] }),
  component: AdminAuditLogPage,
  pendingComponent: AdminAuditLogPending,
  errorComponent: AdminAuditLogError,
})
