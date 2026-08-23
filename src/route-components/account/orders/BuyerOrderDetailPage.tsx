import { Link } from '@tanstack/react-router'
import { ArrowLeft, Download, ImageOff, MapPin, Truck } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import type { OrderDetail, OrderShopGroup } from '#/lib/orders.server'
import { getOrderStatusLabel, statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import type { ReviewableItem } from '#/lib/reviews.server'
import type { ReturnRequestSummary } from '#/lib/returns'
import { m } from '#/paraglide/messages'
import { DisputeDialog } from './DisputeDialog'
import { OrderCancellationBanner } from './OrderCancellationBanner'
import { isDisputeEligible, OrderDisputeRow } from './OrderDisputeRow'
import type { OpenedDispute } from './OrderDisputeRow'
import { OrderReturnsPanel } from './OrderReturnsPanel'
import { OrderReviewsPanel } from './OrderReviewsPanel'
import { ReviewDialog } from './ReviewDialog'
import { formatDate } from './order-date'
import { ShopTrackingPanel } from './ShopTrackingPanel'

export interface BuyerOrderDetailPageProps {
  order: OrderDetail
  reviewableItems?: ReviewableItem[]
  returns?: ReturnRequestSummary[]
  backTo?: string
}

const EMPTY_ITEMS: ReviewableItem[] = []

export default function BuyerOrderDetailPage({
  order,
  reviewableItems = EMPTY_ITEMS,
  returns = [],
  backTo = '/orders',
}: BuyerOrderDetailPageProps) {
  const isCancelled = order.status === 'cancelled'
  const [reviews, setReviews] = useState<Record<string, ReviewableItem>>(() =>
    Object.fromEntries(reviewableItems.map((r) => [`${r.shopOrderId}-${r.productId}`, r])),
  )
  const [activeReviewItem, setActiveReviewItem] = useState<ReviewableItem | null>(null)
  const [activeDisputeShop, setActiveDisputeShop] = useState<OrderShopGroup | null>(null)
  const [openedDispute, setOpenedDispute] = useState<OpenedDispute | null>(null)

  const handleOpenReview = (item: ReviewableItem) => {
    if (!item.isEligible || item.hasReview) return
    setActiveReviewItem(item)
  }

  const handleCloseReview = () => {
    setActiveReviewItem(null)
  }

  const handleReviewSubmitted = (reviewKey: string) => {
    setReviews((prev) => ({
      ...prev,
      [reviewKey]: { ...prev[reviewKey], hasReview: true },
    }))
  }

  const handleOpenDispute = (shop: OrderShopGroup) => {
    const isDeliveredEligible = shop.status === 'delivered' && isDisputeEligible(shop.deliveredAt)
    const isNonDeliveryEligible = shop.nonDeliveryEligibility?.eligible === true
    if (!isDeliveredEligible && !isNonDeliveryEligible) return

    setActiveDisputeShop(shop)
  }

  const handleCloseDispute = () => {
    setActiveDisputeShop(null)
  }

  const handleDisputeOpened = (disputeId: string, shopOrderId: string) => {
    setOpenedDispute({ disputeId, shopOrderId })
  }

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6'>
          <Link
            to={backTo as never}
            className='inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary no-underline'
          >
            <ArrowLeft size={16} aria-hidden='true' />
            {m.orders_back_to_list()}
          </Link>
        </div>

        <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='display-title text-2xl font-semibold text-text-primary sm:text-3xl'>
              {m.order_detail_title()}
            </h1>
            <p className='mt-1 font-mono text-sm text-text-secondary'>
              {m.orders_order_number()}: {order.orderNumber}
            </p>
          </div>
          <Badge variant={statusBadgeVariant(order.status)}>
            {getOrderStatusLabel(order.status)}
          </Badge>
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
            <OrderCancellationBanner
              orderNumber={order.orderNumber}
              cancelledAt={order.cancelledAt}
              cancellationReason={order.cancellationReason}
            />
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
              {order.shippingAddress.pickupPoint && (
                <div className='mt-3 p-3 rounded-lg border border-accent-secondary/20 bg-surface-inset not-italic'>
                  <p className='text-[10px] font-bold text-accent-primary uppercase tracking-wider mb-1'>
                    Pick-up Point
                  </p>
                  <p className='font-semibold text-text-primary'>
                    {order.shippingAddress.pickupPoint.name}
                  </p>
                  <p className='text-xs text-text-secondary'>
                    {order.shippingAddress.pickupPoint.street}
                  </p>
                  <p className='text-xs text-text-secondary'>
                    {order.shippingAddress.pickupPoint.postalCode}{' '}
                    {order.shippingAddress.pickupPoint.city},{' '}
                    {order.shippingAddress.pickupPoint.country}
                  </p>
                  <p className='text-[10px] text-text-muted mt-1.5 font-mono'>
                    ID: {order.shippingAddress.pickupPoint.id}
                  </p>
                </div>
              )}
            </address>
          </div>

          <h2 className='mb-4 text-lg font-semibold text-text-primary'>{m.order_detail_items()}</h2>

          <div className='space-y-6'>
            {order.shops.map((shop) => (
              <section key={shop.shopOrderId} className='space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='text-sm font-semibold text-text-primary'>{shop.shopName}</h3>
                  <Badge variant={statusBadgeVariant(shop.status)}>
                    {getOrderStatusLabel(shop.status)}
                  </Badge>
                </div>

                {/* Items list first so buyers see what they paid for above the fold */}
                <ul className='divide-y divide-border-subtle'>
                  {shop.items.map((item) => (
                    <li key={item.id} className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'>
                      <div className='flex size-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className='h-full w-full object-cover'
                            loading='lazy'
                          />
                        ) : (
                          <>
                            <span className='sr-only'>{item.productName}</span>
                            <ImageOff size={16} className='text-text-muted' aria-hidden='true' />
                          </>
                        )}
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

                <div className='flex flex-wrap items-center gap-4 text-xs text-text-secondary'>
                  <span className='inline-flex items-center gap-1'>
                    <Truck size={14} aria-hidden='true' />
                    {shop.shippingMethod}: {formatPriceEUR(shop.shippingCostCents)}
                  </span>
                  {shop.invoiceNumber && (
                    <Link
                      to='/invoices/$invoiceId'
                      params={{ invoiceId: shop.invoiceNumber }}
                      className='inline-flex items-center gap-1 text-accent-primary font-semibold hover:underline print:hidden'
                    >
                      <Download size={12} aria-hidden='true' />
                      Invoice
                    </Link>
                  )}
                </div>

                <ShopTrackingPanel shop={shop} />

                <div className='flex justify-between text-sm'>
                  <span className='text-text-secondary'>{m.cart_shop_subtotal()}</span>
                  <span className='font-medium text-text-primary'>
                    {formatPriceEUR(shop.subtotalCents)}
                  </span>
                </div>
                {(shop.vatAmountCents > 0 || shop.shippingVatAmountCents > 0) && (
                  <div className='flex justify-between text-sm'>
                    <span className='text-text-secondary'>Includes VAT</span>
                    <span className='font-medium text-text-primary'>
                      {formatPriceEUR(shop.vatAmountCents + shop.shippingVatAmountCents)}
                    </span>
                  </div>
                )}
                {/* Review CTA for delivered/completed items */}
                {(shop.status === 'delivered' || shop.status === 'completed') && (
                  <OrderReviewsPanel
                    shop={shop}
                    reviews={reviews}
                    onOpenReview={handleOpenReview}
                  />
                )}

                {(shop.status === 'delivered' || shop.status === 'completed') && (
                  <OrderReturnsPanel
                    platformOrderId={order.id}
                    shopOrderId={shop.shopOrderId}
                    returns={returns}
                  />
                )}

                {(shop.status === 'delivered' ||
                  shop.nonDeliveryEligibility ||
                  shop.disputeId ||
                  openedDispute?.shopOrderId === shop.shopOrderId) && (
                  <OrderDisputeRow
                    shop={shop}
                    openedDispute={openedDispute}
                    onOpenDispute={handleOpenDispute}
                  />
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

      {activeReviewItem && (
        <ReviewDialog
          item={activeReviewItem}
          onClose={handleCloseReview}
          onSubmitted={handleReviewSubmitted}
        />
      )}
      {activeDisputeShop && (
        <DisputeDialog
          shop={activeDisputeShop}
          onClose={handleCloseDispute}
          onOpened={handleDisputeOpened}
        />
      )}
    </main>
  )
}
