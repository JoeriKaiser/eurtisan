import { Button } from '#/components/ui/button'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import type { CheckoutFormApi } from './checkout-form'

interface CheckoutMobilePaymentBarProps {
  form: CheckoutFormApi
  grandTotalCents: number
  isFetchingRates: boolean
  quoteFresh: boolean
  hasUndeclaredShop: boolean
  hasServicePointSelection: boolean
  selectedPickupPoint?: {
    id: string
    name: string
    street: string
    postalCode: string
    city: string
    country: string
  }
}

/**
 * Fixed bottom bar shown on small screens: grand total plus the submit
 * button targeting the checkout form by id.
 */
export function CheckoutMobilePaymentBar({
  form,
  grandTotalCents,
  isFetchingRates,
  quoteFresh,
  hasUndeclaredShop,
  hasServicePointSelection,
  selectedPickupPoint,
}: CheckoutMobilePaymentBarProps) {
  return (
    <div className='fixed inset-x-0 bottom-0 z-sticky border-t border-border-default bg-surface-default/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg lg:hidden'>
      <div className='mx-auto flex max-w-lg items-center gap-4'>
        <div className='min-w-0 flex-1'>
          <p className='text-xs text-text-secondary'>{m.checkout_grand_total()}</p>
          <p className='truncate text-lg font-bold tabular-nums text-text-primary'>
            {formatPriceEUR(grandTotalCents)}
          </p>
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type='submit'
              form='checkout-form'
              size='lg'
              isLoading={isSubmitting}
              disabled={
                isSubmitting ||
                isFetchingRates ||
                !quoteFresh ||
                hasUndeclaredShop ||
                (hasServicePointSelection && !selectedPickupPoint)
              }
            >
              {m.checkout_mobile_payment_action({
                total: formatPriceEUR(grandTotalCents),
              })}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </div>
  )
}
