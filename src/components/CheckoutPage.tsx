import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, ImageOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import { createCheckout } from '#/lib/checkout'
import type { CheckoutShopGroup, CheckoutSummary, ShippingAddress } from '#/lib/checkout.server'
import { getShippingCost } from '#/lib/checkout.server'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'

export interface CheckoutPageProps {
  summary: CheckoutSummary
  cartId: string
}

const shippingAddressSchema = z.object({
  name: z.string().min(1, m.checkout_name_required()),
  street: z.string().min(1, m.checkout_street_required()),
  city: z.string().min(1, m.checkout_city_required()),
  postalCode: z.string().min(1, m.checkout_postal_code_required()),
  country: z.string().min(1, m.checkout_country_required()),
})

type FieldErrors = Partial<Record<keyof ShippingAddress, string>>

export default function CheckoutPage({ summary, cartId }: CheckoutPageProps) {
  const navigate = useNavigate()
  const [shippingSelections, setShippingSelections] = useState<
    Record<string, 'standard' | 'express'>
  >(() => {
    const initial: Record<string, 'standard' | 'express'> = {}
    for (const shop of summary.shops) {
      initial[shop.shopId] = 'standard'
    }
    return initial
  })

  const [address, setAddress] = useState<ShippingAddress>({
    name: '',
    street: '',
    city: '',
    postalCode: '',
    country: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [stockErrorProducts, setStockErrorProducts] = useState<
    { productId: string; name: string }[] | null
  >(null)
  const [genericError, setGenericError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const grandTotal = summary.shops.reduce((sum, shop) => {
    const method = shippingSelections[shop.shopId] ?? 'standard'
    return sum + shop.subtotalCents + getShippingCost(method)
  }, 0)

  const handleShippingChange = (shopId: string, method: 'standard' | 'express') => {
    setShippingSelections((prev) => ({ ...prev, [shopId]: method }))
  }

  const handleAddressChange = (field: keyof ShippingAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setStockErrorProducts(null)
    setGenericError(null)

    const parseResult = shippingAddressSchema.safeParse(address)
    if (!parseResult.success) {
      const errors: FieldErrors = {}
      for (const issue of parseResult.error.issues) {
        const field = issue.path[0] as keyof ShippingAddress
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createCheckout({
        data: {
          cartId,
          shippingSelections: summary.shops.map((shop) => ({
            shopId: shop.shopId,
            method: shippingSelections[shop.shopId] ?? 'standard',
          })),
          shippingAddress: parseResult.data,
        },
      })
      await navigate({
        to: '/orders/$platformOrderId/success',
        params: { platformOrderId: result.platformOrderId },
      })
    } catch (err) {
      if (err instanceof Response) {
        if (err.status === 409) {
          try {
            const body = (await err.json()) as { productIds?: string[]; message?: string }
            if (body.productIds && body.productIds.length > 0) {
              const products: { productId: string; name: string }[] = []
              for (const pid of body.productIds) {
                const name = findProductName(summary, pid)
                products.push({ productId: pid, name: name ?? pid })
              }
              setStockErrorProducts(products)
            } else {
              setGenericError(body.message || m.checkout_error_stock_exhausted())
            }
          } catch {
            setGenericError(m.checkout_error_stock_exhausted())
          }
        } else if (err.status === 401) {
          await navigate({ to: '/signin', search: { redirect: '/checkout' } })
        } else {
          setGenericError(m.checkout_error_generic())
        }
      } else {
        setGenericError(m.checkout_error_generic())
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mb-6'>
        <Link
          to='/cart'
          className='inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary'
        >
          <ArrowLeft size={16} aria-hidden='true' />
          {m.cart_title()}
        </Link>
      </div>

      <h1 className='display-title mb-8 text-3xl font-bold text-text-primary sm:text-4xl'>
        {m.checkout_title()}
      </h1>

      {genericError && (
        <div
          className='mb-6 rounded-lg border border-error bg-error-subtle px-4 py-3 text-sm text-error'
          role='alert'
        >
          {genericError}
        </div>
      )}

      {stockErrorProducts && stockErrorProducts.length > 0 && (
        <div
          className='mb-6 rounded-lg border border-error bg-error-subtle px-4 py-4 text-sm text-error'
          role='alert'
        >
          <div className='flex items-start gap-2'>
            <AlertTriangle size={18} className='mt-0.5 flex-shrink-0' aria-hidden='true' />
            <div>
              <p className='font-medium'>{m.checkout_error_stock_exhausted()}</p>
              <ul className='mt-2 list-disc space-y-1 pl-5'>
                {stockErrorProducts.map((p) => (
                  <li key={p.productId}>{m.checkout_error_stock_item({ name: p.name })}</li>
                ))}
              </ul>
              <div className='mt-3'>
                <Link to='/cart' className='no-underline'>
                  <Button variant='secondary' size='sm'>
                    <RefreshCw size={14} className='mr-1.5' aria-hidden='true' />
                    {m.checkout_retry()}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className='grid gap-8 lg:grid-cols-[1fr_360px]'>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Shipping address */}
          <section className='island-shell rounded-2xl p-4 sm:p-6'>
            <h2 className='mb-4 text-lg font-semibold text-text-primary'>
              {m.checkout_shipping_address()}
            </h2>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='sm:col-span-2'>
                <label
                  htmlFor='name'
                  className='mb-1.5 block text-sm font-medium text-text-primary'
                >
                  {m.checkout_name()}
                </label>
                <input
                  id='name'
                  type='text'
                  value={address.name}
                  onChange={(e) => handleAddressChange('name', e.target.value)}
                  className={`flex h-10 w-full rounded-lg border bg-surface-default px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 ${fieldErrors.name ? 'border-error' : 'border-border-default'}`}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                />
                {fieldErrors.name && (
                  <p id='name-error' className='mt-1 text-xs text-error'>
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className='sm:col-span-2'>
                <label
                  htmlFor='street'
                  className='mb-1.5 block text-sm font-medium text-text-primary'
                >
                  {m.checkout_street()}
                </label>
                <input
                  id='street'
                  type='text'
                  value={address.street}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  className={`flex h-10 w-full rounded-lg border bg-surface-default px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 ${fieldErrors.street ? 'border-error' : 'border-border-default'}`}
                  aria-invalid={!!fieldErrors.street}
                  aria-describedby={fieldErrors.street ? 'street-error' : undefined}
                />
                {fieldErrors.street && (
                  <p id='street-error' className='mt-1 text-xs text-error'>
                    {fieldErrors.street}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor='city'
                  className='mb-1.5 block text-sm font-medium text-text-primary'
                >
                  {m.checkout_city()}
                </label>
                <input
                  id='city'
                  type='text'
                  value={address.city}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                  className={`flex h-10 w-full rounded-lg border bg-surface-default px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 ${fieldErrors.city ? 'border-error' : 'border-border-default'}`}
                  aria-invalid={!!fieldErrors.city}
                  aria-describedby={fieldErrors.city ? 'city-error' : undefined}
                />
                {fieldErrors.city && (
                  <p id='city-error' className='mt-1 text-xs text-error'>
                    {fieldErrors.city}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor='postalCode'
                  className='mb-1.5 block text-sm font-medium text-text-primary'
                >
                  {m.checkout_postal_code()}
                </label>
                <input
                  id='postalCode'
                  type='text'
                  value={address.postalCode}
                  onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                  className={`flex h-10 w-full rounded-lg border bg-surface-default px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 ${fieldErrors.postalCode ? 'border-error' : 'border-border-default'}`}
                  aria-invalid={!!fieldErrors.postalCode}
                  aria-describedby={fieldErrors.postalCode ? 'postalCode-error' : undefined}
                />
                {fieldErrors.postalCode && (
                  <p id='postalCode-error' className='mt-1 text-xs text-error'>
                    {fieldErrors.postalCode}
                  </p>
                )}
              </div>
              <div className='sm:col-span-2'>
                <label
                  htmlFor='country'
                  className='mb-1.5 block text-sm font-medium text-text-primary'
                >
                  {m.checkout_country()}
                </label>
                <input
                  id='country'
                  type='text'
                  value={address.country}
                  onChange={(e) => handleAddressChange('country', e.target.value)}
                  className={`flex h-10 w-full rounded-lg border bg-surface-default px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 ${fieldErrors.country ? 'border-error' : 'border-border-default'}`}
                  aria-invalid={!!fieldErrors.country}
                  aria-describedby={fieldErrors.country ? 'country-error' : undefined}
                />
                {fieldErrors.country && (
                  <p id='country-error' className='mt-1 text-xs text-error'>
                    {fieldErrors.country}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Shipping method per shop */}
          {summary.shops.map((shop) => (
            <ShopShippingSection
              key={shop.shopId}
              shop={shop}
              selectedMethod={shippingSelections[shop.shopId] ?? 'standard'}
              onChange={(method) => handleShippingChange(shop.shopId, method)}
            />
          ))}

          <Button
            type='submit'
            size='lg'
            className='w-full'
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? m.checkout_processing() : m.checkout_place_order()}
          </Button>
        </form>

        {/* Order summary sidebar */}
        <div className='lg:sticky lg:top-24 lg:self-start'>
          <section className='island-shell rounded-2xl p-6'>
            <h2 className='mb-4 text-lg font-semibold text-text-primary'>
              {m.checkout_order_summary()}
            </h2>
            <div className='space-y-4'>
              {summary.shops.map((shop) => {
                const method = shippingSelections[shop.shopId] ?? 'standard'
                const shippingCost = getShippingCost(method)
                return (
                  <div key={shop.shopId} className='space-y-2'>
                    <p className='text-sm font-medium text-text-primary'>{shop.shopName}</p>
                    <ul className='space-y-1'>
                      {shop.items.map((item) => (
                        <li
                          key={item.productId}
                          className='flex items-center gap-2 text-sm text-text-secondary'
                        >
                          <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-inset'>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className='h-full w-full object-cover'
                              />
                            ) : (
                              <ImageOff size={14} className='text-text-muted' aria-hidden='true' />
                            )}
                          </div>
                          <span className='flex-1 truncate'>{item.name}</span>
                          <span className='text-text-primary'>× {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                    <div className='flex justify-between text-sm'>
                      <span className='text-text-secondary'>{m.checkout_shipping()}</span>
                      <span className='font-medium text-text-primary'>
                        {formatPriceEUR(shippingCost)}
                      </span>
                    </div>
                    <div className='flex justify-between text-sm'>
                      <span className='text-text-secondary'>{m.cart_shop_subtotal()}</span>
                      <span className='font-medium text-text-primary'>
                        {formatPriceEUR(shop.subtotalCents)}
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
          </section>
        </div>
      </div>
    </main>
  )
}

function ShopShippingSection({
  shop,
  selectedMethod,
  onChange,
}: {
  shop: CheckoutShopGroup
  selectedMethod: 'standard' | 'express'
  onChange: (method: 'standard' | 'express') => void
}) {
  return (
    <section className='island-shell rounded-2xl p-4 sm:p-6'>
      <h2 className='mb-4 text-lg font-semibold text-text-primary'>
        {m.checkout_select_shipping_for_shop({ shopName: shop.shopName })}
      </h2>
      <div className='space-y-3'>
        {shop.shippingOptions.map((option) => (
          <label
            key={option.method}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${selectedMethod === option.method ? 'border-accent-primary bg-accent-primary/5' : 'border-border-default hover:border-border-strong'}`}
          >
            <input
              type='radio'
              name={`shipping-${shop.shopId}`}
              value={option.method}
              checked={selectedMethod === option.method}
              onChange={() => onChange(option.method)}
              className='h-4 w-4 accent-accent-primary'
            />
            <div className='flex-1'>
              <p className='text-sm font-medium text-text-primary'>
                {option.method === 'standard'
                  ? m.checkout_shipping_standard()
                  : m.checkout_shipping_express()}
              </p>
              <p className='text-xs text-text-secondary'>{option.label}</p>
            </div>
            <span className='text-sm font-semibold text-text-primary'>
              {formatPriceEUR(option.costCents)}
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}

function findProductName(summary: CheckoutSummary, productId: string): string | undefined {
  for (const shop of summary.shops) {
    for (const item of shop.items) {
      if (item.productId === productId) {
        return item.name
      }
    }
  }
  return undefined
}
