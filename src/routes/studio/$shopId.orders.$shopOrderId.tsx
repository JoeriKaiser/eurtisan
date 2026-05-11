import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ImageOff,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { Input } from '#/components/ui/input'
import { formatPriceEUR } from '#/lib/pricing'
import { guardAuth } from '#/lib/route-guards'
import {
  FULFILLMENT_STATUSES,
  isStatusReached,
  isSupportedShippingCountry,
  statusTimelineLabel,
} from '#/lib/orders-ui'
import {
  getShopOrderDetail,
  markShopOrderDelivered,
  markShopOrderShipped,
} from '#/lib/shop-orders'

export const Route = createFileRoute('/studio/$shopId/orders/$shopOrderId')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const order = await getShopOrderDetail({ data: { shopOrderId: params.shopOrderId } })
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
  pendingComponent: ShopOrderDetailPending,
  errorComponent: ShopOrderDetailError,
})

function getStatusBadgeVariant(
  orderStatus: string,
): React.ComponentProps<typeof Badge>['variant'] {
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

/* -------------------------------------------------------------------------- */
/*                            Status Timeline                                 */
/* -------------------------------------------------------------------------- */

function StatusTimeline({ status }: { status: string }) {
  const isTerminal = ['cancelled', 'refunded', 'disputed'].includes(status)

  return (
    <div className='space-y-4'>
      <h3 className='text-sm font-semibold text-text-primary'>Fulfillment Timeline</h3>
      <ol className='relative flex items-center justify-between before:absolute before:left-0 before:right-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-border-subtle'>

        {FULFILLMENT_STATUSES.map((step, idx) => {
          const reached = isStatusReached(status as never, step)
          const isCurrent = status === step
          const isLast = idx === FULFILLMENT_STATUSES.length - 1

          return (
            <li
              key={step}
              className='relative z-10 flex flex-1 flex-col items-center gap-2'
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                  reached
                    ? 'border-accent-primary bg-accent-primary text-text-on-primary'
                    : 'border-border-default bg-surface-default text-text-muted'
                } ${isCurrent ? 'ring-2 ring-accent-primary/30' : ''}`}
              >
                {reached ? (
                  <CheckCircle2 size={16} aria-hidden='true' />
                ) : (
                  <Circle size={16} aria-hidden='true' />
                )}
              </div>
              <span
                className={`text-center text-xs font-medium ${
                  reached ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {statusTimelineLabel(step)}
              </span>
              {isLast && isTerminal && (
                <span className='text-center text-xs font-medium text-error'>
                  {status.replace('_', ' ')}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                          Ship Order Dialog                                 */
/* -------------------------------------------------------------------------- */

function ShipOrderDialog({
  orderId,
  open,
  onOpenChange,
  onShipped,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onShipped: () => void
}) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ trackingUrl?: string }>({})

  useEffect(() => {
    if (open) {
      setTrackingNumber('')
      setTrackingUrl('')
      setError(null)
      setFieldErrors({})
    }
  }, [open])

  const validate = useCallback(() => {
    const errors: { trackingUrl?: string } = {}
    if (trackingUrl.trim()) {
      try {
        new URL(trackingUrl.trim())
      } catch {
        errors.trackingUrl = 'Please enter a valid URL'
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [trackingUrl])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      setIsSubmitting(true)
      setError(null)

      try {
        await markShopOrderShipped({
          data: {
            shopOrderId: orderId,
            trackingNumber: trackingNumber.trim() || null,
            trackingUrl: trackingUrl.trim() || null,
          },
        })
        onOpenChange(false)
        onShipped()
      } catch (err) {
        if (err instanceof Response) {
          try {
            const body = await err.json()
            setError(body.message || 'Failed to mark order as shipped')
          } catch {
            setError('Failed to mark order as shipped')
          }
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('An unexpected error occurred')
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [orderId, trackingNumber, trackingUrl, validate, onOpenChange, onShipped],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <>
          <DialogPortal>
            <DialogBackdrop />
            <DialogPopup className='w-full max-w-md'>
              <form onSubmit={handleSubmit}>
                <DialogTitle>Mark as Shipped</DialogTitle>
                <DialogDescription>
                  Enter tracking information to update the buyer.
                </DialogDescription>

                <div className='mt-4 space-y-4'>
                  <div>
                    <label
                      htmlFor='tracking-number'
                      className='mb-1.5 block text-sm font-medium text-text-secondary'
                    >
                      Tracking Number
                    </label>
                    <Input
                      id='tracking-number'
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder='e.g. TRACK123456'
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor='tracking-url'
                      className='mb-1.5 block text-sm font-medium text-text-secondary'
                    >
                      Tracking URL
                    </label>
                    <Input
                      id='tracking-url'
                      type='url'
                      value={trackingUrl}
                      onChange={(e) => {
                        setTrackingUrl(e.target.value)
                        if (fieldErrors.trackingUrl) setFieldErrors({})
                      }}
                      placeholder='https://carrier.example.com/track'
                      disabled={isSubmitting}
                      error={fieldErrors.trackingUrl}
                    />
                    {fieldErrors.trackingUrl && (
                      <p
                        id='tracking-url-error'
                        className='mt-1 text-xs text-error'
                      >
                        {fieldErrors.trackingUrl}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className='rounded-lg bg-error/10 p-3 text-sm text-error' role='alert'>
                      {error}
                    </div>
                  )}
                </div>

                <div className='mt-6 flex justify-end gap-3'>
                  <Button
                    type='button'
                    variant='ghost'
                    disabled={isSubmitting}
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type='submit' isLoading={isSubmitting}>
                    Mark as Shipped
                  </Button>
                </div>
              </form>
            </DialogPopup>
          </DialogPortal>
        </>
      )}
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*                            Main Page Component                             */
/* -------------------------------------------------------------------------- */

export function ShopOrderDetailPage() {
  const { shopId, shopOrderId } = Route.useParams()
  const { order } = Route.useLoaderData()
  const router = useRouter()

  const [shipDialogOpen, setShipDialogOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isMarkingDelivered, setIsMarkingDelivered] = useState(false)

  const handleShipped = useCallback(() => {
    router.invalidate()
  }, [router])

  const handleMarkDelivered = useCallback(async () => {
    setIsMarkingDelivered(true)
    setActionError(null)

    try {
      await markShopOrderDelivered({ data: { shopOrderId } })
      router.invalidate()
    } catch (err) {
      if (err instanceof Response) {
        try {
          const body = await err.json()
          setActionError(body.message || 'Failed to mark order as delivered')
        } catch {
          setActionError('Failed to mark order as delivered')
        }
      } else if (err instanceof Error) {
        setActionError(err.message)
      } else {
        setActionError('An unexpected error occurred')
      }
    } finally {
      setIsMarkingDelivered(false)
    }
  }, [shopOrderId, router])

  const canShip = ['paid', 'processing'].includes(order.status)
  const canDeliver = order.status === 'shipped'
  const shippingAddress = order.shippingAddress
  const countrySupported = isSupportedShippingCountry(shippingAddress.country)

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
            <h1 className='display-title text-2xl font-bold text-text-primary'>Order Detail</h1>
            <p className='font-mono text-sm text-text-secondary'>{shopOrderId.slice(0, 8)}…</p>
          </div>
          <Badge variant={getStatusBadgeVariant(order.status)} className='text-sm'>
            {order.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Error banner */}
        {actionError && (
          <div
            className='mb-6 rounded-lg bg-error/10 p-4 text-sm text-error'
            role='alert'
            aria-live='polite'
          >
            {actionError}
          </div>
        )}

        <div className='space-y-6'>
          {/* Status timeline */}
          {!['cancelled', 'refunded', 'disputed'].includes(order.status) && (
            <Card>
              <CardContent className='pt-6'>
                <StatusTimeline status={order.status} />
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          {(canShip || canDeliver) && (
            <div className='flex flex-wrap gap-3'>
              {canShip && (
                <Button onClick={() => setShipDialogOpen(true)}>
                  <Truck size={16} aria-hidden='true' />
                  Mark as Shipped
                </Button>
              )}
              {canDeliver && (
                <Button
                  variant='secondary'
                  onClick={handleMarkDelivered}
                  isLoading={isMarkingDelivered}
                >
                  <CheckCircle2 size={16} aria-hidden='true' />
                  Mark as Delivered
                </Button>
              )}
            </div>
          )}

          {/* Buyer & Shipping */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-sm'>
                  <Package size={16} className='text-text-muted' aria-hidden='true' />
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
                  <Truck size={16} className='text-text-muted' aria-hidden='true' />
                  Shipping Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='capitalize text-text-primary'>{order.shippingMethod}</p>
                {order.trackingNumber && (
                  <div className='mt-2 space-y-1'>
                    <p className='text-sm text-text-secondary'>
                      Tracking: {order.trackingNumber}
                    </p>
                    {order.trackingUrl ? (
                      <a
                        href={order.trackingUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 text-sm text-accent-primary hover:underline'
                      >
                        Track shipment
                        <Truck size={14} aria-hidden='true' />
                      </a>
                    ) : (
                      <p className='text-sm text-text-muted'>{order.trackingNumber}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-sm'>
                <MapPin size={16} className='text-text-muted' aria-hidden='true' />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-1'>
                <p className='text-text-primary'>{shippingAddress.name}</p>
                <p className='text-text-secondary'>{shippingAddress.street}</p>
                <p className='text-text-secondary'>
                  {shippingAddress.postalCode} {shippingAddress.city}
                </p>
                <div className='flex items-center gap-2'>
                  <p className='text-text-secondary'>{shippingAddress.country}</p>
                  {!countrySupported && (
                    <span className='inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning'>
                      <AlertTriangle size={12} aria-hidden='true' />
                      Unsupported country
                    </span>
                  )}
                </div>
              </div>
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
                  <li
                    key={item.id}
                    className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'
                  >
                    <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
                      <ImageOff size={16} className='text-text-muted' aria-hidden='true' />
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

      <ShipOrderDialog
        orderId={shopOrderId}
        open={shipDialogOpen}
        onOpenChange={setShipDialogOpen}
        onShipped={handleShipped}
      />
    </main>
  )
}

function ShopOrderDetailPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6 h-4 w-24 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-6 flex items-center justify-between'>
          <div className='space-y-2'>
            <div className='h-8 w-48 animate-pulse rounded bg-[var(--sand)]' />
            <div className='h-4 w-24 animate-pulse rounded bg-[var(--sand)]' />
          </div>
          <div className='h-6 w-20 animate-pulse rounded bg-[var(--sand)]' />
        </div>
        <div className='space-y-6'>
          <div className='h-32 animate-pulse rounded-xl bg-[var(--sand)]' />
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='h-32 animate-pulse rounded-xl bg-[var(--sand)]' />
            <div className='h-32 animate-pulse rounded-xl bg-[var(--sand)]' />
          </div>
          <div className='h-40 animate-pulse rounded-xl bg-[var(--sand)]' />
          <div className='h-48 animate-pulse rounded-xl bg-[var(--sand)]' />
        </div>
      </div>
    </main>
  )
}

function ShopOrderDetailError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl text-center'>
        <h1 className='display-title mb-4 text-2xl font-bold text-text-primary'>
          Failed to load order
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
      </div>
    </main>
  )
}
