import { formOptions, useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, LockKeyhole, MapPin, Truck } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import z from 'zod'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { createCheckout, getCheckoutSummary } from '#/lib/checkout'
import { checkoutAddressSchema } from '#/lib/checkout/schemas'
import type { CheckoutShopGroup, CheckoutSummary, ShippingOption } from '#/lib/checkout.server'
import { cn } from '#/lib/cn'
import { getLocalizedErrorMessage } from '#/lib/error-mapping'
import { SUPPORTED_COUNTRY_CODES } from '#/lib/orders-ui'
import { isPostalCodeValid } from '#/lib/shared/address-validation'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { CheckoutLegalDisclosures } from './checkout/CheckoutLegalDisclosures'
import { CheckoutOrderItems } from './checkout/CheckoutOrderItems'
import { PickupPointSelectorModal } from './checkout/PickupPointSelectorModal'

function getFieldError(error: unknown): string | undefined {
  const code =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : undefined
  switch (code) {
    case 'NAME_REQUIRED':
      return m.checkout_error_name_required()
    case 'STREET_REQUIRED':
      return m.checkout_error_street_required()
    case 'CITY_REQUIRED':
      return m.checkout_error_city_required()
    case 'POSTAL_INVALID':
      return m.checkout_error_postal_invalid()
    case 'EMAIL_INVALID':
      return m.checkout_error_email_invalid()
    case 'VAT_PREFIX_INVALID':
      return m.checkout_vat_id_invalid_prefix()
    case 'VAT_FORMAT_INVALID':
      return m.checkout_vat_id_invalid_format()
    default:
      return code
  }
}

export interface CheckoutPageProps {
  summary: CheckoutSummary
  cartId: string
  initialContactEmail?: string
}

const addressSchema = checkoutAddressSchema
const billingDraftAddressSchema = z.object({
  name: z.string(),
  street: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
  contactEmail: z.string(),
  phone: z.string(),
  vatId: z.string().optional().nullable(),
  pickupPoint: z
    .object({
      id: z.string(),
      name: z.string(),
      street: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: z.string(),
    })
    .optional(),
})

const checkoutFormSchema = z
  .object({
    shippingAddress: addressSchema,
    sameAsShipping: z.boolean(),
    billingAddress: billingDraftAddressSchema,
    shippingSelections: z.array(
      z.object({
        shopId: z.string().min(1),
        rateId: z.string().optional(),
        method: z.enum(['standard', 'express', 'manual']),
        costCents: z.number(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (!data.sameAsShipping) {
      const result = addressSchema.safeParse(data.billingAddress)
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
    costCents: option?.costCents ?? 0,
  }
}

function findSelectionForShop(
  selections: CheckoutFormValues['shippingSelections'],
  shopId: string,
) {
  return selections.find((s) => s.shopId === shopId)
}

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

/**
 * Scroll the first invalid field into view and focus it after a failed submit.
 * This keeps field-level errors visually tied to their inputs and prevents the
 * page from appearing cropped at the top when the first error is above the fold.
 */
function scrollToFirstInvalidField() {
  const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!firstInvalid) return
  if (typeof firstInvalid.scrollIntoView === 'function') {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  if (typeof firstInvalid.focus === 'function') {
    try {
      firstInvalid.focus({ preventScroll: true })
    } catch {
      firstInvalid.focus()
    }
  }
}

/**
 * Format estimated delivery days as a localized human-readable string.
 */
function getCountryName(code: string): string {
  return new Intl.DisplayNames([getLocale()], { type: 'region' }).of(code) ?? code
}

function formatEstimatedDays(days: ShippingOption['estimatedDays']): string | null {
  if (!days) return null
  if (days.min === days.max) {
    return days.min === 1
      ? m.shipping_estimatedDays_one({ count: days.min })
      : m.shipping_estimatedDays_other({ count: days.min })
  }
  return m.shipping_estimatedDays_range({ min: days.min, max: days.max })
}

export default function CheckoutPage({
  summary: initialSummary,
  cartId,
  initialContactEmail = '',
}: CheckoutPageProps) {
  const checkoutAttemptIdRef = useRef(crypto.randomUUID())
  const [currentSummary, setCurrentSummary] = useState<CheckoutSummary>(initialSummary)
  const [status, setStatus] = useState({
    submitError: null as string | null,
    isFetchingRates: false,
    rateError: null as string | null,
    quoteFresh: false,
  })
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchedAddressRef = useRef<string>('')
  const rateRequestSequenceRef = useRef(0)

  const defaultShippingSelections = currentSummary.shops.map(getDefaultShippingSelection)

  const form = useForm(
    formOptions({
      defaultValues: {
        shippingAddress: {
          name: '',
          street: '',
          addressLine2: '',
          city: '',
          postalCode: '',
          country: '',
          contactEmail: initialContactEmail,
          phone: '',
          vatId: '',
          pickupPoint: undefined,
        },
        billingAddress: {
          name: '',
          street: '',
          addressLine2: '',
          city: '',
          postalCode: '',
          country: '',
          contactEmail: initialContactEmail,
          phone: '',
          vatId: '',
        },
        sameAsShipping: true as boolean,
        shippingSelections: defaultShippingSelections,
      } as CheckoutFormValues,
      validators: {
        onChange: checkoutFormSchema,
        onSubmit: checkoutFormSchema,
      },
      onSubmit: async ({ value }) => {
        setStatus((prev) => ({ ...prev, submitError: null }))
        try {
          const billingAddress = value.sameAsShipping
            ? value.shippingAddress
            : {
                ...value.billingAddress,
                contactEmail: value.shippingAddress.contactEmail,
                phone: value.shippingAddress.phone,
              }
          const result = await createCheckout({
            data: {
              cartId,
              checkoutAttemptId: checkoutAttemptIdRef.current,
              shippingAddress: value.shippingAddress,
              billingAddress,
              shippingSelections: value.shippingSelections,
            },
          })
          if (result instanceof Response) {
            const body = await result.json().catch(() => ({}))
            setStatus((prev) => ({
              ...prev,
              submitError:
                getLocalizedErrorMessage(body.code || body.message) || m.checkout_error_submit(),
            }))
            return
          }
          if (!result?.checkoutUrl) {
            window.location.href = `/orders/${result.platformOrderId}/success`
            return
          }
          window.location.href = result.checkoutUrl
        } catch (err) {
          if (err instanceof Response) {
            const body = await err.json().catch(() => ({}))
            const errorMsg = getLocalizedErrorMessage(body.code || body.message)
            setStatus((prev) => ({
              ...prev,
              submitError: errorMsg || m.checkout_error_submit(),
            }))
          } else {
            setStatus((prev) => ({ ...prev, submitError: m.checkout_error_submit() }))
          }
        }
      },
    }),
  )

  // Service point pick-up state and selection tracking
  const [dialog, setDialog] = useState({ open: false, key: 0 })

  const shippingSelections = form.state.values.shippingSelections
  const hasServicePointSelection = shippingSelections.some((sel) => {
    const shopGroup = currentSummary.shops.find((s) => s.shopId === sel.shopId)
    if (!shopGroup) return false
    const selectedOption = shopGroup.shippingOptions.find(
      (opt) => opt.rateId === sel.rateId && opt.method === sel.method,
    )
    return selectedOption?.supportsServicePoint === true
  })

  const selectedPickupPoint = form.state.values.shippingAddress.pickupPoint

  // Helper: clear pickup point if no selected method supports service points
  const clearPickupPointIfNoServicePointMethod = useCallback(() => {
    const stillHasServicePoint = currentSummary.shops.some((shop) => {
      const sel = form.state.values.shippingSelections.find((s) => s.shopId === shop.shopId)
      const selectedOption = shop.shippingOptions.find(
        (o) => o.rateId === sel?.rateId && o.method === sel?.method,
      )
      return selectedOption?.supportsServicePoint === true
    })
    if (!stillHasServicePoint && form.state.values.shippingAddress.pickupPoint) {
      form.setFieldValue('shippingAddress.pickupPoint', undefined)
    }
  }, [currentSummary.shops, form])

  // -----------------------------------------------------------------------
  // Fetch shipping rates when relevant address fields change and are valid
  // -----------------------------------------------------------------------

  const fetchRates = useCallback(
    async (address: CheckoutFormValues['shippingAddress']) => {
      const addressKey = `${address.country}:${address.postalCode}:${address.city}`
      if (addressKey === lastFetchedAddressRef.current) return
      const requestSequence = ++rateRequestSequenceRef.current

      setStatus((prev) => ({
        ...prev,
        isFetchingRates: true,
        rateError: null,
        quoteFresh: false,
      }))

      try {
        const updatedSummary = await getCheckoutSummary({
          data: {
            cartId,
            shippingAddress: address,
            shippingSelections: form.state.values.shippingSelections,
          },
        })
        if (requestSequence !== rateRequestSequenceRef.current) return
        setCurrentSummary(updatedSummary)
        lastFetchedAddressRef.current = addressKey

        // Rebuild shipping selections by shopId so a re-ordered summary never
        // shifts a buyer's chosen method to the wrong shop.
        const nextSelections = updatedSummary.shops.map((shop) => {
          const existing = findSelectionForShop(
            form.store.state.values.shippingSelections,
            shop.shopId,
          )
          const stillValid =
            existing &&
            shop.shippingOptions.some(
              (o) => o.rateId === existing.rateId && o.method === existing.method,
            )
          return stillValid ? existing : getDefaultShippingSelection(shop)
        })
        form.setFieldValue('shippingSelections', nextSelections)
        clearPickupPointIfNoServicePointMethod()

        const hasOnlyFallback = updatedSummary.shops.some((shop) =>
          shop.shippingOptions.every((option) => option.fallback),
        )
        setStatus((prev) => ({ ...prev, quoteFresh: !hasOnlyFallback }))

        // Check if any shop has only unsupported fallbacks
        for (const shop of updatedSummary.shops) {
          if (
            shop.shippingOptions.length === 1 &&
            shop.shippingOptions[0].fallback &&
            shop.shippingOptions[0].code === 'SHIPPING_UNSUPPORTED'
          ) {
            setStatus((prev) => ({
              ...prev,
              rateError: m.checkout_shippingUnsupported(),
            }))
            break
          }
        }
      } catch {
        if (requestSequence !== rateRequestSequenceRef.current) return
        setStatus((prev) => ({
          ...prev,
          rateError: m.checkout_rate_error(),
          quoteFresh: false,
        }))
      } finally {
        if (requestSequence === rateRequestSequenceRef.current) {
          setStatus((prev) => ({ ...prev, isFetchingRates: false }))
        }
      }
    },
    [cartId, form, clearPickupPointIfNoServicePointMethod],
  )

  const scheduleRateFetch = useCallback(
    (address: CheckoutFormValues['shippingAddress']) => {
      setStatus((prev) => ({ ...prev, quoteFresh: false }))
      if (
        !address.name.trim() ||
        !address.street.trim() ||
        !address.city.trim() ||
        !isPostalCodeValid(address.postalCode, address.country)
      )
        return
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      fetchTimerRef.current = setTimeout(() => void fetchRates(address), 600)
    },
    [fetchRates],
  )

  const formOwnerRef = useCallback((node: HTMLFormElement | null) => {
    if (!node) return
    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
  }, [])

  const openPickupPointPicker = () => {
    setDialog((prev) => ({ key: prev.key + 1, open: true }))
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <main className='page-wrap px-4 pb-28 pt-10 lg:pb-16'>
      <div className='mb-8 space-y-5'>
        <Link
          to='/cart'
          className='inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-text-secondary no-underline outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
        >
          <ArrowLeft size={16} aria-hidden='true' />
          {m.checkout_back_to_cart()}
        </Link>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='mb-1 text-sm font-semibold text-accent-primary'>
              {m.checkout_secure_kicker()}
            </p>
            <h1 className='text-3xl font-semibold tracking-tight text-text-primary'>
              {m.checkout_title()}
            </h1>
          </div>
          <ol
            className='flex items-center gap-2 text-sm text-text-secondary'
            aria-label={m.checkout_progress_label()}
          >
            <li>{m.checkout_progress_cart()}</li>
            <li aria-hidden='true'>/</li>
            <li className='font-semibold text-text-primary' aria-current='step'>
              {m.checkout_progress_delivery()}
            </li>
            <li aria-hidden='true'>/</li>
            <li>{m.checkout_progress_payment()}</li>
          </ol>
        </div>
      </div>

      {/* Client-side preventDefault is required because this form is managed
          entirely by TanStack React Form. It performs conditional validation
          (billing address rules depend on sameAsShipping), debounced async
          shipping-rate fetching, service point pick-up point selection, and
          finally redirects to an external payment provider URL. A native
          <form action> would forfeit all of this client-side orchestration. */}
      <form
        id='checkout-form'
        ref={formOwnerRef}
        onSubmit={async (e) => {
          e.preventDefault()
          e.stopPropagation()
          await form.handleSubmit()
          if (!form.store.state.isValid) {
            scrollToFirstInvalidField()
          }
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
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        scheduleRateFetch({
                          ...form.store.state.values.shippingAddress,
                          name: e.target.value,
                        })
                      }}
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

              <form.Field name='shippingAddress.contactEmail'>
                {(field) => (
                  <div className='grid gap-2 sm:col-span-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_email()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type='email'
                      value={field.state.value}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        form.setFieldValue('billingAddress.contactEmail', event.target.value)
                        scheduleRateFetch({
                          ...form.store.state.values.shippingAddress,
                          contactEmail: event.target.value,
                        })
                      }}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors[0])}
                      autoComplete='email'
                      inputMode='email'
                    />
                    <p className='text-xs text-text-muted'>{m.checkout_field_email_hint()}</p>
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
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        scheduleRateFetch({
                          ...form.store.state.values.shippingAddress,
                          street: e.target.value,
                        })
                      }}
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

              <form.Field name='shippingAddress.addressLine2'>
                {(field) => (
                  <div className='grid gap-2 sm:col-span-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_address_line_2()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value ?? ''}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      autoComplete='address-line2'
                    />
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
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        scheduleRateFetch({
                          ...form.store.state.values.shippingAddress,
                          city: e.target.value,
                        })
                      }}
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
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        scheduleRateFetch({
                          ...form.store.state.values.shippingAddress,
                          postalCode: e.target.value,
                        })
                      }}
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
                    <select
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        scheduleRateFetch({
                          ...form.store.state.values.shippingAddress,
                          country: e.target.value,
                        })
                      }}
                      onBlur={field.handleBlur}
                      aria-invalid={!!field.state.meta.errors[0]}
                      aria-describedby={
                        field.state.meta.errors[0] ? `${field.name}-error` : undefined
                      }
                      autoComplete='country-name'
                      className={cn(
                        'h-11 w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2',
                        field.state.meta.errors[0]
                          ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
                          : 'border-border-default hover:border-border-strong focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20',
                      )}
                    >
                      <option value='' disabled>
                        {m.checkout_field_country_placeholder()}
                      </option>
                      {SUPPORTED_COUNTRY_CODES.map((code) => (
                        <option key={code} value={code}>
                          {getCountryName(code)}
                        </option>
                      ))}
                    </select>
                    {field.state.meta.errors[0] && (
                      <p id={`${field.name}-error`} className='text-xs text-error'>
                        {getFieldError(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name='shippingAddress.phone'>
                {(field) => (
                  <div className='grid gap-2 sm:col-span-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_field_phone()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type='tel'
                      value={field.state.value ?? ''}
                      onChange={(event) => {
                        field.handleChange(event.target.value)
                        form.setFieldValue('billingAddress.phone', event.target.value)
                      }}
                      onBlur={field.handleBlur}
                      autoComplete='tel'
                      inputMode='tel'
                    />
                    <p className='text-xs text-text-muted'>{m.checkout_field_phone_hint()}</p>
                  </div>
                )}
              </form.Field>

              <form.Field name='shippingAddress.vatId'>
                {(field) => (
                  <div className='grid gap-2 sm:col-span-2'>
                    <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
                      {m.checkout_vat_id_label()}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value ?? ''}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      error={getFieldError(field.state.meta.errors[0])}
                      placeholder={m.checkout_vat_id_placeholder()}
                    />
                    {field.state.meta.errors[0] ? (
                      <p id={`${field.name}-error`} className='text-xs text-error'>
                        {getFieldError(field.state.meta.errors[0])}
                      </p>
                    ) : (
                      <p className='text-xs text-text-muted'>{m.checkout_vat_id_helper()}</p>
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
                    </form.Field>{' '}
                    <form.Field name='billingAddress.country'>
                      {(field) => (
                        <div className='grid gap-2 sm:col-span-2'>
                          <label
                            htmlFor={field.name}
                            className='text-sm font-medium text-text-primary'
                          >
                            {m.checkout_field_country()}
                          </label>
                          <select
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-invalid={!!field.state.meta.errors[0]}
                            aria-describedby={
                              field.state.meta.errors[0] ? `${field.name}-error` : undefined
                            }
                            autoComplete='country-name'
                            className={cn(
                              'h-11 w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2',
                              field.state.meta.errors[0]
                                ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
                                : 'border-border-default hover:border-border-strong focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20',
                            )}
                          >
                            <option value='' disabled>
                              {m.checkout_field_country_placeholder()}
                            </option>
                            {SUPPORTED_COUNTRY_CODES.map((code) => (
                              <option key={code} value={code}>
                                {getCountryName(code)}
                              </option>
                            ))}
                          </select>
                          {field.state.meta.errors[0] && (
                            <p id={`${field.name}-error`} className='text-xs text-error'>
                              {getFieldError(field.state.meta.errors[0])}
                            </p>
                          )}
                        </div>
                      )}
                    </form.Field>
                    <form.Field name='billingAddress.vatId'>
                      {(field) => (
                        <div className='grid gap-2 sm:col-span-2'>
                          <div className='flex items-center justify-between'>
                            <label
                              htmlFor={field.name}
                              className='text-sm font-medium text-text-primary'
                            >
                              {m.checkout_vat_id_label()}
                            </label>
                            <span className='text-xs text-text-muted'>
                              {m.checkout_vat_id_description()}
                            </span>
                          </div>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value ?? ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            error={getFieldError(field.state.meta.errors[0])}
                            placeholder={m.checkout_vat_id_placeholder()}
                          />
                          {field.state.meta.errors[0] ? (
                            <p id={`${field.name}-error`} className='text-xs text-error'>
                              {getFieldError(field.state.meta.errors[0])}
                            </p>
                          ) : (
                            <p className='text-xs text-text-muted'>{m.checkout_vat_id_helper()}</p>
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
              {status.isFetchingRates && (
                <Loader2 size={14} className='animate-spin text-text-muted' aria-hidden='true' />
              )}
            </div>

            {status.rateError && (
              <p className='mb-4 text-sm text-error' role='alert'>
                {status.rateError}
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
                          {status.rateError
                            ? status.rateError
                            : m.checkout_shipping_address_prompt()}
                        </p>
                        {status.rateError && (
                          <Button
                            type='button'
                            variant='secondary'
                            size='sm'
                            onClick={() => {
                              lastFetchedAddressRef.current = ''
                              void fetchRates(form.state.values.shippingAddress)
                            }}
                          >
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
                                                form.state.values.shippingSelections.map(
                                                  (s, idx) =>
                                                    idx === fieldIndex ? nextSelection : s,
                                                )
                                              field.handleChange(nextSelection)
                                              clearPickupPointIfNoServicePointMethod()

                                              // Keep the authoritative server summary in sync with
                                              // the buyer's shipping choice so grand totals and VAT
                                              // estimates never drift from what will be charged.
                                              const address = form.state.values.shippingAddress
                                              if (
                                                address.country &&
                                                address.postalCode &&
                                                address.city &&
                                                addressSchema.safeParse(address).success
                                              ) {
                                                const requestSequence =
                                                  ++rateRequestSequenceRef.current
                                                setStatus((prev) => ({
                                                  ...prev,
                                                  isFetchingRates: true,
                                                  rateError: null,
                                                  quoteFresh: false,
                                                }))
                                                void getCheckoutSummary({
                                                  data: {
                                                    cartId,
                                                    shippingAddress: address,
                                                    shippingSelections: nextSelections,
                                                  },
                                                })
                                                  .then((summary) => {
                                                    if (
                                                      requestSequence !==
                                                      rateRequestSequenceRef.current
                                                    )
                                                      return
                                                    setCurrentSummary(summary)
                                                    setStatus((prev) => ({
                                                      ...prev,
                                                      isFetchingRates: false,
                                                      quoteFresh: true,
                                                    }))
                                                  })
                                                  .catch(() => {
                                                    if (
                                                      requestSequence !==
                                                      rateRequestSequenceRef.current
                                                    )
                                                      return
                                                    setStatus((prev) => ({
                                                      ...prev,
                                                      isFetchingRates: false,
                                                      rateError: m.checkout_rate_error(),
                                                      quoteFresh: false,
                                                    }))
                                                  })
                                              }
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
                  <Button type='button' variant='secondary' onClick={openPickupPointPicker}>
                    {m.checkout_pickup_point_change()}
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-warning/30 bg-warning/5'>
                  <div>
                    <h3 className='text-sm font-semibold text-warning-strong'>
                      {m.checkout_no_pickup_point()}
                    </h3>
                    <p className='text-xs text-text-secondary mt-1'>
                      {m.checkout_pickup_point_hint()}
                    </p>
                  </div>
                  <Button type='button' variant='primary' onClick={openPickupPointPicker}>
                    {m.checkout_pickup_point_select()}
                  </Button>
                </div>
              )}
            </section>
          )}

          <CheckoutOrderItems currentSummary={currentSummary} />
        </div>

        {/* Right column: order summary */}
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
              {/* Use the server-computed grand total so the displayed amount always matches the
                  authoritative checkout summary and the charge that will be created. */}
              <span className='text-xl font-bold text-text-primary'>
                {formatPriceEUR(currentSummary.grandTotalCents)}
              </span>
            </div>

            <CheckoutLegalDisclosures shops={currentSummary.shops} />

            {status.submitError && (
              <p className='mt-3 text-sm text-error' role='alert'>
                {status.submitError}
              </p>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => {
                const disableSubmit =
                  isSubmitting ||
                  status.isFetchingRates ||
                  !status.quoteFresh ||
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
                    {!status.quoteFresh && !status.isFetchingRates && !status.rateError && (
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
      </form>

      <div className='fixed inset-x-0 bottom-0 z-sticky border-t border-border-default bg-surface-default/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg lg:hidden'>
        <div className='mx-auto flex max-w-lg items-center gap-4'>
          <div className='min-w-0 flex-1'>
            <p className='text-xs text-text-secondary'>{m.checkout_grand_total()}</p>
            <p className='truncate text-lg font-bold tabular-nums text-text-primary'>
              {formatPriceEUR(currentSummary.grandTotalCents)}
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
                  status.isFetchingRates ||
                  !status.quoteFresh ||
                  (hasServicePointSelection && !selectedPickupPoint)
                }
              >
                {m.checkout_mobile_payment_action({
                  total: formatPriceEUR(currentSummary.grandTotalCents),
                })}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>

      <PickupPointSelectorModal
        key={dialog.key}
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        postalCode={form.state.values.shippingAddress.postalCode || ''}
        country={form.state.values.shippingAddress.country || 'FR'}
        carrier={(() => {
          const firstServicePointSelection = shippingSelections.find((sel) => {
            const shopGroup = currentSummary.shops.find((s) => s.shopId === sel.shopId)
            if (!shopGroup) return false
            const selectedOption = shopGroup.shippingOptions.find(
              (opt) => opt.rateId === sel.rateId && opt.method === sel.method,
            )
            return selectedOption?.supportsServicePoint === true
          })
          if (!firstServicePointSelection) return undefined
          const shopGroup = currentSummary.shops.find(
            (s) => s.shopId === firstServicePointSelection.shopId,
          )
          const option = shopGroup?.shippingOptions.find(
            (o) => o.rateId === firstServicePointSelection.rateId,
          )
          return option?.carrier
        })()}
        onSelect={(point) => {
          form.setFieldValue('shippingAddress.pickupPoint', {
            id: point.id,
            name: point.name,
            street: point.street,
            postalCode: point.postalCode,
            city: point.city,
            country: point.country,
          })
        }}
      />
    </main>
  )
}
