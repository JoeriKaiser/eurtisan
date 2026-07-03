import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { AccountShell } from '#/components/AccountShell'
import { NotificationsLoading } from '#/components/NotificationsLoading'
import { NotificationsError } from '#/components/NotificationsError'
import { NotificationsRouteComponent } from '#/route-components/notifications'
import { getNotifications } from '#/lib/notifications'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'
import { hydrateQueryData } from '#/lib/hydrate-query'
import { queryKeys } from '#/lib/query-keys'
import type { NotificationsResult } from '#/lib/notifications.server'

const notificationsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
})

const PAGE_SIZE = 20

export const Route = createFileRoute('/notifications')({
  validateSearch: notificationsSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  beforeLoad: async () => guardAuth(),
  loader: async ({ context, deps }) => {
    const page = deps.page
    const result = (await getNotifications({
      data: { page, pageSize: PAGE_SIZE },
    })) as NotificationsResult
    const payload = { ...result, page }
    hydrateQueryData(context.queryClient, queryKeys.notificationsPage(page, PAGE_SIZE), payload)
    return payload
  },
  head: () => ({
    meta: [
      { title: `${m.notifications_title()} | Eurtisan` },
      { name: 'description', content: m.notifications_title() },
    ],
  }),
  component: NotificationsRouteWrapper,
  pendingComponent: NotificationsLoading,
  errorComponent: NotificationsError,
})

function NotificationsRouteWrapper() {
  return (
    <AccountShell
      breadcrumbs={[
        { label: m.nav_home(), to: '/' },
        { label: m.account_title(), to: '/account' },
        { label: m.notifications_title() },
      ]}
    >
      <NotificationsRouteComponent />
    </AccountShell>
  )
}
