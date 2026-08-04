import { NotificationsPage } from '#/components/NotificationsPage'
import { useNotifications } from '#/lib/notifications-hooks'
import { useState } from 'react'
import { useLoaderData, useNavigate } from '@tanstack/react-router'

const PAGE_SIZE = 20

export function NotificationsRouteComponent() {
  const loaderData = useLoaderData({ from: '/notifications' })
  const query = useNotifications(loaderData.page, PAGE_SIZE)
  const data = query.data ?? loaderData
  const groups = data.groups
  const total = data.total ?? 0
  const page = data.page ?? loaderData.page ?? 1
  const routerNavigate = useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)
  const totalPages = Math.max(1, data.totalPages)

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setIsNavigating(true)
    routerNavigate({ to: '/notifications', search: { page: newPage } }).finally(() =>
      setIsNavigating(false),
    )
  }

  return (
    <NotificationsPage
      groups={groups}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={goToPage}
      isNavigating={isNavigating}
    />
  )
}
