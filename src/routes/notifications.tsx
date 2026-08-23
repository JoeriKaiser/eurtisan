import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { NotificationsError } from '#/components/NotificationsError'
import { NotificationsLoading } from '#/components/NotificationsLoading'
import { NotificationsRouteWrapper } from '#/route-components/notifications'
import { getNotifications, type NotificationsResult } from '#/lib/notifications'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'
import { hydrateQueryData } from '#/lib/hydrate-query'
import { queryKeys } from '#/lib/query-keys'

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

