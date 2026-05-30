import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listUsers } from '#/lib/admin-users'
import { AdminUsersPage } from '#/route-components/admin/users'
import { AdminUsersPending } from '#/route-components/admin/users.pending'
import { AdminUsersError } from '#/route-components/admin/users.error'

const usersSearchSchema = z.object({
  query: z.string().optional().default(''),
  role: z.enum(['customer', 'creator', 'admin']).optional(),
  status: z.enum(['all', 'active', 'banned']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

export const Route = createFileRoute('/admin/users')({
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search: { query, role, status, page, pageSize } }) => ({
    query,
    role,
    status,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    return listUsers({
      data: {
        query: deps.query || undefined,
        role: deps.role,
        status: deps.status,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
  },
  head: () => ({ meta: [{ title: 'Users | Admin | Eurtisan' }] }),
  component: AdminUsersPage,
  pendingComponent: AdminUsersPending,
  errorComponent: AdminUsersError,
})
