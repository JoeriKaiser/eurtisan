import { formOptions, useForm } from '@tanstack/react-form'
import { Loader2, MapPin, Package, Truck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import z from 'zod'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { createCheckout, getCheckoutSummary } from '#/lib/checkout'
import type { CheckoutShopGroup, CheckoutSummary, ShippingOption } from '#/lib/checkout.server'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'

function getFieldError(error: unknown): string | undefined {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return undefined
}

export interface CheckoutPageProps {
  summary: CheckoutSummary
  cartId: string
}

const pickupPointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  street: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
})

const shippingAddressSchema = z.object({
  name: z.string().min(1, m.checkout_error_name_required()).max(255),
  street: z.string().min(1, m.checkout_error_street_required()).max(255),
  city: z.string().min(1, m.checkout_error_city_required()).max(255),
  postalCode: z.string().min(1, m.checkout_error_postal_required()).max(50),
  country: z.string().min(1, m.checkout_error_country_required()).max(100),
  pickupPoint: pickupPointSchema.optional(),
})

const checkoutFormSchema = z
  .object({
    shippingAddress: shippingAddressSchema,
    sameAsShipping: z.boolean(),
    billingAddress: z.object({
      name: z.string().max(255),
      street: z.string().max(255),
      city: z.string().max(255),
      postalCode: z.string().max(50),
      country: z.string().max(100),
    }),
    shippingSelections: z.array(
      z.object({
        shopId: z.string().min(1),
        rateId: z.string().optional(),
        method: z.enum(['standard', 'express', 'manual']),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (!data.sameAsShipping) {
      const result = shippingAddressSchema.safeParse(data.billingAddress)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['billingAddress', ...issue.path],
          })
        }
      }
    }
  })

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>

/**
 * Build a default shipping selection for a shop based on available options.
 * Picks the first non-fallback option, or the first option if all are fallbacks.
 */
function getDefaultShippingSelection(
  shop: CheckoutShopGroup,
): CheckoutFormValues['shippingSelections'][number] {
  const firstReal = shop.shippingOptions.find((o) => !o.fallback)
  const option = firstReal ?? shop.shippingOptions[0]
  return {
    shopId: shop.shopId,
    method: option?.method ?? 'standard',
    rateId: option?.rateId,
  }
}

/**
 * Format estimated delivery days as a human-readable string.
 */
function formatEstimatedDays(days: ShippingOption['estimatedDays']): string | null {
  if (!days) return null
  if (days.min === days.max) return `${days.min} business day${days.min > 1 ? 's' : ''}`
  return `${days.min}–${days.max} business days`
}

export default function CheckoutPage({ summary: initialSummary, cartId }: CheckoutPageProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [currentSummary, setCurrentSummary] = useState<CheckoutSummary>(initialSummary)
  const [isFetchingRates, setIsFetchingRates] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchedAddressRef = useRef<string>('')

  const defaultShippingSelections = currentSummary.shops.map(getDefaultShippingSelection)

  const form = useForm(
    formOptions({
      defaultValues: {
        shippingAddress: {
          name: '',
          street: '',
          city: '',
          postalCode: '',
          country: '',
          pickupPoint: undefined,
        },
        billingAddress: {
          name: '',
          street: '',
          city: '',
          postalCode: '',
          country: '',
        },
        sameAsShipping: true as boolean,
        shippingSelections: defaultShippingSelections,
      } as CheckoutFormValues,
      validators: {
        onChange: checkoutFormSchema,
        onSubmit: checkoutFormSchema,
      },
      onSubmit: async ({ value }) => {
        setSubmitError(null)
        try {
          const billingAddress = value.sameAsShipping ? value.shippingAddress : value.billingAddress
          const result = await createCheckout({
            data: {
              cartId,
              shippingAddress: value.shippingAddress,
              billingAddress,
              shippingSelections: value.shippingSelections,
            },
          })
          window.location.href = result.checkoutUrl
        } catch (err) {
          if (err instanceof Response) {
            const body = await err.json().catch(() => ({}))
            setSubmitError(body.message || m.checkout_error_submit())
          } else {
            setSubmitError(m.checkout_error_submit())
          }
        }
      },
    }),
  )

  // Mondial Relay Pick-up Point state and selection tracking
  const [pickupPointModalOpen, setPickupPointModalOpen] = useState(false)

  const shippingSelections = form.state.values.shippingSelections
  const hasMondialRelaySelection = shippingSelections.some((sel, idx) => {
    const shopGroup = currentSummary.shops[idx]
    if (!shopGroup) return false
    const selectedOption = shopGroup.shippingOptions.find(
      (opt) => opt.rateId === sel.rateId && opt.method === sel.method,
    )
    return selectedOption?.carrier === 'mondial_relay'
  })

  const selectedPickupPoint = form.state.values.shippingAddress.pickupPoint
  useEffect(() => {
    if (!hasMondialRelaySelection && selectedPickupPoint) {
      form.setFieldValue('shippingAddress.pickupPoint', undefined)
    }
  }, [hasMondialRelaySelection, selectedPickupPoint, form])

  // -----------------------------------------------------------------------
  // Fetch shipping rates when relevant address fields change and are valid
  // -----------------------------------------------------------------------

  const fetchRates = useCallback(
    async (address: CheckoutFormValues['shippingAddress']) => {
      const addressKey = `${address.country}:${address.postalCode}:${address.city}`
      if (addressKey === lastFetchedAddressRef.current) return
      lastFetchedAddressRef.current = addressKey

      setIsFetchingRates(true)
      setRateError(null)

      try {
        const updatedSummary = await getCheckoutSummary({
          data: {
            cartId,
            shippingAddress: address,
          },
        })
        setCurrentSummary(updatedSummary)

        // Update shipping selections to match the new options
        for (let i = 0; i < updatedSummary.shops.length; i++) {
          const shop = updatedSummary.shops[i]
          const defaultSel = getDefaultShippingSelection(shop)
          form.setFieldValue(`shippingSelections[${i}].shopId`, defaultSel.shopId)
          form.setFieldValue(`shippingSelections[${i}].method`, defaultSel.method)
          form.setFieldValue(`shippingSelections[${i}].rateId`, defaultSel.rateId)
        }

        // Check if any shop has only unsupported fallbacks
        for (const shop of updatedSummary.shops) {
          if (
            shop.shippingOptions.length === 1 &&
            shop.shippingOptions[0].fallback &&
            shop.shippingOptions[0].label.includes('cannot ship')
          ) {
            setRateError(`We cannot ship to this address for "${shop.shopName}".`)
            break
          }
        }
      } catch {
        setRateError('Could not fetch shipping rates. Please try again.')
      } finally {
        setIsFetchingRates(false)
      }
    },
    [cartId, form],
  )

  // Listen for address field changes and debounce rate fetching
  const subscribeToAddressChanges = useCallback(() => {
    const subscription = form.store.subscribe(() => {
      const state = form.store.state
      const addr = state.values.shippingAddress

      // Only fetch rates once the address has country + postalCode + city (minimum)
      if (!addr.country || !addr.postalCode || !addr.city) return

      // Validate the partial address before fetching
      const result = shippingAddressSchema.safeParse(addr)
      if (!result.success) return

      // Debounce: wait 600ms after the last keystroke
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      fetchTimerRef.current = setTimeout(() => {
        fetchRates(addr)
      }, 600)
    })

    return () => {
      if (
        subscription &&
        typeof subscription === 'object' &&
        'unsubscribe' in subscription &&
        typeof subscription.unsubscribe === 'function'
      ) {
        subscription.unsubscribe()
      }
    }
  }, [form.store, fetchRates])

  const unsubRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    unsubRef.current = subscribeToAddressChanges()
    return () => {
      unsubRef.current?.()
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
  }, [subscribeToAddressChanges])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mb-8'>
        <h1 className='display-title text-3xl font-semibold text-text-primary sm:text-4xl'>
          {m.checkout_title()}
        </h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
        className='grid gap-8 lg:grid-cols-[1fr_360px]'
        noValidate
      >
        {/* Left column: forms */}
        <div className='space-y-6'>
          {/* Shipping Address */}
          <section className='island-shell rounded-2xl p-4 sm:p-6'>
            <div className='mb-4 flex items-center gap-2'>
              <MapPin size={18} className='text-accent-primary' aria-hidden='true' />
              <h2 className='text-lg font-semibold text-text-primary'>
                {m.checkout_shipping_address()}
              </h2>
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <form.Field name='shippingAddress.name'>
                {(field) => (
                  <div className='grid gap-2 sm:col-span-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_full_name()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors[0])}
                      autoComplete='name'
                    />
                    {field.state.meta.errors[0] && (
                      <p id={`${field.name}-error`} className='text-xs text-error'>
                        {getFieldError(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name='shippingAddress.street'>
                {(field) => (
                  <div className='grid gap-2 sm:col-span-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_street()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors[0])}
                      autoComplete='street-address'
                    />
                    {field.state.meta.errors[0] && (
                      <p id={`${field.name}-error`} className='text-xs text-error'>
                        {getFieldError(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name='shippingAddress.city'>
                {(field) => (
                  <div className='grid gap-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_city()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors[0])}
                      autoComplete='address-level2'
                    />
                    {field.state.meta.errors[0] && (
                      <p id={`${field.name}-error`} className='text-xs text-error'>
                        {getFieldError(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name='shippingAddress.postalCode'>
                {(field) => (
                  <div className='grid gap-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_postal_code()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors[0])}
                      autoComplete='postal-code'
                    />
                    {field.state.meta.errors[0] && (
                      <p id={`${field.name}-error`} className='text-xs text-error'>
                        {getFieldError(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name='shippingAddress.country'>
                {(field) => (
                  <div className='grid gap-2 sm:col-span-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_country()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors[0])}
                      autoComplete='country-name'
                    />
                    {field.state.meta.errors[0] && (
                      <p id={`${field.name}-error`} className='text-xs text-error'>
                        {getFieldError(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>
          </section>

          {/* Billing Address */}
          <section className='island-shell rounded-2xl p-4 sm:p-6'>
            <div className='mb-4 flex items-center gap-2'>
              <MapPin size={18} className='text-accent-primary' aria-hidden='true' />
              <h2 className='text-lg font-semibold text-text-primary'>
                {m.checkout_billing_address()}
              </h2>
            </div>

            <form.Field name='sameAsShipping'>
              {(field) => (
                <label className='mb-4 flex cursor-pointer items-center gap-2'>
                  <input
                    type='checkbox'
                    name={field.name}
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    className='size-4 accent-accent-primary'
                  />
                  <span className='text-sm text-text-primary'>
                    {m.checkout_billing_same_as_shipping()}
                  </span>
                </label>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => !state.values.sameAsShipping}>
              {(showBilling) =>
                showBilling ? (
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <form.Field name='billingAddress.name'>
                      {(field) => (
                        <div className='grid gap-2 sm:col-span-2'>
                          <label
                            htmlFor={field.name}
                            className='text-sm font-medium text-text-primary'
                          >
                            {m.checkout_field_full_name()}
                          </label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            error={getFieldError(field.state.meta.errors[0])}
                            autoComplete='name'
                          />
                          {field.state.meta.errors[0] && (
                            <p id={`${field.name}-error`} className='text-xs text-error'>
                              {getFieldError(field.state.meta.errors[0])}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>

                    <form.Field name='billingAddress.street'>
                      {(field) => (
                        <div className='grid gap-2 sm:col-span-2'>
                          <label
                            htmlFor={field.name}
                            className='text-sm font-medium text-text-primary'
                          >
                            {m.checkout_field_street()}
                          </label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            error={getFieldError(field.state.meta.errors[0])}
                            autoComplete='street-address'
                          />
                          {field.state.meta.errors[0] && (
                            <p id={`${field.name}-error`} className='text-xs text-error'>
                              {getFieldError(field.state.meta.errors[0])}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>

                    <form.Field name='billingAddress.city'>
                      {(field) => (
                        <div className='grid gap-2'>
                          <label
                            htmlFor={field.name}
                            className='text-sm font-medium text-text-primary'
                          >
                            {m.checkout_field_city()}
                          </label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            error={getFieldError(field.state.meta.errors[0])}
                            autoComplete='address-level2'
                          />
                          {field.state.meta.errors[0] && (
                            <p id={`${field.name}-error`} className='text-xs text-error'>
                              {getFieldError(field.state.meta.errors[0])}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>

                    <form.Field name='billingAddress.postalCode'>
                      {(field) => (
                        <div className='grid gap-2'>
                          <label
                            htmlFor={field.name}
                            className='text-sm font-medium text-text-primary'
                          >
                            {m.checkout_field_postal_code()}
                          </label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            error={getFieldError(field.state.meta.errors[0])}
                            autoComplete='postal-code'
                          />
                          {field.state.meta.errors[0] && (
                            <p id={`${field.name}-error`} className='text-xs text-error'>
                              {getFieldError(field.state.meta.errors[0])}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>

                    <form.Field name='billingAddress.country'>
                      {(field) => (
                        <div className='grid gap-2 sm:col-span-2'>
                          <label
                            htmlFor={field.name}
                            className='text-sm font-medium text-text-primary'
                          >
                            {m.checkout_field_country()}
                          </label>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            error={getFieldError(field.state.meta.errors[0])}
                            autoComplete='country-name'
                          />
                          {field.state.meta.errors[0] && (
                            <p id={`${field.name}-error`} className='text-xs text-error'>
                              {getFieldError(field.state.meta.errors[0])}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>
                  </div>
                ) : null
              }
            </form.Subscribe>
          </section>

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
              {currentSummary.shops.map((shop, shopIndex) => (
                <div key={shop.shopId}>
                  <h3 className='mb-3 text-sm font-medium text-text-secondary'>{shop.shopName}</h3>
                  {shop.shippingOptions.length === 0 ? (
                    <p className='text-sm text-text-muted italic'>
                      Enter your shipping address to see available rates.
                    </p>
                  ) : (
                    <div className='space-y-2'>
                      {shop.shippingOptions.map((option) => {
                        const isManualFallback = option.fallback && option.method === 'manual'
                        const estimatedDaysStr = formatEstimatedDays(option.estimatedDays)

                        return (
                          <form.Field
                            key={`${shop.shopId}-${option.rateId ?? option.method}`}
                            name={`shippingSelections[${shopIndex}]`}
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
                                          field.handleChange({
                                            shopId: shop.shopId,
                                            rateId: option.rateId,
                                            method: option.method,
                                          })
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
                </div>
              ))}
            </div>
          </section>

          {/* Mondial Relay Pick-up Point Section */}
          {hasMondialRelaySelection && (
            <section className='island-shell rounded-2xl p-4 sm:p-6 border border-accent-secondary/30 bg-surface-default shadow-sm relative overflow-hidden'>
              <div className='absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-accent-primary to-accent-secondary' />
              <div className='mb-4 flex items-center gap-2'>
                <Truck size={18} className='text-accent-primary' aria-hidden='true' />
                <h2 className='text-lg font-semibold text-text-primary'>
                  Mondial Relay Pick-up Point
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
                      ID: {selectedPickupPoint.id}
                    </span>
                  </div>
                  <Button
                    type='button'
                    variant='secondary'
                    onClick={() => setPickupPointModalOpen(true)}
                  >
                    Change Pick-up Point
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-warning/30 bg-warning/5'>
                  <div>
                    <h3 className='text-sm font-semibold text-warning-strong'>
                      No Pick-up Point Selected
                    </h3>
                    <p className='text-xs text-text-secondary mt-1'>
                      Please choose a pick-up point location to complete your order.
                    </p>
                  </div>
                  <Button
                    type='button'
                    variant='primary'
                    onClick={() => setPickupPointModalOpen(true)}
                  >
                    Select Pick-up Point
                  </Button>
                </div>
              )}
            </section>
          )}

          {/* Order items */}
          <section className='island-shell rounded-2xl p-4 sm:p-6'>
            <div className='mb-4 flex items-center gap-2'>
              <Package size={18} className='text-accent-primary' aria-hidden='true' />
              <h2 className='text-lg font-semibold text-text-primary'>
                {m.checkout_order_items()}
              </h2>
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
        </div>

        {/* Right column: order summary */}
        <div className='lg:sticky lg:top-24 lg:self-start'>
          <section className='island-shell rounded-2xl p-6'>
            <h2 className='mb-4 text-lg font-semibold text-text-primary'>
              {m.checkout_order_summary()}
            </h2>

            <div className='space-y-2'>
              {currentSummary.shops.map((shop) => {
                const selection = form
                  .getFieldValue('shippingSelections')
                  .find((s) => s.shopId === shop.shopId)
                const shippingOption =
                  shop.shippingOptions.find((o) => o.rateId === selection?.rateId) ??
                  shop.shippingOptions.find((o) => o.method === selection?.method) ??
                  shop.shippingOptions[0]

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
                        {shippingOption?.serviceName ?? shippingOption?.label ?? 'Shipping'}
                      </span>
                      <span className='font-medium text-text-primary'>
                        {shippingOption?.costCents === 0
                          ? '—'
                          : formatPriceEUR(shippingOption?.costCents ?? 0)}
                      </span>
                    </div>
                    {shop.vatEstimateCents > 0 && (
                      <div className='flex justify-between text-sm'>
                        <span className='text-text-secondary truncate'>Includes VAT</span>
                        <span className='font-medium text-text-primary'>
                          {formatPriceEUR(shop.vatEstimateCents)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className='my-4 border-t border-border-default' />

            {currentSummary.shops.some((s) => s.vatEstimateCents > 0) && (
              <div className='flex justify-between text-sm mb-2'>
                <span className='text-text-secondary'>Total VAT included</span>
                <span className='font-medium text-text-primary'>
                  {formatPriceEUR(
                    currentSummary.shops.reduce((sum, s) => sum + s.vatEstimateCents, 0),
                  )}
                </span>
              </div>
            )}

            <div className='flex items-center justify-between'>
              <span className='text-base font-semibold text-text-primary'>
                {m.checkout_grand_total()}
              </span>
              <form.Subscribe selector={(state) => state.values.shippingSelections}>
                {(shippingSelections) => {
                  const total = currentSummary.shops.reduce((acc, shop) => {
                    const selection = shippingSelections.find((s) => s.shopId === shop.shopId)
                    const shippingOption =
                      shop.shippingOptions.find((o) => o.rateId === selection?.rateId) ??
                      shop.shippingOptions.find((o) => o.method === selection?.method) ??
                      shop.shippingOptions[0]
                    return acc + shop.subtotalCents + (shippingOption?.costCents ?? 0)
                  }, 0)
                  return (
                    <span className='text-xl font-bold text-text-primary'>
                      {formatPriceEUR(total)}
                    </span>
                  )
                }}
              </form.Subscribe>
            </div>

            {submitError && (
              <p className='mt-3 text-sm text-error' role='alert'>
                {submitError}
              </p>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => {
                const disableSubmit =
                  isSubmitting || (hasMondialRelaySelection && !selectedPickupPoint)
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
                    {hasMondialRelaySelection && !selectedPickupPoint && (
                      <p className='mt-2.5 text-xs text-error text-center' role='alert'>
                        Please select a pick-up point before placing your order.
                      </p>
                    )}
                  </>
                )
              }}
            </form.Subscribe>
          </section>
        </div>
      </form>

      <PickupPointSelectorModal
        open={pickupPointModalOpen}
        onOpenChange={setPickupPointModalOpen}
        postalCode={form.state.values.shippingAddress.postalCode || ''}
        country={form.state.values.shippingAddress.country || 'FR'}
        onSelect={(point) => {
          form.setFieldValue('shippingAddress.pickupPoint', point)
        }}
      />
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                        Mondial Relay Selector Modal                        */
/* -------------------------------------------------------------------------- */

interface MockPickupPoint {
  id: string
  name: string
  street: string
  postalCode: string
  city: string
  country: string
  distance: string
}

function getMockPickupPoints(postalCode: string, country: string): MockPickupPoint[] {
  const cleanPc = (postalCode || '75001').trim()
  const cleanCountry = (country || 'FR').toUpperCase()

  if (cleanCountry === 'DE') {
    return [
      {
        id: `DE-${cleanPc}-01`,
        name: 'Mondial Relay Schließfach - Edeka',
        street: 'Friedrichstraße 50',
        postalCode: cleanPc,
        city: 'Berlin',
        country: 'DE',
        distance: '0.2 km',
      },
      {
        id: `DE-${cleanPc}-02`,
        name: 'Späti 24 Kiosk',
        street: 'Kottbusser Damm 12',
        postalCode: cleanPc,
        city: 'Berlin',
        country: 'DE',
        distance: '0.6 km',
      },
      {
        id: `DE-${cleanPc}-03`,
        name: 'Blumenhaus Edelweiß',
        street: 'Karl-Marx-Allee 85',
        postalCode: cleanPc,
        city: 'Berlin',
        country: 'DE',
        distance: '1.1 km',
      },
    ]
  }

  return [
    {
      id: `${cleanCountry}-${cleanPc}-01`,
      name: 'Locker Mondial Relay - Auchan',
      street: '25 Rue de Rivoli',
      postalCode: cleanPc,
      city: 'Paris',
      country: cleanCountry,
      distance: '0.4 km',
    },
    {
      id: `${cleanCountry}-${cleanPc}-02`,
      name: 'Épicerie du Coin (Relais Colis)',
      street: '14 Rue Saint-Denis',
      postalCode: cleanPc,
      city: 'Paris',
      country: cleanCountry,
      distance: '0.8 km',
    },
    {
      id: `${cleanCountry}-${cleanPc}-03`,
      name: 'Pressing de la Mairie',
      street: '88 Boulevard Voltaire',
      postalCode: cleanPc,
      city: 'Paris',
      country: cleanCountry,
      distance: '1.5 km',
    },
  ]
}

export function PickupPointSelectorModal({
  open,
  onOpenChange,
  postalCode: initialPostalCode,
  country: initialCountry,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  postalCode: string
  country: string
  onSelect: (point: MockPickupPoint) => void
}) {
  const [searchPostalCode, setSearchPostalCode] = useState(initialPostalCode)
  const [searchCountry, setSearchCountry] = useState(initialCountry)
  const [points, setPoints] = useState<MockPickupPoint[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    if (open) {
      setSearchPostalCode(initialPostalCode)
      setSearchCountry(initialCountry)
      setPoints([])
      setHasSearched(false)
    }
  }, [open, initialPostalCode, initialCountry])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const results = getMockPickupPoints(searchPostalCode, searchCountry)
    setPoints(results)
    setHasSearched(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='w-full max-w-lg'>
            <DialogTitle className='text-lg font-semibold text-text-primary mb-2'>
              Select Mondial Relay Pick-up Point
            </DialogTitle>
            <DialogDescription className='text-sm text-text-secondary mb-4'>
              Search and select a convenient parcel locker or shop for delivery.
            </DialogDescription>

            <form onSubmit={handleSearch} className='flex gap-3 mb-6'>
              <div className='flex-1'>
                <Input
                  value={searchPostalCode}
                  onChange={(e) => setSearchPostalCode(e.target.value)}
                  placeholder='Postal code'
                  className='h-10'
                  required
                />
              </div>
              <div className='w-32'>
                <Input
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value.toUpperCase())}
                  placeholder='Country'
                  className='h-10'
                  maxLength={2}
                  required
                />
              </div>
              <Button type='submit'>Search</Button>
            </form>

            <div className='space-y-3 max-h-72 overflow-y-auto pr-1'>
              {points.map((point) => (
                <div
                  key={point.id}
                  className='flex items-start justify-between gap-4 p-3.5 rounded-xl border border-border-default hover:border-border-strong bg-surface-default transition-colors'
                >
                  <div className='flex-1'>
                    <h4 className='text-sm font-semibold text-text-primary'>{point.name}</h4>
                    <p className='text-xs text-text-secondary mt-1'>{point.street}</p>
                    <p className='text-xs text-text-secondary'>
                      {point.postalCode} {point.city}, {point.country}
                    </p>
                    <span className='inline-block text-[11px] font-medium bg-bg-inset text-text-secondary px-1.5 py-0.5 rounded mt-2'>
                      {point.distance} away
                    </span>
                  </div>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => {
                      onSelect(point)
                      onOpenChange(false)
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}

              {hasSearched && points.length === 0 && (
                <p className='text-sm text-text-muted italic text-center py-6'>
                  No pick-up points found for this area.
                </p>
              )}

              {!hasSearched && (
                <p className='text-sm text-text-muted italic text-center py-6'>
                  Enter a postal code and click search.
                </p>
              )}
            </div>

            <div className='mt-6 flex justify-end'>
              <Button variant='ghost' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      )}
    </Dialog>
  )
}
