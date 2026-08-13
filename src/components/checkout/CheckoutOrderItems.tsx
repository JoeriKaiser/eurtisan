import { Package } from 'lucide-react'
import { UnitPriceNote } from '#/components/product/UnitPriceNote'
import type { CheckoutSummary } from '#/lib/checkout.server'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'

interface CheckoutOrderItemsProps {
  currentSummary: CheckoutSummary
}

export function CheckoutOrderItems({ currentSummary }: CheckoutOrderItemsProps) {
  return (
    <section className='island-shell rounded-2xl p-4 sm:p-6'>
      <div className='mb-4 flex items-center gap-2'>
        <Package size={18} className='text-accent-primary' aria-hidden='true' />
        <h2 className='text-lg font-semibold text-text-primary'>{m.checkout_order_items()}</h2>
      </div>

      <div className='space-y-6'>
        {currentSummary.shops.map((shop) => (
          <div key={shop.shopId}>
            <h3 className='mb-2 text-sm font-medium text-text-secondary'>{shop.shopName}</h3>
            <ul className='divide-y divide-border-subtle'>
              {shop.items.map((item) => (
                <li
                  key={item.productId}
                  className='flex items-center gap-4 py-3 first:pt-0 last:pb-0'
                >
                  <div className='flex size-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className='h-full w-full object-cover'
                        loading='lazy'
                      />
                    ) : (
                      <span className='text-xs text-text-muted'>{m.product_no_image()}</span>
                    )}
                  </div>
                  <div className='flex flex-1 flex-col'>
                    <span className='text-sm font-medium text-text-primary'>{item.name}</span>
                    <span className='text-xs text-text-secondary'>
                      {m.checkout_quantity_label({ count: String(item.quantity) })}
                    </span>
                    <UnitPriceNote
                      priceCents={item.priceCents}
                      soldBy={item.soldBy}
                      weightGrams={item.weightGrams}
                      volumeMl={item.volumeMl}
                    />
                  </div>
                  <span className='text-sm font-medium text-text-primary'>
                    {formatPriceEUR(item.priceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className='mt-2 flex justify-between text-sm'>
              <span className='text-text-secondary'>{m.cart_shop_subtotal()}</span>
              <span className='font-medium text-text-primary'>
                {formatPriceEUR(shop.subtotalCents)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
