import { Loader2, Truck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { formatPriceEUR } from '#/lib/pricing'
import type { CheckoutSummary, ShippingOption } from '#/lib/checkout.server'
import { m } from '#/paraglide/messages'
import type { CheckoutFormApi, CheckoutFormValues } from './checkout-form'

function formatEstimatedDays(days: ShippingOption['estimatedDays']): string | null {
  if (!days) return null
  if (days.min === days.max) {
    return days.min === 1
      ? m.shipping_estimatedDays_one({ count: days.min })
      : m.shipping_estimatedDays_other({ count: days.min })
  }
  return m.shipping_estimatedDays_range({ min: days.min, max: days.max })
}

interface CheckoutShippingStepProps {
  form: CheckoutFormApi
  currentSummary: CheckoutSummary
  shippingSelections: CheckoutFormValues['shippingSelections']
  isFetchingRates: boolean
  rateError: string | null
  hasServicePointSelection: boolean
  selectedPickupPoint?: {
    id: string
    name: string
    street: string
    postalCode: string
    city: string
    country: string
  }
  onRetryRates: () => void
  onShippingOptionSelected: (nextSelections: CheckoutFormValues['shippingSelections']) => void
  onOpenPickupPointPicker: () => void
}

/**
 * Per-shop shipping method selection and the service point (pick-up) panel.
 *
 * Selecting an option commits the new selection to the form and hands the
 * rebuilt selection list to the page so it can re-sync the authoritative
 * server summary.
 */
export function CheckoutShippingStep({
  form,
  currentSummary,
  shippingSelections,
  isFetchingRates,
  rateError,
  hasServicePointSelection,
  selectedPickupPoint,
  onRetryRates,
  onShippingOptionSelected,
  onOpenPickupPointPicker,
}: CheckoutShippingStepProps) {
  return (
    <>
      {/* Shipping Methods */}
      <section className='island-shell rounded-2xl p-4 sm:p-6'>
        <div className='mb-4 flex items-center gap-2'>
          <Truck size={18} className='text-accent-primary' aria-hidden='true' />
          <h2 className='text-lg font-semibold text-text-primary'>
            {m.checkout_shipping_method()}
          </h2>
          {isFetchingRates && (
            <Loader2 size={14} className='animate-spin text-text-muted' aria-hidden='true' />
          )}
        </div>

        {rateError && (
          <p className='mb-4 text-sm text-error' role='alert'>
            {rateError}
          </p>
        )}

        <div className='space-y-6'>
          {currentSummary.shops.map((shop, shopIndex) => {
            const selectionIndex = shippingSelections.findIndex((s) => s.shopId === shop.shopId)
            // Defensive fallback: selections are always rebuilt from currentSummary.shops,
            // so a matching shopId should exist. Falling back to the array index preserves
            // the old behavior only in an inconsistent edge case.
            const fieldIndex = selectionIndex === -1 ? shopIndex : selectionIndex

            return (
              <fieldset key={shop.shopId} className='border-0 p-0 m-0 min-w-0'>
                <legend className='mb-3 text-sm font-medium text-text-secondary'>
                  {shop.shopName}
                </legend>
                {shop.shippingOptions.length === 0 ||
                shop.shippingOptions.every((option) => option.fallback) ? (
                  <div className='flex items-center justify-between gap-4 rounded-xl bg-surface-inset px-4 py-3'>
                    <p className='text-sm text-text-secondary'>
                      {rateError ? rateError : m.checkout_shipping_address_prompt()}
                    </p>
                    {rateError && (
                      <Button type='button' variant='secondary' size='sm' onClick={onRetryRates}>
                        {m.checkout_rate_retry()}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className='space-y-2'>
                    {shop.shippingOptions
                      .filter((option) => !option.fallback)
                      .map((option) => {
                        const isManualFallback = option.fallback && option.method === 'manual'
                        const estimatedDaysStr = formatEstimatedDays(option.estimatedDays)

                        return (
                          <form.Field
                            key={`${shop.shopId}-${option.rateId ?? option.method}`}
                            name={`shippingSelections[${fieldIndex}]`}
                          >
                            {(field) => {
                              const isSelected =
                                field.state.value?.rateId === option.rateId &&
                                field.state.value?.method === option.method

                              return (
                                <label
                                  className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-colors ${
                                    isSelected
                                      ? 'border-accent-primary bg-accent-primary/5'
                                      : isManualFallback
                                        ? 'border-border-default bg-surface-inset'
                                        : 'border-border-default hover:border-border-strong'
                                  }`}
                                >
                                  <div className='flex items-center justify-between'>
                                    <div className='flex items-center gap-3'>
                                      <input
                                        type='radio'
                                        name={`shipping-shop-${shop.shopId}`}
                                        checked={isSelected}
                                        onChange={() => {
                                          const nextSelection = {
                                            shopId: shop.shopId,
                                            rateId: option.rateId,
                                            method: option.method,
                                            costCents: option.costCents,
                                          }
                                          const nextSelections =
                                            form.state.values.shippingSelections.map((s, idx) =>
                                              idx === fieldIndex ? nextSelection : s,
                                            )
                                          field.handleChange(nextSelection)
                                          onShippingOptionSelected(nextSelections)
                                        }}
                                        className='size-4 accent-accent-primary'
                                      />
                                      <div>
                                        <span className='text-sm font-medium text-text-primary'>
                                          {option.serviceName ?? option.label}
                                        </span>
                                        {option.carrier && (
                                          <span className='ml-2 text-xs text-text-muted capitalize'>
                                            {option.carrier.replace(/_/g, ' ')}
                                          </span>
                                        )}
                                        {estimatedDaysStr && (
                                          <span className='ml-1 block text-xs text-text-secondary'>
                                            {estimatedDaysStr}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className='text-sm font-semibold text-text-primary'>
                                      {option.costCents === 0
                                        ? '—'
                                        : formatPriceEUR(option.costCents)}
                                    </span>
                                  </div>
                                </label>
                              )
                            }}
                          </form.Field>
                        )
                      })}
                  </div>
                )}
              </fieldset>
            )
          })}
        </div>
      </section>

      {hasServicePointSelection && (
        <section className='island-shell rounded-2xl p-4 sm:p-6 border border-accent-secondary/30 bg-surface-default shadow-sm relative overflow-hidden'>
          <div className='absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-accent-primary to-accent-secondary' />
          <div className='mb-4 flex items-center gap-2'>
            <Truck size={18} className='text-accent-primary' aria-hidden='true' />
            <h2 className='text-lg font-semibold text-text-primary'>
              {m.checkout_pickup_point_label()}
            </h2>
          </div>

          {selectedPickupPoint ? (
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-success/30 bg-success/5'>
              <div>
                <h3 className='text-sm font-semibold text-text-primary flex items-center gap-1.5'>
                  <span className='size-2 rounded-full bg-success animate-pulse' />
                  {selectedPickupPoint.name}
                </h3>
                <p className='text-xs text-text-secondary mt-1'>{selectedPickupPoint.street}</p>
                <p className='text-xs text-text-secondary'>
                  {selectedPickupPoint.postalCode} {selectedPickupPoint.city},{' '}
                  {selectedPickupPoint.country}
                </p>
                <span className='inline-block text-[10px] font-mono bg-bg-inset text-text-secondary px-1.5 py-0.5 rounded mt-2'>
                  {m.checkout_pickup_point_id({ id: selectedPickupPoint.id })}
                </span>
              </div>
              <Button type='button' variant='secondary' onClick={onOpenPickupPointPicker}>
                {m.checkout_pickup_point_change()}
              </Button>
            </div>
          ) : (
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-warning/30 bg-warning/5'>
              <div>
                <h3 className='text-sm font-semibold text-warning-strong'>
                  {m.checkout_no_pickup_point()}
                </h3>
                <p className='text-xs text-text-secondary mt-1'>{m.checkout_pickup_point_hint()}</p>
              </div>
              <Button type='button' variant='primary' onClick={onOpenPickupPointPicker}>
                {m.checkout_pickup_point_select()}
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
