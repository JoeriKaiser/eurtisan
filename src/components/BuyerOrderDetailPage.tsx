import { Link, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, ExternalLink, ImageOff, MapPin, Package, Star, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { Skeleton } from '#/components/ui/skeleton'
import { openDispute } from '#/lib/disputes'
import type { OrderDetail, OrderShopGroup, OrderStatus } from '#/lib/orders.server'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { getCarrierTrackingUrl } from '#/lib/shipping'
import { createReview } from '#/lib/reviews'
import type { ReviewableItem } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
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

function formatCarrierName(carrier: string): string {
  return carrier.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTrackingStatus(status: string): string {
  const map: Record<string, string> = {
    label_created: 'Label created',
    in_transit: 'In transit',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
  }
  return map[status] ?? status
}

function trackingStatusColorClass(status: string): string {
  if (status === 'delivered') return 'text-success'
  if (status === 'out_for_delivery') return 'text-warning'
  if (status === 'in_transit') return 'text-accent-primary'
  if (status === 'label_created') return 'text-text-secondary'
  return 'text-text-secondary'
}

function isDisputeEligible(deliveredAt: Date | null): boolean {
  if (!deliveredAt) return false
  const daysSinceDelivery = (Date.now() - deliveredAt.getTime()) / (24 * 60 * 60 * 1000)
  return daysSinceDelivery <= 30
}

function getStatusProgress(status: OrderStatus): number {
  const steps: OrderStatus[] = [
    'pending_payment',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'completed',
  ]
  const index = steps.indexOf(status)
  if (index === -1) return 0
  return ((index + 1) / steps.length) * 100
}

export interface BuyerOrderDetailPageProps {
  order: OrderDetail
  reviewableItems?: ReviewableItem[]
}

export default function BuyerOrderDetailPage({
  order,
  reviewableItems = [],
}: BuyerOrderDetailPageProps) {
  const isCancelled = order.status === 'cancelled'
  const [reviews, setReviews] = useState<Record<string, ReviewableItem>>(() =>
    Object.fromEntries(reviewableItems.map((r) => [`${r.shopOrderId}-${r.productId}`, r])),
  )
  const router = useRouter()
  const [activeReviewItem, setActiveReviewItem] = useState<ReviewableItem | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [activeDisputeShop, setActiveDisputeShop] = useState<OrderShopGroup | null>(null)
  const [disputeReason, setDisputeReason] = useState('item_not_received')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [isDisputeSubmitting, setIsDisputeSubmitting] = useState(false)
  const [disputeError, setDisputeError] = useState<string | null>(null)

  const handleOpenReview = (item: ReviewableItem) => {
    if (!item.isEligible || item.hasReview) return
    setRating(0)
    setHoverRating(0)
    setComment('')
    setSubmitError(null)
    setActiveReviewItem(item)
  }

  const handleOpenDispute = (shop: OrderShopGroup) => {
    if (shop.status !== 'delivered' || !isDisputeEligible(shop.deliveredAt)) return
    setDisputeReason('item_not_received')
    setDisputeDescription('')
    setDisputeError(null)
    setActiveDisputeShop(shop)
  }

  const handleCloseDispute = () => {
    setActiveDisputeShop(null)
    setDisputeReason('item_not_received')
    setDisputeDescription('')
    setDisputeError(null)
  }

  const handleSubmitDispute = async () => {
    if (!activeDisputeShop || !disputeDescription.trim()) return
    setIsDisputeSubmitting(true)
    setDisputeError(null)
    try {
      await openDispute({
        data: {
          shopOrderId: activeDisputeShop.shopOrderId,
          reason: disputeReason,
          description: disputeDescription.trim(),
        },
      })
      router.invalidate()
      handleCloseDispute()
    } catch (err) {
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({ message: 'Unknown error' }))
        setDisputeError(body.message || 'Failed to open dispute')
      } else {
        setDisputeError('Failed to open dispute')
      }
    } finally {
      setIsDisputeSubmitting(false)
    }
  }

  const handleCloseReview = () => {
    setActiveReviewItem(null)
    setRating(0)
    setHoverRating(0)
    setComment('')
    setSubmitError(null)
  }

  const handleSubmitReview = async () => {
    if (!activeReviewItem || rating < 1 || rating > 5) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await createReview({
        data: {
          shopOrderId: activeReviewItem.shopOrderId,
          productId: activeReviewItem.productId,
          rating,
          comment: comment.trim() || null,
        },
      })
      const key = `${activeReviewItem.shopOrderId}-${activeReviewItem.productId}`
      setReviews((prev) => ({
        ...prev,
        [key]: { ...prev[key], hasReview: true },
      }))
      handleCloseReview()
    } catch (err) {
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({ message: 'Unknown error' }))
        setSubmitError(body.message || 'Failed to submit review')
      } else {
        setSubmitError('Failed to submit review')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6'>
          <Link
            to='/orders'
            className='inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary no-underline'
          >
            <ArrowLeft size={16} aria-hidden='true' />
            {m.orders_back_to_list()}
          </Link>
        </div>

        <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='display-title text-2xl font-bold text-text-primary sm:text-3xl'>
              {m.order_detail_title()}
            </h1>
            <p className='mt-1 font-mono text-sm text-text-secondary'>{order.id}</p>
          </div>
          <Badge variant={statusBadgeVariant(order.status)}>{order.status}</Badge>
        </div>

        <div className='island-shell rounded-2xl p-6'>
          <div className='mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-4'>
            <div>
              <p className='text-sm text-text-secondary'>{m.order_detail_date()}</p>
              <p className='text-sm font-medium text-text-primary'>{formatDate(order.createdAt)}</p>
            </div>
            <div className='text-right'>
              <p className='text-sm text-text-secondary'>{m.order_detail_total()}</p>
              <p className='text-lg font-bold text-text-primary'>
                {formatPriceEUR(order.totalCents)}
              </p>
            </div>
          </div>

          {isCancelled && (
            <div className='mb-6 rounded-lg border border-error/20 bg-error-subtle p-4'>
              <p className='font-medium text-error'>{m.order_detail_cancelled()}</p>
              {order.cancelledAt && (
                <p className='mt-1 text-sm text-error/80'>
                  {m.order_detail_cancelled_at({ date: formatDate(order.cancelledAt) })}
                </p>
              )}
              {order.cancellationReason && (
                <p className='mt-1 text-sm text-error/80'>
                  {m.order_detail_cancellation_reason({ reason: order.cancellationReason })}
                </p>
              )}
            </div>
          )}

          {/* Shipping Address */}
          <div className='mb-6 border-b border-border-default pb-4'>
            <h2 className='mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary'>
              <MapPin size={16} aria-hidden='true' />
              {m.order_detail_shipping_address()}
            </h2>
            <address className='not-italic text-sm text-text-secondary'>
              <p className='text-text-primary'>{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.postalCode} {order.shippingAddress.city}
              </p>
              <p>{order.shippingAddress.country}</p>
            </address>
          </div>

          <h2 className='mb-4 text-lg font-semibold text-text-primary'>{m.order_detail_items()}</h2>

          <div className='space-y-8'>
            {order.shops.map((shop) => (
              <section key={shop.shopOrderId} className='space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='text-sm font-semibold text-text-primary'>{shop.shopName}</h3>
                  <Badge variant={statusBadgeVariant(shop.status)}>{shop.status}</Badge>
                </div>

                {/* Progress indicator for non-terminal statuses */}
                {!['cancelled', 'refunded', 'disputed'].includes(shop.status) && (
                  <div className='space-y-1'>
                    <div
                      className='h-2 w-full overflow-hidden rounded-full bg-surface-inset'
                      role='progressbar'
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(getStatusProgress(shop.status))}
                      aria-label={`${shop.shopName} order progress`}
                    >
                      <svg className='h-full w-full' preserveAspectRatio='none' viewBox='0 0 100 1'>
                        <rect
                          width={getStatusProgress(shop.status)}
                          height='1'
                          className='fill-accent-primary'
                        />
                      </svg>
                    </div>
                    <p className='text-xs text-text-muted'>
                      {Math.round(getStatusProgress(shop.status))}% {m.order_detail_shop_status()}
                    </p>
                  </div>
                )}

                <div className='flex flex-wrap items-center gap-4 text-xs text-text-secondary'>
                  <span className='inline-flex items-center gap-1'>
                    <Truck size={14} aria-hidden='true' />
                    {shop.shippingMethod} — {formatPriceEUR(shop.shippingCostCents)}
                  </span>
                </div>

                {/* Tracking Information */}
                {shop.shippingLabel ? (
                  <div className='rounded-lg border border-border-default bg-surface-inset p-3 space-y-2'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='space-y-0.5'>
                        <p className='text-sm font-semibold text-text-primary'>
                          {formatCarrierName(shop.shippingLabel.carrier)}
                        </p>
                        <p className='text-xs text-text-secondary'>
                          {m.order_detail_tracking()}:{' '}
                          <span className='font-mono text-text-primary'>
                            {shop.shippingLabel.trackingNumber}
                          </span>
                        </p>
                      </div>
                      {(isValidUrl(shop.trackingUrl) ||
                        (shop.shippingLabel.trackingNumber &&
                          getCarrierTrackingUrl(shop.shippingLabel.carrier, shop.shippingLabel.trackingNumber))) && (
                        <a
                          href={
                            isValidUrl(shop.trackingUrl)
                              ? shop.trackingUrl
                              : getCarrierTrackingUrl(shop.shippingLabel.carrier, shop.shippingLabel.trackingNumber!)!
                          }
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-1 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-primary/90'
                        >
                          <ExternalLink size={12} aria-hidden='true' />
                          {m.order_detail_track_package()}
                        </a>
                      )}
                    </div>
                    {shop.trackingStatus && (
                      <div className='flex items-center gap-2'>
                        <Package size={14} aria-hidden='true' className='text-text-muted' />
                        <span className={`text-xs font-medium ${trackingStatusColorClass(shop.trackingStatus)}`}>
                          {formatTrackingStatus(shop.trackingStatus)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : shop.trackingNumber ? (
                  <div className='rounded-lg border border-border-default bg-surface-inset p-3 space-y-2'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <p className='text-xs text-text-secondary'>
                        {m.order_detail_tracking()}:{' '}
                        <span className='font-mono text-text-primary'>{shop.trackingNumber}</span>
                      </p>
                      {isValidUrl(shop.trackingUrl) && (
                        <a
                          href={shop.trackingUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-1 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-primary/90'
                        >
                          <ExternalLink size={12} aria-hidden='true' />
                          {m.order_detail_track_package()}
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  !['cancelled', 'refunded', 'pending_payment', 'paid'].includes(shop.status) && (
                    <div className='rounded-lg border border-border-default bg-surface-inset p-3'>
                      <p className='text-xs text-text-muted'>
                        {m.order_detail_not_yet_shipped()}
                      </p>
                    </div>
                  )
                )}

                <ul className='divide-y divide-border-subtle'>
                  {shop.items.map((item) => (
                    <li key={item.id} className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'>
                      <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
                        <span className='sr-only'>{item.productName}</span>
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

                <div className='flex justify-between text-sm'>
                  <span className='text-text-secondary'>{m.cart_shop_subtotal()}</span>
                  <span className='font-medium text-text-primary'>
                    {formatPriceEUR(shop.subtotalCents)}
                  </span>
                </div>

                {/* Review CTA for delivered/completed items */}
                {(shop.status === 'delivered' || shop.status === 'completed') && (
                  <div className='rounded-lg border border-border-default bg-surface-inset p-3'>
                    {shop.items.map((item) => {
                      const reviewKey = `${shop.shopOrderId}-${item.productId}`
                      const reviewable = reviews[reviewKey]
                      if (!reviewable) return null
                      return (
                        <div
                          key={item.id}
                          className='flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0'
                        >
                          <span className='text-sm text-text-secondary truncate'>
                            {item.productName}
                          </span>
                          {reviewable.hasReview ? (
                            <span className='inline-flex items-center gap-1 text-xs font-medium text-success'>
                              <Star size={14} fill='currentColor' aria-hidden='true' />
                              {m.review_submitted()}
                            </span>
                          ) : reviewable.isEligible ? (
                            <Button
                              variant='secondary'
                              size='sm'
                              onClick={() => handleOpenReview(reviewable)}
                            >
                              <Star size={14} className='mr-1' aria-hidden='true' />
                              {m.order_detail_review()}
                            </Button>
                          ) : (
                            <Button
                              variant='secondary'
                              size='sm'
                              disabled
                              title={m.order_detail_review_disabled_tooltip({
                                days: String(reviewable.daysRemaining ?? 0),
                              })}
                            >
                              <Star size={14} className='mr-1' aria-hidden='true' />
                              {m.order_detail_review_disabled({
                                date: reviewable.daysRemaining
                                  ? m.review_days_remaining({
                                      days: String(reviewable.daysRemaining),
                                    })
                                  : '',
                              })}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Dispute CTA for delivered items */}
                {shop.status === 'delivered' && (
                  <div className='flex justify-end'>
                    {isDisputeEligible(shop.deliveredAt) ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleOpenDispute(shop)}
                        className='text-error hover:bg-error/5 hover:text-error'
                      >
                        <AlertTriangle size={14} className='mr-1' aria-hidden='true' />
                        {m.order_detail_open_dispute()}
                      </Button>
                    ) : (
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled
                        title={m.order_detail_dispute_disabled_tooltip()}
                        className='text-text-muted'
                      >
                        <AlertTriangle size={14} className='mr-1' aria-hidden='true' />
                        {m.order_detail_open_dispute()}
                      </Button>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>

          <div className='mt-6 border-t border-border-default pt-6 text-center'>
            <Link to='/category/all' className='no-underline'>
              <Button size='lg'>{m.order_success_continue_shopping()}</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <Dialog
        open={activeReviewItem !== null}
        onOpenChange={(open) => !open && handleCloseReview()}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='max-w-md'>
            <div className='flex items-center justify-between'>
              <DialogTitle>{m.review_modal_title()}</DialogTitle>
              <button
                type='button'
                onClick={handleCloseReview}
                className='rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-inset hover:text-text-primary'
                aria-label={m.review_modal_close()}
              >
                <X size={18} aria-hidden='true' />
              </button>
            </div>
            <DialogDescription>{m.review_modal_description()}</DialogDescription>

            {activeReviewItem && (
              <div className='mt-4 space-y-4'>
                <p className='text-sm font-medium text-text-primary'>
                  {activeReviewItem.productName}
                </p>

                {/* Star Rating */}
                <div className='flex items-center justify-center gap-1'>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type='button'
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className='rounded p-0.5 transition-colors hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/40'
                      aria-label={m.review_star_label({ star: String(star) })}
                    >
                      <Star
                        size={28}
                        className={`transition-colors ${
                          (hoverRating ? star <= hoverRating : star <= rating)
                            ? 'fill-warning text-warning'
                            : 'text-text-muted'
                        }`}
                        aria-hidden='true'
                      />
                    </button>
                  ))}
                </div>
                <p className='text-center text-xs text-text-secondary'>
                  {rating > 0
                    ? m.review_rating_selected({ rating: String(rating) })
                    : m.review_rating_prompt()}
                </p>

                {/* Comment */}
                <div>
                  <label
                    htmlFor='review-comment'
                    className='mb-1 block text-sm font-medium text-text-primary'
                  >
                    {m.review_comment_label()}
                  </label>
                  <textarea
                    id='review-comment'
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={m.review_comment_placeholder()}
                    className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50 resize-none'
                    maxLength={2000}
                    disabled={isSubmitting}
                  />
                  <p className='mt-1 text-right text-xs text-text-muted'>{comment.length}/2000</p>
                </div>

                {submitError && <p className='text-sm text-error'>{submitError}</p>}

                <div className='flex justify-end gap-3'>
                  <Button variant='secondary' onClick={handleCloseReview} disabled={isSubmitting}>
                    {m.review_cancel()}
                  </Button>
                  <Button
                    onClick={handleSubmitReview}
                    isLoading={isSubmitting}
                    disabled={rating < 1 || isSubmitting}
                  >
                    {m.review_submit()}
                  </Button>
                </div>
              </div>
            )}
          </DialogPopup>
        </DialogPortal>
      </Dialog>

      {/* Dispute Modal */}
      <Dialog
        open={activeDisputeShop !== null}
        onOpenChange={(open) => !open && handleCloseDispute()}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='max-w-md'>
            <div className='flex items-center justify-between'>
              <DialogTitle>{m.dispute_modal_title()}</DialogTitle>
              <button
                type='button'
                onClick={handleCloseDispute}
                className='rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-inset hover:text-text-primary'
                aria-label={m.dispute_modal_close()}
              >
                <X size={18} aria-hidden='true' />
              </button>
            </div>
            <DialogDescription>{m.dispute_modal_description()}</DialogDescription>

            {activeDisputeShop && (
              <form
                className='mt-4 space-y-4'
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSubmitDispute()
                }}
              >
                <div>
                  <label
                    htmlFor='dispute-reason'
                    className='mb-1.5 block text-sm font-medium text-text-primary'
                  >
                    {m.dispute_reason_label()}
                  </label>
                  <select
                    id='dispute-reason'
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    disabled={isDisputeSubmitting}
                    className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50'
                  >
                    <option value='item_not_received'>
                      {m.dispute_reason_item_not_received()}
                    </option>
                    <option value='not_as_described'>{m.dispute_reason_not_as_described()}</option>
                    <option value='damaged'>{m.dispute_reason_damaged()}</option>
                    <option value='other'>{m.dispute_reason_other()}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='dispute-description'
                    className='mb-1.5 block text-sm font-medium text-text-primary'
                  >
                    {m.dispute_description_label()}
                  </label>
                  <textarea
                    id='dispute-description'
                    rows={4}
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder={m.dispute_description_placeholder()}
                    className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50 resize-none'
                    maxLength={5000}
                    disabled={isDisputeSubmitting}
                    required
                  />
                  <p className='mt-1 text-right text-xs text-text-muted'>
                    {disputeDescription.length}/5000
                  </p>
                </div>

                {disputeError && <p className='text-sm text-error'>{disputeError}</p>}

                <div className='flex justify-end gap-3'>
                  <Button
                    variant='secondary'
                    onClick={handleCloseDispute}
                    disabled={isDisputeSubmitting}
                    type='button'
                  >
                    {m.dispute_cancel()}
                  </Button>
                  <Button
                    type='submit'
                    isLoading={isDisputeSubmitting}
                    disabled={!disputeDescription.trim() || isDisputeSubmitting}
                  >
                    {m.dispute_submit()}
                  </Button>
                </div>
              </form>
            )}
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </main>
  )
}

export function BuyerOrderDetailLoading() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-3xl'>
        <Skeleton className='mb-6 h-4 w-32' />
        <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-4 w-64' />
          </div>
          <Skeleton className='h-6 w-24 rounded-full' />
        </div>
        <div className='island-shell rounded-2xl p-6 space-y-6'>
          <Skeleton className='h-20 w-full' />
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-40 w-full' />
        </div>
      </div>
    </main>
  )
}

export function BuyerOrderDetailError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-3xl text-center'>
        <p className='text-text-secondary'>{m.orders_error()}</p>
        <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
        <Link to='/orders' className='mt-4 inline-block no-underline'>
          <Button variant='secondary'>{m.orders_back_to_list()}</Button>
        </Link>
      </div>
    </main>
  )
}
