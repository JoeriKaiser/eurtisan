import { Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { CheckoutShopGroup, CheckoutSummary, ShippingOption } from '#/lib/checkout.server'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { CheckoutLegalDisclosures } from './CheckoutLegalDisclosures'
import type { CheckoutFormApi, CheckoutFormValues } from './checkout-form'

function getSelectedShippingOption(
  shop: CheckoutShopGroup,
  selection?: CheckoutFormValues['shippingSelections'][number],
): ShippingOption | undefined {
  return (
    shop.shippingOptions.find((o) => o.rateId === selection?.rateId) ??
    shop.shippingOptions.find((o) => o.method === selection?.method) ??
    shop.shippingOptions[0]
  )
}

interface CheckoutOrderSummaryProps {
  form: CheckoutFormApi
  currentSummary: CheckoutSummary
  submitError: string | null
  isFetchingRates: boolean
  quoteFresh: boolean
  rateError: string | null
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
 * Sticky order summary: per-shop totals, VAT, grand total, legal disclosures,
 * and the submit control with its gating hints.
 */
export function CheckoutOrderSummary({
  form,
  currentSummary,
  submitError,
  isFetchingRates,
  quoteFresh,
  rateError,
  hasUndeclaredShop,
  hasServicePointSelection,
  selectedPickupPoint,
}: CheckoutOrderSummaryProps) {
  return (
    <div className='lg:sticky lg:top-24 lg:self-start'>
      <section className='island-shell rounded-2xl p-6'>
        <h2 className='mb-4 text-lg font-semibold text-text-primary'>
          {m.checkout_order_summary()}
        </h2>

        <form.Subscribe selector={(state) => state.values.shippingSelections}>
          {(shippingSelections) => (
            <div className='space-y-2'>
              {currentSummary.shops.map((shop) => {
                const selection = shippingSelections.find((s) => s.shopId === shop.shopId)
                const shippingOption = getSelectedShippingOption(shop, selection)

                return (
                  <div key={shop.shopId} className='space-y-1'>
                    <div className='flex justify-between text-sm'>
                      <span className='text-text-secondary truncate'>{shop.shopName}</span>
                      <span className='font-medium text-text-primary'>
                        {formatPriceEUR(shop.subtotalCents)}
                      </span>
                    </div>
                    <div className='flex justify-between text-sm'>
                      <span className='text-text-secondary truncate'>
                        {shippingOption?.serviceName ??
                          shippingOption?.label ??
                          m.checkout_shipping_label()}
                      </span>
                      <span className='font-medium text-text-primary'>
                        {shippingOption?.costCents === 0
                          ? '—'
                          : formatPriceEUR(shippingOption?.costCents ?? 0)}
                      </span>
                    </div>
                    {shop.vatEstimateCents > 0 && (
                      <div className='flex justify-between text-sm'>
                        <span className='text-text-secondary truncate'>
                          {m.checkout_includes_vat()}
                        </span>
                        <span className='font-medium text-text-primary'>
                          {formatPriceEUR(shop.vatEstimateCents)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </form.Subscribe>

        <div className='my-4 border-t border-border-default' />

        {currentSummary.shops.some((s) => s.vatEstimateCents > 0) && (
          <div className='flex justify-between text-sm mb-2'>
            <span className='text-text-secondary'>{m.checkout_total_vat()}</span>
            <span className='font-medium text-text-primary'>
              {formatPriceEUR(currentSummary.shops.reduce((sum, s) => sum + s.vatEstimateCents, 0))}
            </span>
          </div>
        )}

        <div className='flex items-center justify-between'>
          <span className='text-base font-semibold text-text-primary'>
            {m.checkout_grand_total()}
          </span>
          {/* Use the server-computed grand total so the displayed amount always matches the
              authoritative checkout summary and the charge that will be created. */}
          <span className='text-xl font-bold text-text-primary'>
            {formatPriceEUR(currentSummary.grandTotalCents)}
          </span>
        </div>

        <CheckoutLegalDisclosures shops={currentSummary.shops} />

        {submitError && (
          <p className='mt-3 text-sm text-error' role='alert'>
            {submitError}
          </p>
        )}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => {
            const disableSubmit =
              isSubmitting ||
              isFetchingRates ||
              !quoteFresh ||
              hasUndeclaredShop ||
              (hasServicePointSelection && !selectedPickupPoint)
            return (
              <>
                <Button
                  type='submit'
                  size='lg'
                  className='mt-6 w-full'
                  isLoading={isSubmitting}
                  disabled={disableSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className='animate-spin' aria-hidden='true' />
                      {m.checkout_confirm_loading()}
                    </>
                  ) : (
                    m.checkout_confirm_button()
                  )}
                </Button>
                <p className='mt-3 flex items-center justify-center gap-1.5 text-xs text-text-muted'>
                  <LockKeyhole size={14} aria-hidden='true' />
                  {m.checkout_mollie_handoff()}
                </p>
                {hasServicePointSelection && !selectedPickupPoint && (
                  <p className='mt-2.5 text-xs text-error text-center' role='alert'>
                    {m.checkout_pickup_point_required()}
                  </p>
                )}
                {!quoteFresh && !isFetchingRates && !rateError && (
                  <p className='mt-2.5 text-center text-xs text-text-secondary'>
                    {m.checkout_shipping_address_prompt()}
                  </p>
                )}
              </>
            )
          }}
        </form.Subscribe>
      </section>
    </div>
  )
}
