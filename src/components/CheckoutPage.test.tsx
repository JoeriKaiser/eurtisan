// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage'

const mockCreateCheckout = vi.hoisted(() => vi.fn())
const mockGetCheckoutSummary = vi.hoisted(() => vi.fn())

vi.mock('#/lib/checkout', () => ({
  createCheckout: mockCreateCheckout,
  getCheckoutSummary: mockGetCheckoutSummary,
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    checkout_title: () => 'Checkout',
    checkout_shipping_address: () => 'Shipping address',
    checkout_billing_address: () => 'Billing address',
    checkout_billing_same_as_shipping: () => 'Same as shipping address',
    checkout_field_full_name: () => 'Full name',
    checkout_field_street: () => 'Street address',
    checkout_field_city: () => 'City',
    checkout_field_postal_code: () => 'Postal code',
    checkout_field_country: () => 'Country',
    checkout_shipping_method: () => 'Shipping method',
    checkout_shipping_standard: () => 'Standard',
    checkout_shipping_express: () => 'Express',
    checkout_order_items: () => 'Order items',
    checkout_quantity_label: (inputs: { count: string }) => `Qty: ${inputs.count}`,
    checkout_order_summary: () => 'Order summary',
    checkout_grand_total: () => 'Grand total',
    checkout_confirm_button: () => 'Confirm purchase',
    checkout_confirm_loading: () => 'Processing…',
    checkout_error_name_required: () => 'Full name is required',
    checkout_error_street_required: () => 'Street address is required',
    checkout_error_city_required: () => 'City is required',
    checkout_error_postal_required: () => 'Postal code is required',
    checkout_error_country_required: () => 'Country is required',
    checkout_error_submit: () => 'Could not complete checkout. Please try again.',
    product_no_image: () => 'No image available',
    cart_shop_subtotal: () => 'Subtotal',
  },
}))

function makeSummary(overrides?: Partial<Parameters<typeof CheckoutPage>[0]['summary']>) {
  return {
    cartId: 'cart-1',
    shops: [
      {
        shopId: 'shop-1',
        shopName: 'Test Shop',
        shopSlug: 'test-shop',
        items: [
          {
            productId: 'prod-1',
            name: 'Vase',
            slug: 'vase',
            priceCents: 1000,
            quantity: 2,
            imageUrl: 'http://example.com/vase.jpg',
          },
        ],
        subtotalCents: 2000,
        shippingOptions: [
          {
            method: 'standard' as const,
            costCents: 500,
            label: 'Standard',
            rateId: 'rate-std-1',
            carrier: 'mondial_relay',
            serviceName: 'Mondial Relay Standard',
            estimatedDays: { min: 2, max: 4 },
            fallback: false,
          },
          {
            method: 'express' as const,
            costCents: 1000,
            label: 'Express',
            rateId: 'rate-xpr-1',
            carrier: 'mondial_relay',
            serviceName: 'Mondial Relay Express',
            estimatedDays: { min: 1, max: 1 },
            fallback: false,
          },
        ],
      },
    ],
    grandTotalCents: 2000,
    ...overrides,
  }
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-1' })
    // Return the same summary by default for rate fetches
    mockGetCheckoutSummary.mockResolvedValue(makeSummary())
  })

  it('renders checkout title', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeDefined()
  })

  it('renders shipping address fields', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByLabelText('Full name')).toBeDefined()
    expect(screen.getByLabelText('Street address')).toBeDefined()
    expect(screen.getByLabelText('City')).toBeDefined()
    expect(screen.getByLabelText('Postal code')).toBeDefined()
    expect(screen.getByLabelText('Country')).toBeDefined()
  })

  it('renders shipping method options per shop with carrier name and estimated days', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    // Shop name heading in shipping methods section
    const shopHeadings = screen.getAllByText('Test Shop')
    expect(shopHeadings.length).toBeGreaterThanOrEqual(1)

    // Carrier name and service names (appear in both shipping options and sidebar summary)
    expect(screen.getAllByText('Mondial Relay Standard').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Mondial Relay Express').length).toBeGreaterThanOrEqual(1)

    // Estimated delivery days
    expect(screen.getByText('2–4 business days')).toBeDefined()
    expect(screen.getByText('1 business day')).toBeDefined()
  })

  it('renders order items', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByText('Vase')).toBeDefined()
    expect(screen.getByText('Qty: 2')).toBeDefined()
  })

  it('renders order summary with totals', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByText('Order summary')).toBeDefined()
    expect(screen.getByText('Grand total')).toBeDefined()
  })

  it('shows validation errors for empty required fields on submit', async () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase' }))

    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeDefined()
      expect(screen.getByText('Street address is required')).toBeDefined()
      expect(screen.getByText('City is required')).toBeDefined()
      expect(screen.getByText('Postal code is required')).toBeDefined()
      expect(screen.getByText('Country is required')).toBeDefined()
    })
  })

  it('allows selecting different shipping options', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    // Click the express radio (label text includes carrier/estimated days, so use regex)
    const expressRadio = screen.getByLabelText(/Mondial Relay Express/i)
    fireEvent.click(expressRadio)
    // Verify the radio is checked
    expect(expressRadio).toHaveProperty('checked', true)
  })

  it('calls createCheckout with rateId and redirects on success', async () => {
    const savedLocation = window.location
    delete (window as { location?: unknown }).location
    window.location = { ...savedLocation, href: '' } as Location & string

    const checkoutUrl = 'https://checkout.mollie.com/pay/test_payment_1'
    mockCreateCheckout.mockResolvedValue({
      platformOrderId: 'order-1',
      checkoutUrl,
    })

    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    // Wait for the debounced rate fetch
    await waitFor(
      () => {
        expect(mockGetCheckoutSummary).toHaveBeenCalled()
      },
      { timeout: 1500 },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase' }))

    await waitFor(() => {
      expect(mockCreateCheckout).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cartId: 'cart-1',
          shippingAddress: {
            name: 'Test User',
            street: '123 Main St',
            city: 'Berlin',
            postalCode: '10115',
            country: 'Germany',
          },
          shippingSelections: expect.arrayContaining([
            expect.objectContaining({
              shopId: 'shop-1',
              method: 'standard',
              rateId: 'rate-std-1',
            }),
          ]),
        }),
      })
      expect(window.location.href).toBe(checkoutUrl)
    })

    window.location = savedLocation as Location & string
  })

  it('renders billing address section with same-as-shipping toggle', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByRole('heading', { name: 'Billing address' })).toBeDefined()
    expect(screen.getByLabelText('Same as shipping address')).toBeDefined()
  })

  it('shows billing address fields when same-as-shipping is unchecked', async () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    const checkbox = screen.getByLabelText('Same as shipping address')
    fireEvent.click(checkbox)

    await waitFor(() => {
      const fullNameFields = screen.getAllByLabelText('Full name')
      expect(fullNameFields.length).toBe(2)
      const streetFields = screen.getAllByLabelText('Street address')
      expect(streetFields.length).toBe(2)
    })
  })

  it('displays submit error when createCheckout fails', async () => {
    mockCreateCheckout.mockRejectedValue(
      new Response(JSON.stringify({ message: 'Cart is empty' }), { status: 409 }),
    )

    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    // Wait for debounced rate fetch
    await waitFor(
      () => {
        expect(mockGetCheckoutSummary).toHaveBeenCalled()
      },
      { timeout: 1500 },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText('Cart is empty')).toBeDefined()
    })
  })

  it('updates grand total when shipping method changes', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    // Standard shipping: 2000 + 500 = 2500
    expect(screen.getAllByText('€25,00').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByLabelText(/Mondial Relay Express/i))
    // Express shipping: 2000 + 1000 = 3000
    expect(screen.getAllByText('€30,00').length).toBeGreaterThanOrEqual(1)
  })

  it('renders multiple shop groups', () => {
    const summary = makeSummary({
      shops: [
        {
          shopId: 'shop-1',
          shopName: 'Shop A',
          shopSlug: 'shop-a',
          items: [
            {
              productId: 'prod-1',
              name: 'Vase',
              slug: 'vase',
              priceCents: 1000,
              quantity: 1,
              imageUrl: null,
            },
          ],
          subtotalCents: 1000,
          shippingOptions: [
            {
              method: 'standard' as const,
              costCents: 500,
              label: 'Standard',
              rateId: 'rate-a-std',
              carrier: 'mondial_relay',
              serviceName: 'Mondial Relay Standard',
              estimatedDays: { min: 2, max: 4 },
              fallback: false,
            },
          ],
        },
        {
          shopId: 'shop-2',
          shopName: 'Shop B',
          shopSlug: 'shop-b',
          items: [
            {
              productId: 'prod-2',
              name: 'Bowl',
              slug: 'bowl',
              priceCents: 2000,
              quantity: 1,
              imageUrl: null,
            },
          ],
          subtotalCents: 2000,
          shippingOptions: [
            {
              method: 'standard' as const,
              costCents: 500,
              label: 'Standard',
              rateId: 'rate-b-std',
              carrier: 'mondial_relay',
              serviceName: 'Mondial Relay Standard',
              estimatedDays: { min: 2, max: 4 },
              fallback: false,
            },
          ],
        },
      ],
    })

    render(<CheckoutPage summary={summary} cartId='cart-1' />)
    expect(screen.getAllByText('Shop A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Shop B').length).toBeGreaterThanOrEqual(1)
  })

  it('shows manual fallback option when shipping provider is unavailable', () => {
    const summary = makeSummary({
      shops: [
        {
          shopId: 'shop-1',
          shopName: 'Fallback Shop',
          shopSlug: 'fallback-shop',
          items: [
            {
              productId: 'prod-1',
              name: 'Vase',
              slug: 'vase',
              priceCents: 1000,
              quantity: 1,
              imageUrl: null,
            },
          ],
          subtotalCents: 1000,
          shippingOptions: [
            {
              method: 'manual' as const,
              costCents: 0,
              label: 'Manual shipping — contact seller',
              fallback: true,
            },
          ],
        },
      ],
    })

    render(<CheckoutPage summary={summary} cartId='cart-1' />)
    expect(screen.getAllByText('Manual shipping — contact seller').length).toBeGreaterThanOrEqual(1)
  })
})
