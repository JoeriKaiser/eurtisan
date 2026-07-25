import { Link } from '@tanstack/react-router'
import { CheckCircle2, Download, ImageOff, Loader2, MapPin, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { rebuildCartFromOrder } from '#/lib/checkout'
import type { OrderDetail } from '#/lib/orders.server'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'

const SUPPORT_EMAIL = 'support@eurtisan.eu'

export interface OrderSuccessPageProps {
  order: OrderDetail
  onRetryPayment?: () => Promise<{ checkoutUrl: string }>
}

type FailureKind = 'expired' | 'failed' | 'cancelled'

function getFailureKind(order: OrderDetail): FailureKind {
  if (order.status !== 'cancelled') return 'failed'
  const reason = (order.cancellationReason ?? '').toLowerCase()
  if (reason.includes('expired')) return 'expired'
  if (reason.includes('failed')) return 'failed'
  return 'cancelled'
}

export default function OrderSuccessPage({ order, onRetryPayment }: OrderSuccessPageProps) {
  const isPending = order.status === 'pending_payment'
  const isCancelled = order.status === 'cancelled'
  const isPaid = order.status === 'paid'
  const failureKind = getFailureKind(order)

  const [retryState, setRetryState] = useState<{
    isLoading: boolean
    error: string | null
    reservationExpired: boolean
  }>({ isLoading: false, error: null, reservationExpired: false })

  const handleRetryPayment = async () => {
    if (!onRetryPayment) return
    setRetryState({ isLoading: true, error: null, reservationExpired: false })
    try {
      const result = await onRetryPayment()
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }
      setRetryState({
        isLoading: false,
        error: m.checkout_missing_url(),
        reservationExpired: false,
      })
    } catch (err) {
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({}))
        setRetryState({
          isLoading: false,
          error: body.message || m.checkout_error_submit(),
          reservationExpired: body.code === 'RESERVATION_EXPIRED',
        })
      } else {
        setRetryState({
          isLoading: false,
          error: m.checkout_error_submit(),
          reservationExpired: false,
        })
      }
    }
  }

  const handleRebuildCart = async () => {
    setRetryState((state) => ({ ...state, isLoading: true, error: null }))
    try {
      const result = await rebuildCartFromOrder({ data: { platformOrderId: order.id } })
      window.location.href = result.skipped > 0 ? '/cart?message=stock_changed' : '/cart'
    } catch {
      setRetryState({
        isLoading: false,
        error: m.order_failed_rebuild_error(),
        reservationExpired: true,
      })
    }
  }

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-2xl'>
        <div className='mb-8 text-center'>
          {isPaid && (
            <>
              <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-subtle text-success'>
                <CheckCircle2 size={32} aria-hidden='true' />
              </div>
              <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary sm:text-3xl'>
                {m.order_success_title()}
              </h1>
              <p className='text-text-secondary'>{m.order_success_description()}</p>
            </>
          )}

          {isPending && (
            <>
              <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-warning-subtle text-warning'>
                <Loader2 size={32} aria-hidden='true' className='animate-spin' />
              </div>
              <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary sm:text-3xl'>
                {m.order_pending_title()}
              </h1>
              <p className='text-text-secondary'>{m.order_pending_description()}</p>
            </>
          )}

          {isCancelled && (
            <>
              <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-error-subtle text-error'>
                <XCircle size={32} aria-hidden='true' />
              </div>
              <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary sm:text-3xl'>
                {failureKind === 'expired'
                  ? m.order_failed_expired_title()
                  : failureKind === 'cancelled'
                    ? m.order_failed_cancelled_title()
                    : m.order_failed_failed_title()}
              </h1>
              <p className='text-text-secondary'>
                {failureKind === 'expired'
                  ? m.order_failed_expired_description()
                  : failureKind === 'cancelled'
                    ? m.order_failed_cancelled_description()
                    : m.order_failed_failed_description()}
              </p>
            </>
          )}

          {!isPaid && !isPending && !isCancelled && (
            <>
              <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-subtle text-success'>
                <CheckCircle2 size={32} aria-hidden='true' />
              </div>
              <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary sm:text-3xl'>
                {m.order_success_title()}
              </h1>
              <p className='text-text-secondary'>{m.order_success_description()}</p>
            </>
          )}
        </div>

        <div className='island-shell rounded-2xl p-6'>
          <div className='mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-4'>
            <div>
              <p className='text-sm text-text-secondary'>{m.order_success_order_number()}</p>
              <p className='font-mono text-sm font-medium text-text-primary'>{order.orderNumber}</p>
            </div>
            <div className='text-right'>
              <p className='text-sm text-text-secondary'>{m.order_success_total()}</p>
              <p className='text-lg font-bold text-text-primary'>
                {formatPriceEUR(order.totalCents)}
              </p>
            </div>
          </div>

          {isPaid && (
            <div className='mb-6 grid gap-4 border-b border-border-default pb-6 sm:grid-cols-2'>
              <div>
                <h2 className='flex items-center gap-2 text-sm font-semibold text-text-primary'>
                  <MapPin size={16} aria-hidden='true' />
                  {m.order_detail_shipping_address()}
                </h2>
                <address className='mt-2 not-italic text-sm leading-relaxed text-text-secondary'>
                  <span className='block text-text-primary'>{order.shippingAddress.name}</span>
                  <span className='block'>{order.shippingAddress.street}</span>
                  {order.shippingAddress.addressLine2 && (
                    <span className='block'>{order.shippingAddress.addressLine2}</span>
                  )}
                  <span className='block'>
                    {order.shippingAddress.postalCode} {order.shippingAddress.city}
                  </span>
                  <span className='block'>{order.shippingAddress.country}</span>
                </address>
              </div>
              <div>
                <h2 className='text-sm font-semibold text-text-primary'>
                  {m.order_success_next_steps()}
                </h2>
                <p className='mt-2 text-sm leading-relaxed text-text-secondary'>
                  {m.order_success_email_sent({ email: order.shippingAddress.contactEmail ?? '' })}
                </p>
              </div>
            </div>
          )}

          <h2 className='mb-4 text-lg font-semibold text-text-primary'>
            {m.order_success_items()}
          </h2>

          <div className='space-y-6'>
            {order.shops.map((shop) => (
              <section key={shop.shopId} className='space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='text-sm font-semibold text-text-primary'>{shop.shopName}</h3>
                  <span className='text-xs text-text-secondary capitalize'>
                    {shop.shippingMethod}: {formatPriceEUR(shop.shippingCostCents)}
                  </span>
                </div>
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
              </section>
            ))}
          </div>

          {isPaid && (
            <p className='mt-6 text-sm text-text-secondary leading-relaxed border-t border-border-default pt-6'>
              {m.order_success_withdrawal_reminder()}{' '}
              <Link to='/terms' className='text-accent-primary underline-offset-2 hover:underline'>
                {m.footer_legal_terms()}
              </Link>
              .
            </p>
          )}

          <div className='mt-6 border-t border-border-default pt-6 flex flex-col items-center gap-3'>
            <div className='flex flex-wrap items-center justify-center gap-3'>
              {isPending && onRetryPayment && (
                <Button
                  size='lg'
                  onClick={() => {
                    void handleRetryPayment()
                  }}
                  isLoading={retryState.isLoading}
                  disabled={retryState.isLoading}
                >
                  {m.order_pending_retry_payment()}
                </Button>
              )}

              {isCancelled && (
                <>
                  {onRetryPayment && (
                    <Button
                      size='lg'
                      onClick={() => {
                        void handleRetryPayment()
                      }}
                      isLoading={retryState.isLoading}
                      disabled={retryState.isLoading}
                    >
                      {m.order_failed_retry_payment()}
                    </Button>
                  )}
                  <Link to='/orders/$platformOrderId' params={{ platformOrderId: order.id }}>
                    <Button variant='secondary' size='lg'>
                      {m.order_failed_view_order()}
                    </Button>
                  </Link>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Payment issue for order ${order.orderNumber}`}
                    className='no-underline'
                  >
                    <Button variant='secondary' size='lg'>
                      {m.order_failed_contact_support()}
                    </Button>
                  </a>
                </>
              )}

              {isPaid && (
                <Link
                  to='/orders/$platformOrderId'
                  params={{ platformOrderId: order.id }}
                  className='no-underline'
                >
                  <Button size='lg'>{m.order_success_view_order()}</Button>
                </Link>
              )}
              {isPaid &&
                order.shops
                  .filter((shop) => shop.invoiceNumber)
                  .map((shop) => (
                    <Link
                      key={shop.shopOrderId}
                      to='/invoices/$invoiceId'
                      params={{ invoiceId: shop.invoiceNumber ?? '' }}
                      className='no-underline'
                    >
                      <Button size='lg' variant='secondary'>
                        <Download size={16} aria-hidden='true' />
                        {m.order_success_invoice({ shop: shop.shopName })}
                      </Button>
                    </Link>
                  ))}
              <Link to='/category/all' className='no-underline'>
                <Button size='lg' variant='secondary'>
                  {m.order_success_continue_shopping()}
                </Button>
              </Link>
            </div>

            {retryState.reservationExpired && (
              <Button
                size='lg'
                onClick={() => void handleRebuildCart()}
                isLoading={retryState.isLoading}
              >
                {m.order_failed_rebuild_cart()}
              </Button>
            )}
            {retryState.error && (
              <p className='text-sm text-error' role='alert'>
                {retryState.error}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
