import { useLoaderData, Link } from '@tanstack/react-router'
import { ArrowLeft, Package, Truck } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import type { AdminOrderDetail } from '#/lib/admin-orders'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { formatDateMediumTime } from '#/lib/format-date'

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */
function formatDate(date: Date | string): string {
  return formatDateMediumTime(new Date(date))
}
function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}
function isValidUrl(url: string | null): url is string {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */
export function AdminOrderDetailPage() {
  const order = useLoaderData({ from: '/admin/orders/$platformOrderId' }) as AdminOrderDetail
  const isCancelled = order.status === 'cancelled'
  return (
    <div className='pb-16 pt-8'>
      {/* Back link */}
      <div className='mb-6'>
        <Link
          to='/admin/orders'
          className='inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary no-underline'
        >
          <ArrowLeft size={16} aria-hidden='true' />
          {m.admin_orders_back_to_list()}
        </Link>
      </div>
      {/* Header */}
      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='display-title text-2xl font-semibold text-text-primary sm:text-3xl'>
            {m.admin_order_detail_title()}
          </h1>
          <p className='mt-1 font-mono text-sm text-text-secondary'>{order.id}</p>
        </div>
        <Badge variant={statusBadgeVariant(order.status)}>{statusLabel(order.status)}</Badge>
      </div>
      {/* Cancellation banner */}
      {isCancelled && (
        <div className='mb-6 rounded-lg border border-error/20 bg-error-subtle p-4'>
          <p className='font-medium text-error'>{m.admin_order_detail_cancelled()}</p>
          {order.cancelledAt && (
            <p className='mt-1 text-sm text-error/80'>
              {m.admin_order_detail_cancelled_at({ date: formatDate(order.cancelledAt) })}
            </p>
          )}
          {order.cancellationReason && (
            <p className='mt-1 text-sm text-error/80'>
              {m.admin_order_detail_cancellation_reason({
                reason: order.cancellationReason,
              })}
            </p>
          )}
        </div>
      )}
      {/* Buyer & Payment Info */}
      <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Card variant='elevated'>
          <CardHeader>
            <CardTitle className='text-sm font-semibold'>{m.admin_order_detail_buyer()}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-1'>
            <p className='font-medium text-text-primary'>{order.buyerName}</p>
            <p className='text-sm text-text-secondary'>{order.buyerEmail}</p>
          </CardContent>
        </Card>
        <Card variant='elevated'>
          <CardHeader>
            <CardTitle className='text-sm font-semibold'>
              {m.admin_order_detail_payment()}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-1'>
            <p className='text-lg font-bold text-text-primary'>
              {formatPriceEUR(order.totalCents)}
            </p>
            <p className='text-sm text-text-secondary'>
              {m.admin_order_detail_payment_id()}:{' '}
              <span className='font-mono text-text-primary'>
                {order.molliePaymentId ?? m.admin_order_detail_payment_none()}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
      {/* Order Info */}
      <Card variant='elevated' className='mb-6'>
        <CardHeader>
          <CardTitle className='text-sm font-semibold'>
            {m.admin_order_detail_order_info()}
          </CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <div>
            <p className='text-xs text-text-secondary'>{m.admin_order_detail_total()}</p>
            <p className='text-lg font-bold text-text-primary tabular-nums'>
              {formatPriceEUR(order.totalCents)}
            </p>
          </div>
          <div>
            <p className='text-xs text-text-secondary'>{m.admin_order_detail_date()}</p>
            <p className='text-sm text-text-primary'>{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className='text-xs text-text-secondary'>{m.admin_orders_col_status()}</p>
            <Badge variant={statusBadgeVariant(order.status)} className='mt-1'>
              {statusLabel(order.status)}
            </Badge>
          </div>
        </CardContent>
      </Card>
      {/* Addresses */}
      <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Card variant='elevated'>
          <CardHeader>
            <CardTitle className='text-sm font-semibold'>
              {m.admin_order_detail_shipping_address()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <address className='not-italic text-sm text-text-secondary'>
              <p className='text-text-primary'>{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.postalCode} {order.shippingAddress.city}
              </p>
              <p>{order.shippingAddress.country}</p>
            </address>
          </CardContent>
        </Card>
        {order.billingAddress && Object.keys(order.billingAddress).length > 0 && (
          <Card variant='elevated'>
            <CardHeader>
              <CardTitle className='text-sm font-semibold'>
                {m.admin_order_detail_billing_address()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <address className='not-italic text-sm text-text-secondary'>
                {order.billingAddress.name && (
                  <p className='text-text-primary'>{order.billingAddress.name}</p>
                )}
                {order.billingAddress.street && <p>{order.billingAddress.street}</p>}
                {(order.billingAddress.postalCode || order.billingAddress.city) && (
                  <p>
                    {order.billingAddress.postalCode} {order.billingAddress.city}
                  </p>
                )}
                {order.billingAddress.country && <p>{order.billingAddress.country}</p>}
              </address>
            </CardContent>
          </Card>
        )}
      </div>
      {/* Shop Orders */}
      <div className='space-y-4'>
        <h2 className='text-lg font-semibold text-text-primary'>
          {m.admin_order_detail_shops_title()} ({order.shops.length})
        </h2>
        {order.shops.map((shop) => (
          <Card key={shop.shopOrderId} variant='elevated'>
            <CardHeader>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                  <CardTitle className='text-base font-semibold'>{shop.shopName}</CardTitle>
                  <p className='mt-0.5 font-mono text-xs text-text-muted'>{shop.shopOrderId}</p>
                </div>
                <Badge variant={statusBadgeVariant(shop.status)}>{statusLabel(shop.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Shipping info */}
              <div className='flex flex-wrap items-center gap-4 text-xs text-text-secondary'>
                <span className='inline-flex items-center gap-1'>
                  <Truck size={14} aria-hidden='true' />
                  {shop.shippingMethod}: {formatPriceEUR(shop.shippingCostCents)}
                </span>
                {shop.shippingLabels.length > 0 ? (
                  <div className='flex flex-wrap items-center gap-2'>
                    {shop.shippingLabels.map((label) => (
                      <span
                        key={label.createdAt.getTime()}
                        className='inline-flex items-center gap-1'
                      >
                        <Package size={14} aria-hidden='true' />
                        {m.order_detail_tracking()}:{' '}
                        {label.labelUrl ? (
                          <a
                            href={label.labelUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-accent-primary hover:underline'
                          >
                            {label.trackingNumber ?? label.carrier}
                          </a>
                        ) : (
                          (label.trackingNumber ?? label.carrier)
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  shop.trackingNumber && (
                    <span className='inline-flex items-center gap-1'>
                      <Package size={14} aria-hidden='true' />
                      {m.order_detail_tracking()}:{' '}
                      {isValidUrl(shop.trackingUrl) ? (
                        <a
                          href={shop.trackingUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-accent-primary hover:underline'
                        >
                          {shop.trackingNumber}
                        </a>
                      ) : (
                        shop.trackingNumber
                      )}
                    </span>
                  )
                )}
              </div>
              {/* Items */}
              <div>
                <h4 className='mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted'>
                  {m.admin_order_detail_items()} ({shop.items.length})
                </h4>
                <table className='w-full text-left text-sm'>
                  <thead>
                    <tr className='border-b border-border-subtle'>
                      <th className='pb-2 pr-4 font-medium text-text-secondary text-xs'>Product</th>
                      <th className='pb-2 pr-4 font-medium text-text-secondary text-xs hidden sm:table-cell'>
                        Price
                      </th>
                      <th className='pb-2 pr-4 font-medium text-text-secondary text-xs'>Qty</th>
                      <th className='pb-2 font-medium text-text-secondary text-xs text-right'>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shop.items.map((item) => (
                      <tr key={item.id} className='border-b border-border-subtle last:border-b-0'>
                        <td className='py-2 pr-4'>
                          <p className='font-medium text-text-primary'>{item.productName}</p>
                          <p className='text-xs text-text-muted font-mono'>{item.productId}</p>
                        </td>
                        <td className='py-2 pr-4 hidden sm:table-cell text-text-secondary'>
                          {formatPriceEUR(item.unitPriceCents)}
                        </td>
                        <td className='py-2 pr-4'>
                          <span className='text-text-secondary'>
                            {m.admin_order_detail_item_quantity({
                              count: String(item.quantity),
                            })}
                          </span>
                        </td>
                        <td className='py-2 text-right'>
                          <span className='font-medium text-text-primary tabular-nums'>
                            {formatPriceEUR(item.totalCents)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Subtotal row */}
              <div className='flex justify-between border-t border-border-default pt-3 text-sm'>
                <span className='text-text-secondary'>{m.cart_shop_subtotal()}</span>
                <span className='font-medium text-text-primary tabular-nums'>
                  {formatPriceEUR(shop.subtotalCents)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
