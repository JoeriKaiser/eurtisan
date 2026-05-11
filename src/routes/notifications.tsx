import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import {
  NotificationsError,
  NotificationsLoading,
  NotificationsPage,
} from '#/components/NotificationsPage'
import { getNotifications } from '#/lib/notifications'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const notificationsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
})

const PAGE_SIZE = 20

export const Route = createFileRoute('/notifications')({
  beforeLoad: async () => guardAuth(),
  validateSearch: notificationsSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ deps }) => {
    const page = deps.page
    const result = await getNotifications({ data: { page, pageSize: PAGE_SIZE } })
    return { ...result, page }
  },
  head: () => ({
    meta: [
      { title: `${m.notifications_title()} | Eurtisan` },
      { name: 'description', content: m.notifications_title() },
    ],
  }),
  component: NotificationsRouteComponent,
  pendingComponent: NotificationsLoading,
  errorComponent: NotificationsError,
})

function NotificationsRouteComponent() {
  const { notifications, total, page } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setIsNavigating(true)
    navigate({ search: { page: newPage } }).finally(() => setIsNavigating(false))
  }

  return (
    <NotificationsPage
      notifications={notifications}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={goToPage}
      isNavigating={isNavigating}
    />
  )
}
