import { MapPin } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { SUPPORTED_COUNTRY_CODES } from '#/lib/orders-ui'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { cn } from '#/lib/cn'
import type { CheckoutFormApi, CheckoutFormValues } from './checkout-form'

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

function getCountryName(code: string): string {
  return new Intl.DisplayNames([getLocale()], { type: 'region' }).of(code) ?? code
}

interface CheckoutAddressStepProps {
  form: CheckoutFormApi
  scheduleRateFetch: (address: CheckoutFormValues['shippingAddress']) => void
}

/**
 * Shipping and billing address entry for checkout.
 *
 * Address edits schedule a debounced shipping-rate refetch; email and phone
 * are mirrored into the billing draft so the buyer only types them once.
 */
export function CheckoutAddressStep({ form, scheduleRateFetch }: CheckoutAddressStepProps) {
  return (
    <>
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
                  aria-describedby={field.state.meta.errors[0] ? `${field.name}-error` : undefined}
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
                <form.Field name='billingAddress.street'>
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
                <form.Field name='billingAddress.city'>
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
                <form.Field name='billingAddress.postalCode'>
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
                </form.Field>{' '}
                <form.Field name='billingAddress.country'>
                  {(field) => (
                    <div className='grid gap-2 sm:col-span-2'>
                      <label htmlFor={field.name} className='text-sm font-medium text-text-primary'>
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
    </>
  )
}
