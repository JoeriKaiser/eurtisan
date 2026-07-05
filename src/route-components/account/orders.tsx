import { Link, useLoaderData, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { formatDateLong } from '#/lib/format-date'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'

const PAGE_SIZE = 10

function formatDate(date: Date): string {
  return formatDateLong(new Date(date))
}

export function AccountOrders() {
  const { orders, total, page } = useLoaderData({ from: '/account/orders/' })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const routerNavigate = useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setIsNavigating(true)
    routerNavigate({ to: '/account/orders', search: { page: newPage } }).finally(() =>
      setIsNavigating(false),
    )
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-semibold text-text-primary'>
          {m.account_orders()}
        </h1>

        {orders.length === 0 ? (
          <div className='py-12 text-center'>
            <p className='text-text-secondary'>{m.orders_empty()}</p>
            <Link to='/category/all' className='mt-4 inline-block no-underline'>
              <Button variant='secondary'>{m.shop_browse_marketplace()}</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className='space-y-4'>
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to='/account/orders/$orderNumber'
                  params={{ orderNumber: order.orderNumber }}
                  className='flex flex-col gap-2 rounded-xl border border-border-default bg-surface-default p-4 transition hover:border-border-strong hover:bg-bg-inset sm:flex-row sm:items-center sm:justify-between no-underline'
                >
                  <div className='space-y-1'>
                    <p className='font-mono text-sm font-medium text-text-primary'>
                      {m.orders_order_number()}: {order.orderNumber}
                    </p>
                    <p className='text-sm text-text-secondary'>
                      {formatDate(order.createdAt)} ·{' '}
                      {m.orders_shop_count({ count: order.shopCount })}
                    </p>
                  </div>
                  <div className='flex items-center gap-3 sm:text-right'>
                    <span className='text-base font-semibold text-text-primary'>
                      {formatPriceEUR(order.totalCents)}
                    </span>
                    <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                className='mt-6 flex items-center justify-between'
                aria-label={m.pagination_page_of({
                  page: String(page),
                  totalPages: String(totalPages),
                })}
              >
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || isNavigating}
                >
                  {m.pagination_previous()}
                </Button>
                <span className='text-sm text-text-secondary'>
                  {m.pagination_page_of({ page: String(page), totalPages: String(totalPages) })}
                </span>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || isNavigating}
                >
                  {m.pagination_next()}
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  )
}
