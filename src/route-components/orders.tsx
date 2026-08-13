import { OrdersPage } from '#/components/OrdersPage'
import { useState } from 'react'
import { useLoaderData, useNavigate } from '@tanstack/react-router'

const PAGE_SIZE = 10

export function OrdersRouteComponent() {
  const { orders, total, page } = useLoaderData({ from: '/orders/' })
  const routerNavigate = useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setIsNavigating(true)
    routerNavigate({ to: '/orders', search: { page: newPage } }).finally(() =>
      setIsNavigating(false),
    )
  }

  return (
    <OrdersPage
      orders={orders}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={goToPage}
      isNavigating={isNavigating}
    />
  )
}
