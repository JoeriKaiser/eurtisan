import { Link } from '@tanstack/react-router'
import { CheckCircle2, ImageOff, Loader2, XCircle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { OrderDetail } from '#/lib/orders.server'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'

export interface OrderSuccessPageProps {
  order: OrderDetail
}

export default function OrderSuccessPage({ order }: OrderSuccessPageProps) {
  const isPending = order.status === 'pending_payment'
  const isCancelled = order.status === 'cancelled'
  const isPaid = order.status === 'paid'

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-2xl'>
        <div className='mb-8 text-center'>
          {isPaid && (
            <>
              <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-subtle text-success'>
                <CheckCircle2 size={32} aria-hidden='true' />
              </div>
              <h1 className='display-title mb-2 text-2xl font-bold text-text-primary sm:text-3xl'>
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
              <h1 className='display-title mb-2 text-2xl font-bold text-text-primary sm:text-3xl'>
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
              <h1 className='display-title mb-2 text-2xl font-bold text-text-primary sm:text-3xl'>
                {m.order_failed_title()}
              </h1>
              <p className='text-text-secondary'>{m.order_failed_description()}</p>
            </>
          )}

          {!isPaid && !isPending && !isCancelled && (
            <>
              <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-subtle text-success'>
                <CheckCircle2 size={32} aria-hidden='true' />
              </div>
              <h1 className='display-title mb-2 text-2xl font-bold text-text-primary sm:text-3xl'>
                {m.order_success_title()}
              </h1>
              <p className='text-text-secondary'>{m.order_success_description()}</p>
            </>
          )}
        </div>

        <div className='island-shell rounded-2xl p-6'>
          <div className='mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-4'>
            <div>
              <p className='text-sm text-text-secondary'>{m.order_success_order_id()}</p>
              <p className='font-mono text-sm font-medium text-text-primary'>{order.id}</p>
            </div>
            <div className='text-right'>
              <p className='text-sm text-text-secondary'>{m.order_success_total()}</p>
              <p className='text-lg font-bold text-text-primary'>
                {formatPriceEUR(order.totalCents)}
              </p>
            </div>
          </div>

          <h2 className='mb-4 text-lg font-semibold text-text-primary'>
            {m.order_success_items()}
          </h2>

          <div className='space-y-6'>
            {order.shops.map((shop) => (
              <section key={shop.shopId} className='space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='text-sm font-semibold text-text-primary'>{shop.shopName}</h3>
                  <span className='text-xs text-text-secondary capitalize'>
                    {shop.shippingMethod} — {formatPriceEUR(shop.shippingCostCents)}
                  </span>
                </div>
                <ul className='divide-y divide-border-subtle'>
                  {shop.items.map((item) => (
                    <li key={item.id} className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'>
                      <div className='flex size-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
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

          <div className='mt-6 border-t border-border-default pt-6 text-center'>
            <Link to='/category/all' className='no-underline'>
              <Button size='lg'>{m.order_success_continue_shopping()}</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
