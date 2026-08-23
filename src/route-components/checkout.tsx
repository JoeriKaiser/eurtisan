import { useLoaderData } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { createCheckout, getCheckoutSummary } from '#/lib/checkout'
import type { CheckoutShopGroup, CheckoutSummary } from '#/lib/checkout.server'
import { getLocalizedErrorMessage } from '#/lib/error-mapping'
import { isPostalCodeValid } from '#/lib/shared/address-validation'
import { m } from '#/paraglide/messages'
import { CheckoutAddressStep } from './checkout/CheckoutAddressStep'
import { CheckoutHeader } from './checkout/CheckoutHeader'
import { CheckoutMobilePaymentBar } from './checkout/CheckoutMobilePaymentBar'
import { CheckoutOrderItems } from './checkout/CheckoutOrderItems'
import { CheckoutOrderSummary } from './checkout/CheckoutOrderSummary'
import { CheckoutShippingStep } from './checkout/CheckoutShippingStep'
import { PickupPointSelectorModal } from './checkout/PickupPointSelectorModal'
import {
  addressSchema,
  checkoutFormSchema,
  type CheckoutFormValues,
  useCheckoutForm,
} from './checkout/checkout-form'

export interface CheckoutPageProps {
  summary: CheckoutSummary
  cartId: string
  initialContactEmail?: string
}

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
 * One-page checkout: address entry, per-shop shipping selection, service point
 * pick-up, and order summary. The page owns the TanStack React Form instance,
 * the authoritative server summary state, debounced rate refetching, and the
 * submit hand-off to the payment provider; each step renders as a focused
 * panel under `./checkout/`.
 */
export function CheckoutPage({
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

  const hasUndeclaredShop = currentSummary.shops.some(
    (shop) => shop.sellerLegal.traderStatus === null,
  )
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchedAddressRef = useRef<string>('')
  const rateRequestSequenceRef = useRef(0)

  const defaultShippingSelections = currentSummary.shops.map(getDefaultShippingSelection)

  const form = useCheckoutForm({
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
  })

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

  const retryRateFetch = useCallback(() => {
    lastFetchedAddressRef.current = ''
    void fetchRates(form.state.values.shippingAddress)
  }, [fetchRates, form])

  /**
   * After a shipping option change has been committed to the form, re-sync the
   * authoritative server summary so grand totals and VAT estimates never drift
   * from what will be charged.
   */
  const handleShippingOptionSelected = useCallback(
    (nextSelections: CheckoutFormValues['shippingSelections']) => {
      clearPickupPointIfNoServicePointMethod()

      const address = form.state.values.shippingAddress
      if (
        address.country &&
        address.postalCode &&
        address.city &&
        addressSchema.safeParse(address).success
      ) {
        const requestSequence = ++rateRequestSequenceRef.current
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
            if (requestSequence !== rateRequestSequenceRef.current) return
            setCurrentSummary(summary)
            setStatus((prev) => ({
              ...prev,
              isFetchingRates: false,
              quoteFresh: true,
            }))
          })
          .catch(() => {
            if (requestSequence !== rateRequestSequenceRef.current) return
            setStatus((prev) => ({
              ...prev,
              isFetchingRates: false,
              rateError: m.checkout_rate_error(),
              quoteFresh: false,
            }))
          })
      }
    },
    [cartId, form, clearPickupPointIfNoServicePointMethod],
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
      <CheckoutHeader />

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
          <CheckoutAddressStep form={form} scheduleRateFetch={scheduleRateFetch} />
          <CheckoutShippingStep
            form={form}
            currentSummary={currentSummary}
            shippingSelections={shippingSelections}
            isFetchingRates={status.isFetchingRates}
            rateError={status.rateError}
            hasServicePointSelection={hasServicePointSelection}
            selectedPickupPoint={selectedPickupPoint}
            onRetryRates={retryRateFetch}
            onShippingOptionSelected={handleShippingOptionSelected}
            onOpenPickupPointPicker={openPickupPointPicker}
          />
          <CheckoutOrderItems currentSummary={currentSummary} />
        </div>

        {/* Right column: order summary */}
        <CheckoutOrderSummary
          form={form}
          currentSummary={currentSummary}
          submitError={status.submitError}
          isFetchingRates={status.isFetchingRates}
          quoteFresh={status.quoteFresh}
          rateError={status.rateError}
          hasUndeclaredShop={hasUndeclaredShop}
          hasServicePointSelection={hasServicePointSelection}
          selectedPickupPoint={selectedPickupPoint}
        />
      </form>

      <CheckoutMobilePaymentBar
        form={form}
        grandTotalCents={currentSummary.grandTotalCents}
        isFetchingRates={status.isFetchingRates}
        quoteFresh={status.quoteFresh}
        hasUndeclaredShop={hasUndeclaredShop}
        hasServicePointSelection={hasServicePointSelection}
        selectedPickupPoint={selectedPickupPoint}
      />

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

export function CheckoutRouteComponent() {
  const { summary, cartId, initialContactEmail } = useLoaderData({ from: '/checkout' })
  return (
    <CheckoutPage summary={summary} cartId={cartId} initialContactEmail={initialContactEmail} />
  )
}
