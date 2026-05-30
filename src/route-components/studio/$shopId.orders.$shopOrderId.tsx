import { Link, useLoaderData, useParams, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { markShopOrderDelivered } from '#/lib/shop-orders'
import { ShopOrderShipDialog } from '#/route-components/studio/ShopOrderShipDialog'
import {
  BuyerInfoCard,
  OrderItemsCard,
  OrderStatusSection,
  ShippingAddressCard,
  ShippingLabelCard,
  ShippingMethodCard,
} from './ShopOrderDetailCards'

function getStatusBadgeVariant(orderStatus: string): React.ComponentProps<typeof Badge>['variant'] {
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

export function ShopOrderDetailPage() {
  const { shopId, shopOrderId } = useParams({ from: '/studio/$shopId/orders/$shopOrderId' })
  const { order } = useLoaderData({ from: '/studio/$shopId/orders/$shopOrderId' })
  const router = useRouter()
  const [dialog, setDialog] = useState({ open: false, key: 0 })
  const [status, setStatus] = useState({
    actionError: null as string | null,
    isMarkingDelivered: false,
  })

  const handleShipped = useCallback(() => {
    router.invalidate()
  }, [router])

  const handleMarkDelivered = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isMarkingDelivered: true, actionError: null }))
    try {
      await markShopOrderDelivered({ data: { shopOrderId } })
      router.invalidate()
    } catch (err) {
      if (err instanceof Response) {
        try {
          const body = await err.json()
          setStatus((prev) => ({
            ...prev,
            actionError: body.message || 'Failed to mark order as delivered',
          }))
        } catch {
          setStatus((prev) => ({
            ...prev,
            actionError: 'Failed to mark order as delivered',
          }))
        }
      } else if (err instanceof Error) {
        setStatus((prev) => ({ ...prev, actionError: err.message }))
      } else {
        setStatus((prev) => ({ ...prev, actionError: 'An unexpected error occurred' }))
      }
    } finally {
      setStatus((prev) => ({ ...prev, isMarkingDelivered: false }))
    }
  }, [shopOrderId, router])

  const canShip = ['paid', 'processing'].includes(order.status)
  const canDeliver = order.status === 'shipped'

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6 flex items-center gap-4'>
          <Link
            to='/studio/$shopId/orders'
            params={{ shopId }}
            className='inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary'
          >
            <ArrowLeft size={16} aria-hidden='true' />
            Back to orders
          </Link>
        </div>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h1 className='display-title text-2xl font-semibold text-text-primary'>Order Detail</h1>
            <p className='font-mono text-sm text-text-secondary'>{shopOrderId.slice(0, 8)}…</p>
          </div>
          <Badge variant={getStatusBadgeVariant(order.status)} className='text-sm'>
            {order.status.replace('_', ' ')}
          </Badge>
        </div>
        {status.actionError && (
          <div
            className='mb-6 rounded-lg bg-error/10 p-4 text-sm text-error'
            role='alert'
            aria-live='polite'
          >
            {status.actionError}
          </div>
        )}
        <div className='space-y-6'>
          <OrderStatusSection
            status={order.status}
            canShip={canShip}
            canDeliver={canDeliver}
            isMarkingDelivered={status.isMarkingDelivered}
            onShip={() => setDialog((prev) => ({ key: prev.key + 1, open: true }))}
            onMarkDelivered={handleMarkDelivered}
          />

          <div className='grid gap-4 sm:grid-cols-2'>
            <BuyerInfoCard buyer={order.buyer} />
            <ShippingMethodCard
              shippingMethod={order.shippingMethod}
              trackingNumber={order.trackingNumber}
              trackingUrl={order.trackingUrl}
            />
          </div>

          {order.label && <ShippingLabelCard label={order.label} />}

          <ShippingAddressCard address={order.shippingAddress} />

          <OrderItemsCard
            items={order.items}
            totals={{
              subtotalCents: order.subtotalCents,
              shippingCostCents: order.shippingCostCents,
              vatAmountCents: order.vatAmountCents,
              shippingVatAmountCents: order.shippingVatAmountCents,
              shippingVatRateBasisPoints: order.shippingVatRateBasisPoints,
            }}
          />
        </div>
      </div>
      <ShopOrderShipDialog
        key={dialog.key}
        orderId={shopOrderId}
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        onShipped={handleShipped}
      />
    </main>
  )
}
