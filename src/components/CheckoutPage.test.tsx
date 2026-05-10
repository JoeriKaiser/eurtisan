// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockCreateCheckout = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}))

vi.mock('#/lib/checkout', () => ({
  createCheckout: mockCreateCheckout,
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    checkout_title: () => 'Checkout',
    checkout_shipping_address: () => 'Shipping address',
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
          { method: 'standard' as const, costCents: 500, label: 'Standard' },
          { method: 'express' as const, costCents: 1000, label: 'Express' },
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

  it('renders shipping method options per shop', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByRole('heading', { name: 'Test Shop' })).toBeDefined()
    expect(screen.getByLabelText('Standard')).toBeDefined()
    expect(screen.getByLabelText('Express')).toBeDefined()
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

  it('allows selecting express shipping', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    const expressRadio = screen.getByLabelText('Express')
    fireEvent.click(expressRadio)
    expect(expressRadio).toHaveProperty('checked', true)
  })

  it('calls createCheckout and navigates on successful submit', async () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase' }))

    await waitFor(() => {
      expect(mockCreateCheckout).toHaveBeenCalledWith({
        data: {
          cartId: 'cart-1',
          shippingAddress: {
            name: 'Test User',
            street: '123 Main St',
            city: 'Berlin',
            postalCode: '10115',
            country: 'Germany',
          },
          shippingSelections: [{ shopId: 'shop-1', method: 'standard' }],
        },
      })
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/orders/$platformOrderId/success',
        params: { platformOrderId: 'order-1' },
      })
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

    fireEvent.click(screen.getByLabelText('Express'))
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
            { method: 'standard' as const, costCents: 500, label: 'Standard' },
            { method: 'express' as const, costCents: 1000, label: 'Express' },
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
            { method: 'standard' as const, costCents: 500, label: 'Standard' },
            { method: 'express' as const, costCents: 1000, label: 'Express' },
          ],
        },
      ],
    })

    render(<CheckoutPage summary={summary} cartId='cart-1' />)
    expect(screen.getByText('Shop A')).toBeDefined()
    expect(screen.getByText('Shop B')).toBeDefined()
  })
})
