import { Link, useLoaderData, useParams, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import {
  cancelShopOrder,
  markShopOrderDelivered,
  refundShopOrder,
  resolveShopOrderManualReview,
  updateShopOrderTracking,
} from '#/lib/shop-orders'
import { getOrderStatusLabel, statusBadgeVariant } from '#/lib/orders-ui'
import type { OrderStatus } from '#/lib/orders.server'
import { m } from '#/paraglide/messages'
import { ShopOrderShipDialog } from '#/route-components/studio/ShopOrderShipDialog'
import {
  BuyerInfoCard,
  OrderItemsCard,
  OrderStatusSection,
  ShippingAddressCard,
  ShippingLabelCard,
  ShippingMethodCard,
} from './ShopOrderDetailCards'

function parseResponseError(err: unknown): Promise<string> {
  if (err instanceof Response) {
    return err
      .json()
      .then((body) => body.message || 'An error occurred')
      .catch(() => 'An error occurred')
  }
  if (err instanceof Error) return Promise.resolve(err.message)
  return Promise.resolve('An unexpected error occurred')
}

export function ShopOrderDetailPage() {
  const { shopId, shopOrderId } = useParams({ from: '/studio/$shopId/orders/$shopOrderId' })
  const { order } = useLoaderData({ from: '/studio/$shopId/orders/$shopOrderId' })
  const currentStatus = order.status as OrderStatus
  const router = useRouter()
  const [shipDialog, setShipDialog] = useState({ open: false, key: 0 })
  const [reviewDialog, setReviewDialog] = useState(false)
  const [trackingForm, setTrackingForm] = useState({
    editing: false,
    number: order.trackingNumber ?? '',
    url: order.trackingUrl ?? '',
  })
  const [status, setStatus] = useState({
    actionError: null as string | null,
    isMarkingDelivered: false,
    isRefunding: false,
    isCancelling: false,
    isEditingTracking: false,
    isResolvingReview: false,
  })
  const [review, setReview] = useState<{ resolution: 'paid' | 'cancelled'; reason: string }>({
    resolution: 'paid',
    reason: '',
  })

  const setError = useCallback((message: string) => {
    setStatus((prev) => ({ ...prev, actionError: message }))
  }, [])

  const clearError = useCallback(() => {
    setStatus((prev) => ({ ...prev, actionError: null }))
  }, [])

  const withLoading = useCallback(
    async <T,>(
      key: keyof typeof status,
      fn: () => Promise<T>,
      errorMessage?: string,
    ): Promise<T | undefined> => {
      setStatus((prev) => ({ ...prev, [key]: true }))
      clearError()
      try {
        const result = await fn()
        router.invalidate()
        return result
      } catch (err) {
        const message = await parseResponseError(err)
        setError(errorMessage || message)
      } finally {
        setStatus((prev) => ({ ...prev, [key]: false }))
      }
    },
    [clearError, setError, router],
  )

  const handleShipped = useCallback(() => {
    router.invalidate()
  }, [router])

  const handleMarkDelivered = useCallback(() => {
    void withLoading('isMarkingDelivered', () => markShopOrderDelivered({ data: { shopOrderId } }))
  }, [withLoading, shopOrderId])

  const handleRefund = useCallback(() => {
    if (!window.confirm(m.order_refund_confirm())) return
    void withLoading(
      'isRefunding',
      () => refundShopOrder({ data: { shopOrderId } }),
      m.order_refund_error(),
    )
  }, [withLoading, shopOrderId])

  const handleCancel = useCallback(() => {
    if (!window.confirm(m.order_cancel_confirm())) return
    void withLoading(
      'isCancelling',
      () => cancelShopOrder({ data: { shopOrderId } }),
      m.order_cancel_error(),
    )
  }, [withLoading, shopOrderId])

  const handleSaveTracking = useCallback(() => {
    void withLoading(
      'isEditingTracking',
      () =>
        updateShopOrderTracking({
          data: {
            shopOrderId,
            trackingNumber: trackingForm.number.trim() || null,
            trackingUrl: trackingForm.url.trim() || null,
          },
        }),
      m.order_tracking_error(),
    ).then(() => setTrackingForm((prev) => ({ ...prev, editing: false })))
  }, [withLoading, shopOrderId, trackingForm.number, trackingForm.url])

  const handleResolveReview = useCallback(() => {
    void withLoading(
      'isResolvingReview',
      () =>
        resolveShopOrderManualReview({
          data: {
            shopOrderId,
            resolution: review.resolution,
            reason: review.reason.trim() || undefined,
          },
        }),
      m.manual_review_resolve_error(),
    ).then(() => setReviewDialog(false))
  }, [withLoading, shopOrderId, review.resolution, review.reason])

  const canShip = ['paid', 'processing'].includes(currentStatus)
  const canDeliver = currentStatus === 'shipped'
  const canRefund = ['paid', 'processing', 'shipped', 'delivered', 'manual_review'].includes(
    currentStatus,
  )
  const canCancel = currentStatus === 'pending_payment'
  const canEditTracking = currentStatus === 'shipped'
  const canResolveReview = currentStatus === 'manual_review'

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
          <Badge
            variant={statusBadgeVariant(currentStatus as OrderStatus)}
            className='text-sm'
            role='status'
            aria-live='polite'
          >
            {getOrderStatusLabel(currentStatus)}
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
            status={currentStatus}
            canShip={canShip}
            canDeliver={canDeliver}
            canRefund={canRefund}
            canCancel={canCancel}
            canEditTracking={canEditTracking}
            canResolveReview={canResolveReview}
            isMarkingDelivered={status.isMarkingDelivered}
            isRefunding={status.isRefunding}
            isCancelling={status.isCancelling}
            isEditingTracking={status.isEditingTracking}
            isResolvingReview={status.isResolvingReview}
            onShip={() => setShipDialog((prev) => ({ key: prev.key + 1, open: true }))}
            onMarkDelivered={handleMarkDelivered}
            onRefund={handleRefund}
            onCancel={handleCancel}
            onEditTracking={() =>
              setTrackingForm({
                editing: true,
                number: order.trackingNumber ?? '',
                url: order.trackingUrl ?? '',
              })
            }
            onResolveReview={() => setReviewDialog(true)}
          />

          {trackingForm.editing && (
            <div className='rounded-xl border border-border-subtle bg-surface-default p-4'>
              <h3 className='mb-3 text-sm font-semibold text-text-primary'>Edit Tracking</h3>
              <div className='space-y-3'>
                <div>
                  <Label htmlFor='tracking-number'>Tracking number</Label>
                  <Input
                    id='tracking-number'
                    value={trackingForm.number}
                    onChange={(e) =>
                      setTrackingForm((prev) => ({ ...prev, number: e.target.value }))
                    }
                    placeholder='Tracking number'
                  />
                </div>
                <div>
                  <Label htmlFor='tracking-url'>Tracking URL</Label>
                  <Input
                    id='tracking-url'
                    value={trackingForm.url}
                    onChange={(e) => setTrackingForm((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder='https://carrier.example/track/...'
                  />
                </div>
                <div className='flex gap-3'>
                  <Button
                    variant='primary'
                    isLoading={status.isEditingTracking}
                    onClick={handleSaveTracking}
                  >
                    Save
                  </Button>
                  <Button
                    variant='ghost'
                    onClick={() =>
                      setTrackingForm({
                        editing: false,
                        number: order.trackingNumber ?? '',
                        url: order.trackingUrl ?? '',
                      })
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <BuyerInfoCard buyer={order.buyer} />
            <ShippingMethodCard
              shippingMethod={order.shippingMethod}
              trackingNumber={order.trackingNumber}
              trackingUrl={order.trackingUrl}
            />
          </div>

          {order.labels.length > 0 && <ShippingLabelCard labels={order.labels} />}

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
        key={shipDialog.key}
        orderId={shopOrderId}
        open={shipDialog.open}
        onOpenChange={(open) => setShipDialog((prev) => ({ ...prev, open }))}
        onShipped={handleShipped}
      />

      {reviewDialog && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay p-4'
          role='dialog'
          aria-modal='true'
          aria-labelledby='review-dialog-title'
        >
          <div className='w-full max-w-md rounded-2xl bg-surface-default p-6 shadow-xl'>
            <h2 id='review-dialog-title' className='mb-2 text-lg font-semibold text-text-primary'>
              Resolve Manual Review
            </h2>
            <p className='mb-4 text-sm text-text-secondary'>
              Choose how to resolve this order that is under manual review.
            </p>
            <div className='mb-4 flex gap-3'>
              <Button
                type='button'
                variant={review.resolution === 'paid' ? 'primary' : 'secondary'}
                onClick={() => setReview((prev) => ({ ...prev, resolution: 'paid' }))}
              >
                {m.manual_review_resolve_paid()}
              </Button>
              <Button
                type='button'
                variant={review.resolution === 'cancelled' ? 'primary' : 'secondary'}
                onClick={() => setReview((prev) => ({ ...prev, resolution: 'cancelled' }))}
              >
                {m.manual_review_resolve_cancel()}
              </Button>
            </div>
            {review.resolution === 'cancelled' && (
              <div
                className='mb-4 rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm text-warning'
                role='alert'
              >
                {m.manual_review_cancel_refund_warning()}
              </div>
            )}
            <div className='mb-6'>
              <Label htmlFor='review-reason'>Reason (optional)</Label>
              <Textarea
                id='review-reason'
                value={review.reason}
                onChange={(e) => setReview((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder='Add a note about the decision...'
                rows={3}
              />
            </div>
            <div className='flex justify-end gap-3'>
              <Button variant='ghost' onClick={() => setReviewDialog(false)}>
                Cancel
              </Button>
              <Button
                variant='primary'
                isLoading={status.isResolvingReview}
                onClick={handleResolveReview}
              >
                Resolve
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
