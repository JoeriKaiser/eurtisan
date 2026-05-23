import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { listBuyerOrders } from '#/lib/orders'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const ordersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
})

const PAGE_SIZE = 10

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export const Route = createFileRoute('/account/orders')({
  validateSearch: ordersSearchSchema,
  beforeLoad: async () => guardAuth(),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ deps }) => {
    const page = deps.page
    const offset = (page - 1) * PAGE_SIZE
    const result = await listBuyerOrders({ data: { limit: PAGE_SIZE, offset } })
    return { ...result, page }
  },
  head: () => ({
    meta: [
      { title: `${m.account_orders()} | Eurtisan` },
      { name: 'description', content: m.account_orders() },
    ],
  }),
  component: AccountOrders,
})

function AccountOrders() {
  const { orders, total, page } = Route.useLoaderData()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const routerNavigate = Route.useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setIsNavigating(true)
    routerNavigate({ search: { page: newPage } }).finally(() => setIsNavigating(false))
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-bold text-text-primary'>
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
                  to='/account/orders/$orderId'
                  params={{ orderId: order.id }}
                  className='flex flex-col gap-2 rounded-xl border border-border-default bg-surface-default p-4 transition hover:border-border-strong hover:bg-bg-inset sm:flex-row sm:items-center sm:justify-between no-underline'
                >
                  <div className='space-y-1'>
                    <p className='font-mono text-sm font-medium text-text-primary'>
                      {m.orders_order_id()}: {order.id}
                    </p>
                    <p className='text-sm text-text-secondary'>
                      {formatDate(order.createdAt)} ·{' '}
                      {m.orders_shop_count({ count: String(order.shopCount) })}
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
