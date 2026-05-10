import { useForm } from '@tanstack/react-form'
import { useRouter } from '@tanstack/react-router'
import { Loader2, MapPin, Package, Truck } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { createCheckout } from '#/lib/checkout'
import type { CheckoutSummary } from '#/lib/checkout.server'
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

const shippingAddressSchema = z.object({
  name: z.string().min(1, m.checkout_error_name_required()).max(255),
  street: z.string().min(1, m.checkout_error_street_required()).max(255),
  city: z.string().min(1, m.checkout_error_city_required()).max(255),
  postalCode: z.string().min(1, m.checkout_error_postal_required()).max(50),
  country: z.string().min(1, m.checkout_error_country_required()).max(100),
})

const checkoutFormSchema = z.object({
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema,
  sameAsShipping: z.boolean(),
  shippingSelections: z.array(
    z.object({
      shopId: z.string().min(1),
      method: z.enum(['standard', 'express']),
    }),
  ),
})

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>

export default function CheckoutPage({ summary, cartId }: CheckoutPageProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const defaultShippingSelections = summary.shops.map((shop) => ({
    shopId: shop.shopId,
    method: 'standard' as const,
  }))

  const form = useForm({
    defaultValues: {
      shippingAddress: {
        name: '',
        street: '',
        city: '',
        postalCode: '',
        country: '',
      },
      billingAddress: {
        name: '',
        street: '',
        city: '',
        postalCode: '',
        country: '',
      },
      sameAsShipping: true,
      shippingSelections: defaultShippingSelections,
    } satisfies CheckoutFormValues,
    validators: {
      onChange: checkoutFormSchema,
      onSubmit: checkoutFormSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        const billingAddress = value.sameAsShipping
          ? value.shippingAddress
          : value.billingAddress
        const result = await createCheckout({
          data: {
            cartId,
            shippingAddress: value.shippingAddress,
            billingAddress,
            shippingSelections: value.shippingSelections,
          },
        })
        router.navigate({
          to: '/orders/$platformOrderId/success',
          params: { platformOrderId: result.platformOrderId },
        })
      } catch (err) {
        if (err instanceof Response) {
          const body = await err.json().catch(() => ({}))
          setSubmitError(body.message || m.checkout_error_submit())
        } else {
          setSubmitError(m.checkout_error_submit())
        }
      }
    },
  })

  const grandTotal = summary.shops.reduce((total, shop) => {
    const selection = form.getFieldValue('shippingSelections').find((s) => s.shopId === shop.shopId)
    const shippingCost =
      shop.shippingOptions.find((o) => o.method === selection?.method)?.costCents ??
      shop.shippingOptions[0].costCents
    return total + shop.subtotalCents + shippingCost
  }, 0)

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mb-8'>
        <h1 className='display-title text-3xl font-bold text-text-primary sm:text-4xl'>
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
                    className='h-4 w-4 accent-accent-primary'
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
            </div>

            <div className='space-y-6'>
              {summary.shops.map((shop, shopIndex) => (
                <div key={shop.shopId}>
                  <h3 className='mb-3 text-sm font-medium text-text-secondary'>{shop.shopName}</h3>
                  <div className='space-y-2'>
                    {shop.shippingOptions.map((option) => (
                      <form.Field
                        key={option.method}
                        name={`shippingSelections[${shopIndex}].method`}
                      >
                        {(field) => (
                          <label
                            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors ${
                              field.state.value === option.method
                                ? 'border-accent-primary bg-accent-primary/5'
                                : 'border-border-default hover:border-border-strong'
                            }`}
                          >
                            <div className='flex items-center gap-3'>
                              <input
                                type='radio'
                                name={field.name}
                                value={option.method}
                                checked={field.state.value === option.method}
                                onChange={(e) =>
                                  field.handleChange(e.target.value as 'standard' | 'express')
                                }
                                onBlur={field.handleBlur}
                                className='h-4 w-4 accent-accent-primary'
                              />
                              <span className='text-sm font-medium text-text-primary'>
                                {option.method === 'standard'
                                  ? m.checkout_shipping_standard()
                                  : m.checkout_shipping_express()}
                              </span>
                            </div>
                            <span className='text-sm font-semibold text-text-primary'>
                              {formatPriceEUR(option.costCents)}
                            </span>
                          </label>
                        )}
                      </form.Field>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Order items */}
          <section className='island-shell rounded-2xl p-4 sm:p-6'>
            <div className='mb-4 flex items-center gap-2'>
              <Package size={18} className='text-accent-primary' aria-hidden='true' />
              <h2 className='text-lg font-semibold text-text-primary'>
                {m.checkout_order_items()}
              </h2>
            </div>

            <div className='space-y-6'>
              {summary.shops.map((shop) => (
                <div key={shop.shopId}>
                  <h3 className='mb-2 text-sm font-medium text-text-secondary'>{shop.shopName}</h3>
                  <ul className='divide-y divide-border-subtle'>
                    {shop.items.map((item) => (
                      <li
                        key={item.productId}
                        className='flex items-center gap-4 py-3 first:pt-0 last:pb-0'
                      >
                        <div className='flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
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
              {summary.shops.map((shop) => {
                const selection = form
                  .getFieldValue('shippingSelections')
                  .find((s) => s.shopId === shop.shopId)
                const shippingOption =
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
                      <span className='text-text-secondary'>
                        {shippingOption.method === 'standard'
                          ? m.checkout_shipping_standard()
                          : m.checkout_shipping_express()}
                      </span>
                      <span className='font-medium text-text-primary'>
                        {formatPriceEUR(shippingOption.costCents)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className='my-4 border-t border-border-default' />

            <div className='flex items-center justify-between'>
              <span className='text-base font-semibold text-text-primary'>
                {m.checkout_grand_total()}
              </span>
              <span className='text-xl font-bold text-text-primary'>
                {formatPriceEUR(grandTotal)}
              </span>
            </div>

            {submitError && (
              <p className='mt-3 text-sm text-error' role='alert'>
                {submitError}
              </p>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type='submit'
                  size='lg'
                  className='mt-6 w-full'
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
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
              )}
            </form.Subscribe>
          </section>
        </div>
      </form>
    </main>
  )
}
