import { NotificationsPage } from '#/components/NotificationsPage'
import { useState } from 'react'
import { useLoaderData, useNavigate } from '@tanstack/react-router'

const PAGE_SIZE = 20

export function NotificationsRouteComponent() {
  const { notifications, total, page } = useLoaderData({ from: '/notifications' })
  const routerNavigate = useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setIsNavigating(true)
    routerNavigate({ to: '/notifications', search: { page: newPage } }).finally(() =>
      setIsNavigating(false),
    )
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
