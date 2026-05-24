import { Link, useLoaderData, useParams, useRouter } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileText,
  ImageOff,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import {
  FULFILLMENT_STATUSES,
  isStatusReached,
  isSupportedShippingCountry,
  statusTimelineLabel,
} from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import {
  markShopOrderDelivered,
  markShopOrderShipped,
  markShopOrderShippedWithLabel,
} from '#/lib/shop-orders'

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

export function StatusTimeline({ status }: { status: string }) {
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
                className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
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

export function ShipOrderDialog({
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
  const [form, setForm] = useState({
    mode: 'label' as 'label' | 'manual',
    trackingNumber: '',
    trackingUrl: '',
  })
  const [status, setStatus] = useState({
    isSubmitting: false,
    error: null as string | null,
    fieldErrors: {} as { trackingUrl?: string },
  })
  const validate = useCallback(() => {
    const errors: { trackingUrl?: string } = {}
    if (form.mode === 'manual' && form.trackingUrl.trim()) {
      try {
        new URL(form.trackingUrl.trim())
      } catch {
        errors.trackingUrl = 'Please enter a valid URL'
      }
    }
    setStatus((prev) => ({ ...prev, fieldErrors: errors }))
    return Object.keys(errors).length === 0
  }, [form])
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return
      setStatus((prev) => ({ ...prev, isSubmitting: true, error: null }))
      try {
        if (form.mode === 'label') {
          await markShopOrderShippedWithLabel({ data: { shopOrderId: orderId } })
        } else {
          await markShopOrderShipped({
            data: {
              shopOrderId: orderId,
              trackingNumber: form.trackingNumber.trim() || null,
              trackingUrl: form.trackingUrl.trim() || null,
            },
          })
        }
        onOpenChange(false)
        onShipped()
      } catch (err) {
        if (err instanceof Response) {
          try {
            const body = await err.json()
            setStatus((prev) => ({
              ...prev,
              error: body.message || 'Failed to mark order as shipped',
            }))
          } catch {
            setStatus((prev) => ({
              ...prev,
              error: 'Failed to mark order as shipped',
            }))
          }
        } else if (err instanceof Error) {
          setStatus((prev) => ({ ...prev, error: err.message }))
        } else {
          setStatus((prev) => ({ ...prev, error: 'An unexpected error occurred' }))
        }
      } finally {
        setStatus((prev) => ({ ...prev, isSubmitting: false }))
      }
    },
    [orderId, form, validate, onOpenChange, onShipped],
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='w-full max-w-md'>
            <form onSubmit={handleSubmit}>
              <DialogTitle>Mark as Shipped</DialogTitle>
              <DialogDescription>Choose how to provide tracking for this order.</DialogDescription>
              <div className='mt-4 space-y-4'>
                <div className='flex rounded-lg border border-border-default p-1'>
                  <button
                    type='button'
                    onClick={() => setForm((prev) => ({ ...prev, mode: 'label' }))}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      form.mode === 'label'
                        ? 'bg-accent-primary text-text-on-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Generate Label
                  </button>
                  <button
                    type='button'
                    onClick={() => setForm((prev) => ({ ...prev, mode: 'manual' }))}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      form.mode === 'manual'
                        ? 'bg-accent-primary text-text-on-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Manual Tracking
                  </button>
                </div>
                {form.mode === 'manual' && (
                  <>
                    <div>
                      <label
                        htmlFor='tracking-number'
                        className='mb-1.5 block text-sm font-medium text-text-secondary'
                      >
                        Tracking Number
                      </label>
                      <Input
                        id='tracking-number'
                        value={form.trackingNumber}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, trackingNumber: e.target.value }))
                        }
                        placeholder='e.g. TRACK123456'
                        disabled={status.isSubmitting}
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
                        value={form.trackingUrl}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, trackingUrl: e.target.value }))
                          if (status.fieldErrors.trackingUrl) {
                            setStatus((prev) => ({ ...prev, fieldErrors: {} }))
                          }
                        }}
                        placeholder='https://carrier.example.com/track'
                        disabled={status.isSubmitting}
                        error={status.fieldErrors.trackingUrl}
                      />
                      {status.fieldErrors.trackingUrl && (
                        <p id='tracking-url-error' className='mt-1 text-xs text-error'>
                          {status.fieldErrors.trackingUrl}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {form.mode === 'label' && (
                  <p className='text-sm text-text-secondary'>
                    The system will generate a shipping label via Mondial Relay using your shop's
                    origin address and the buyer's shipping address.
                  </p>
                )}
                {status.error && (
                  <div className='rounded-lg bg-error/10 p-3 text-sm text-error' role='alert'>
                    {status.error}
                  </div>
                )}
              </div>
              <div className='mt-6 flex justify-end gap-3'>
                <Button
                  type='button'
                  variant='ghost'
                  disabled={status.isSubmitting}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type='submit' isLoading={status.isSubmitting}>
                  Mark as Shipped
                </Button>
              </div>
            </form>
          </DialogPopup>
        </DialogPortal>
      )}
    </Dialog>
  )
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
          {!['cancelled', 'refunded', 'disputed'].includes(order.status) && (
            <Card>
              <CardContent className='pt-6'>
                <StatusTimeline status={order.status} />
              </CardContent>
            </Card>
          )}
          {(canShip || canDeliver) && (
            <div className='flex flex-wrap gap-3'>
              {canShip && (
                <Button onClick={() => setDialog((prev) => ({ key: prev.key + 1, open: true }))}>
                  <Truck size={16} aria-hidden='true' />
                  Mark as Shipped
                </Button>
              )}
              {canDeliver && (
                <Button
                  variant='secondary'
                  onClick={handleMarkDelivered}
                  isLoading={status.isMarkingDelivered}
                >
                  <CheckCircle2 size={16} aria-hidden='true' />
                  Mark as Delivered
                </Button>
              )}
            </div>
          )}
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
                    <p className='text-sm text-text-secondary'>Tracking: {order.trackingNumber}</p>
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
          {order.label && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-sm'>
                  <FileText size={16} className='text-text-muted' aria-hidden='true' />
                  Shipping Label
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  <p className='text-sm text-text-secondary'>
                    Carrier:{' '}
                    <span className='font-medium text-text-primary'>{order.label.carrier}</span>
                  </p>
                  {order.label.trackingNumber && (
                    <p className='text-sm text-text-secondary'>
                      Tracking:{' '}
                      <span className='font-medium text-text-primary'>
                        {order.label.trackingNumber}
                      </span>
                    </p>
                  )}
                  {order.label.labelUrl && (
                    <a
                      href={order.label.labelUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-1 text-sm text-accent-primary hover:underline'
                    >
                      Download / print label
                      <FileText size={14} aria-hidden='true' />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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
                {shippingAddress.pickupPoint && (
                  <div className='mt-3 p-3 rounded-lg border border-accent-secondary/20 bg-surface-inset not-italic'>
                    <p className='text-[10px] font-bold text-accent-primary uppercase tracking-wider mb-1'>
                      Mondial Relay Pick-up Point
                    </p>
                    <p className='font-semibold text-text-primary text-sm'>
                      {shippingAddress.pickupPoint.name}
                    </p>
                    <p className='text-xs text-text-secondary'>
                      {shippingAddress.pickupPoint.street}
                    </p>
                    <p className='text-xs text-text-secondary'>
                      {shippingAddress.pickupPoint.postalCode} {shippingAddress.pickupPoint.city},{' '}
                      {shippingAddress.pickupPoint.country}
                    </p>
                    <p className='text-[10px] text-text-muted mt-1.5 font-mono'>
                      ID: {shippingAddress.pickupPoint.id}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className='divide-y divide-border-subtle'>
                {order.items.map((item) => (
                  <li key={item.id} className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'>
                    <div className='flex size-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
                      <ImageOff size={16} className='text-text-muted' aria-hidden='true' />
                    </div>
                    <div className='flex-1'>
                      <p className='text-sm font-medium text-text-primary'>{item.productName}</p>
                      <p className='text-xs text-text-secondary'>
                        {formatPriceEUR(item.unitPriceCents)} × {item.quantity}
                      </p>
                      {item.vatRateBasisPoints > 0 && (
                        <p className='text-xs text-text-muted'>
                          VAT {(item.vatRateBasisPoints / 100).toFixed(2).replace(/\.00$/, '')}%:{' '}
                          {formatPriceEUR(item.vatAmountCents)}
                        </p>
                      )}
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
                {order.vatAmountCents > 0 && (
                  <div className='flex justify-between text-text-secondary'>
                    <span>Item VAT</span>
                    <span>{formatPriceEUR(order.vatAmountCents)}</span>
                  </div>
                )}
                {order.shippingVatAmountCents > 0 && (
                  <div className='flex justify-between text-text-secondary'>
                    <span>
                      Shipping VAT (
                      {(order.shippingVatRateBasisPoints / 100).toFixed(2).replace(/\.00$/, '')}%)
                    </span>
                    <span>{formatPriceEUR(order.shippingVatAmountCents)}</span>
                  </div>
                )}
                {order.vatAmountCents > 0 || order.shippingVatAmountCents > 0 ? (
                  <div className='flex justify-between text-text-secondary'>
                    <span>Total VAT</span>
                    <span>
                      {formatPriceEUR(order.vatAmountCents + order.shippingVatAmountCents)}
                    </span>
                  </div>
                ) : null}
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
        key={dialog.key}
        orderId={shopOrderId}
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        onShipped={handleShipped}
      />
    </main>
  )
}

export function ShopOrderDetailPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6 size-4 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-6 flex items-center justify-between'>
          <div className='space-y-2'>
            <div className='size-8 animate-pulse rounded bg-[var(--sand)]' />
            <div className='size-4 animate-pulse rounded bg-[var(--sand)]' />
          </div>
          <div className='size-6 animate-pulse rounded bg-[var(--sand)]' />
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

export function ShopOrderDetailError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl text-center'>
        <h1 className='display-title mb-4 text-2xl font-semibold text-text-primary'>
          Failed to load order
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
      </div>
    </main>
  )
}
