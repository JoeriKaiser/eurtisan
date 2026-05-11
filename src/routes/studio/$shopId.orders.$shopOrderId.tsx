import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft, ImageOff, MapPin, Package, Truck } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { formatPriceEUR } from '#/lib/pricing'
import { guardAuth } from '#/lib/route-guards'
import { getShopOrder } from '#/lib/shop-orders'

export const Route = createFileRoute('/studio/$shopId/orders/$shopOrderId')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const order = await getShopOrder({ data: { shopOrderId: params.shopOrderId } })
      if (order.shopId !== params.shopId) {
        throw notFound()
      }
      return { order }
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: () => ({
    meta: [{ title: 'Order Detail | Studio' }],
  }),
  component: ShopOrderDetailPage,
})

function ShopOrderDetailPage() {
  const { shopId, shopOrderId } = Route.useParams()
  const { order } = Route.useLoaderData()

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

  const shippingAddress = order.shippingAddress

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6 flex items-center gap-4'>
          <Link
            to='/studio/$shopId/orders'
            params={{ shopId }}
            className='inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary'
          >
            <ArrowLeft size={16} />
            Back to orders
          </Link>
        </div>

        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h1 className='display-title text-2xl font-bold text-text-primary'>Order Detail</h1>
            <p className='font-mono text-sm text-text-secondary'>{shopOrderId.slice(0, 8)}…</p>
          </div>
          <Badge variant={getStatusBadgeVariant(order.status)} className='text-sm'>
            {order.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className='space-y-6'>
          {/* Buyer & Shipping */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-sm'>
                  <Package size={16} className='text-text-muted' />
                  Buyer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-text-primary'>{order.buyer.name}</p>
                <p className='text-sm text-text-secondary'>{order.buyer.email}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-sm'>
                  <Truck size={16} className='text-text-muted' />
                  Shipping Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='capitalize text-text-primary'>{order.shippingMethod}</p>
                {order.trackingNumber && (
                  <p className='mt-1 text-sm text-text-secondary'>
                    Tracking: {order.trackingNumber}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-sm'>
                <MapPin size={16} className='text-text-muted' />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-text-primary'>{shippingAddress.name}</p>
              <p className='text-text-secondary'>{shippingAddress.street}</p>
              <p className='text-text-secondary'>
                {shippingAddress.postalCode} {shippingAddress.city}
              </p>
              <p className='text-text-secondary'>{shippingAddress.country}</p>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className='divide-y divide-border-subtle'>
                {order.items.map((item) => (
                  <li key={item.id} className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'>
                    <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
                      <ImageOff size={16} className='text-text-muted' />
                    </div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-text-primary'>{item.productName}</p>
                      <p className='text-xs text-text-secondary'>
                        {formatPriceEUR(item.unitPriceCents)} × {item.quantity}
                      </p>
                    </div>
                    <span className='text-sm font-medium text-text-primary'>
                      {formatPriceEUR(item.totalCents)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className='mt-4 space-y-1 border-t border-border-default pt-4 text-sm'>
                <div className='flex justify-between text-text-secondary'>
                  <span>Subtotal</span>
                  <span>{formatPriceEUR(order.subtotalCents)}</span>
                </div>
                <div className='flex justify-between text-text-secondary'>
                  <span>Shipping</span>
                  <span>{formatPriceEUR(order.shippingCostCents)}</span>
                </div>
                <div className='flex justify-between pt-1 text-base font-semibold text-text-primary'>
                  <span>Total</span>
                  <span>{formatPriceEUR(order.subtotalCents + order.shippingCostCents)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
