import { Link } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import type { BuyerOrderListItem } from '#/lib/orders.server'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { formatDateLong } from '#/lib/format-date'

export { OrdersError } from './OrdersError'
export { OrdersLoading } from './OrdersLoading'

function formatDate(date: Date): string {
  return formatDateLong(new Date(date))
}

export interface OrdersPageProps {
  orders: BuyerOrderListItem[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  isNavigating: boolean
}

export function OrdersPage({
  orders,
  page,
  totalPages,
  onPageChange,
  isNavigating,
}: OrdersPageProps) {
  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    onPageChange(newPage)
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-semibold text-text-primary'>
          {m.orders_title()}
        </h1>

        {orders.length === 0 ? (
          <div className='py-12 text-center'>
            <p className='text-text-secondary'>{m.orders_empty()}</p>
            <Link to='/category/all' className='mt-4 inline-block no-underline'>
              <Button variant='secondary'>{m.orders_empty_cta()}</Button>
            </Link>
          </div>
        ) : (
          <>
            <ul className='space-y-4' aria-label={m.orders_title()}>
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    to='/orders/$platformOrderId'
                    params={{ platformOrderId: order.id }}
                    className='flex flex-col gap-3 rounded-xl border border-border-default bg-surface-default p-4 transition hover:border-border-strong hover:bg-bg-inset sm:flex-row sm:items-center sm:justify-between no-underline'
                  >
                    <div className='space-y-1'>
                      <p className='font-mono text-sm font-medium text-text-primary'>
                        {m.orders_order_number()}: {order.orderNumber}
                      </p>
                      <p className='text-sm text-text-secondary'>
                        {formatDate(order.createdAt)} ·{' '}
                        {m.orders_shop_count({ count: String(order.shopCount) })}
                      </p>
                      {order.shopSummary.length > 1 && (
                        <div className='flex flex-wrap gap-1 pt-1'>
                          {order.shopSummary.map((shop) => (
                            <Badge
                              key={shop.shopId}
                              variant={statusBadgeVariant(shop.status)}
                              className='text-[10px]'
                            >
                              {shop.shopName}: {shop.status}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className='flex items-center gap-3 sm:text-right'>
                      <span className='text-base font-semibold text-text-primary'>
                        {formatPriceEUR(order.totalCents)}
                      </span>
                      <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

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
