import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { formatPriceEUR } from '#/lib/pricing'
import { guardShopOwnership } from '#/lib/route-guards'
import { listShopOrders } from '#/lib/shop-orders'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/studio/$shopId/orders')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params, search }) => {
    const page = typeof search.page === 'string' ? Number.parseInt(search.page, 10) || 1 : 1
    const status = typeof search.status === 'string' ? search.status : undefined
    const result = await listShopOrders({
      data: {
        shopId: params.shopId,
        status,
        page,
        pageSize: 20,
      },
    })
    return { result, status }
  },
  head: () => ({
    meta: [{ title: 'Orders | Studio' }],
  }),
  component: ShopOrdersPage,
})

function ShopOrdersPage() {
  const { shopId } = Route.useParams()
  const { result, status } = Route.useLoaderData()
  const navigate = Route.useNavigate()

  const statusOptions = [
    { value: '', label: 'All' },
    { value: 'pending_payment', label: 'Pending Payment' },
    { value: 'paid', label: 'Paid' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const handleStatusChange = (nextStatus: string) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        status: nextStatus || undefined,
        page: undefined,
      }),
    })
  }

  const handlePageChange = (nextPage: number) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        page: nextPage === 1 ? undefined : nextPage,
      }),
    })
  }

  const getStatusBadgeVariant = (
    orderStatus: string,
  ): React.ComponentProps<typeof Badge>['variant'] => {
    switch (orderStatus) {
      case 'completed':
      case 'delivered':
        return 'success'
      case 'cancelled':
      case 'refunded':
      case 'disputed':
        return 'error'
      case 'shipped':
        return 'primary'
      case 'paid':
      case 'processing':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-5xl'>
        <div className='mb-6 flex items-center justify-between'>
          <h1 className='display-title text-2xl font-bold text-text-primary'>Shop Orders</h1>
          <Link
            to='/studio/$shopId'
            params={{ shopId }}
            className='text-sm text-text-secondary hover:text-text-primary'
          >
            Back to dashboard
          </Link>
        </div>

        <div className='mb-6 flex flex-wrap items-center gap-2'>
          <span className='text-sm text-text-secondary'>Status:</span>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type='button'
              onClick={() => handleStatusChange(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                (status || '') === opt.value
                  ? 'bg-accent-primary text-text-on-primary'
                  : 'bg-surface-inset text-text-secondary hover:bg-bg-inset'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {result.orders.length === 0 ? (
          <div className='island-shell rounded-2xl p-8 text-center'>
            <Package size={48} className='mx-auto mb-4 text-text-muted' />
            <p className='text-text-secondary'>No orders found.</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {result.orders.map((order) => (
              <Link
                key={order.id}
                to='/studio/$shopId/orders/$shopOrderId'
                params={{ shopId, shopOrderId: order.id }}
                className='island-shell flex flex-col gap-3 rounded-xl p-5 transition hover:bg-bg-inset sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-sm text-text-secondary'>
                      {order.id.slice(0, 8)}…
                    </span>
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className='text-sm text-text-secondary'>
                    {order.buyerName} · {order.buyerEmail}
                  </p>
                  <p className='text-xs text-text-muted'>
                    {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} items
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-lg font-semibold text-text-primary'>
                    {formatPriceEUR(order.totalCents)}
                  </p>
                  <p className='text-xs text-text-muted capitalize'>{order.shippingMethod}</p>
                </div>
              </Link>
            ))}

            {result.totalPages > 1 && (
              <nav className='flex items-center justify-center gap-2 pt-4'>
                <button
                  type='button'
                  onClick={() => handlePageChange(Math.max(1, result.page - 1))}
                  disabled={result.page <= 1}
                  className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-40'
                >
                  <ChevronLeft size={16} />
                  {m.pagination_previous()}
                </button>
                <span className='text-sm text-text-secondary'>
                  {m.pagination_page_of({ page: result.page, totalPages: result.totalPages })}
                </span>
                <button
                  type='button'
                  onClick={() => handlePageChange(Math.min(result.totalPages, result.page + 1))}
                  disabled={result.page >= result.totalPages}
                  className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-40'
                >
                  {m.pagination_next()}
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
