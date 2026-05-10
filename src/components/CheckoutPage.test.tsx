// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}))

vi.mock('#/lib/checkout', () => ({
  createCheckout: vi.fn(),
}))

import { createCheckout } from '#/lib/checkout'

vi.mock('#/paraglide/messages', () => ({
  m: {
    checkout_title: () => 'Checkout',
    checkout_shipping_address: () => 'Shipping address',
    checkout_name: () => 'Full name',
    checkout_street: () => 'Street address',
    checkout_city: () => 'City',
    checkout_postal_code: () => 'Postal code',
    checkout_country: () => 'Country',
    checkout_name_required: () => 'Full name is required',
    checkout_street_required: () => 'Street address is required',
    checkout_city_required: () => 'City is required',
    checkout_postal_code_required: () => 'Postal code is required',
    checkout_country_required: () => 'Country is required',
    checkout_place_order: () => 'Place order',
    checkout_processing: () => 'Processing…',
    checkout_error_generic: () => 'Something went wrong. Please try again.',
    checkout_error_stock_exhausted: () => 'Some items are no longer available.',
    checkout_error_stock_item: (inputs: { name: string }) => `${inputs.name} — out of stock`,
    checkout_retry: () => 'Update cart and retry',
    checkout_order_summary: () => 'Order summary',
    checkout_shipping: () => 'Shipping',
    checkout_shipping_standard: () => 'Standard',
    checkout_shipping_express: () => 'Express',
    checkout_select_shipping_for_shop: (inputs: { shopName: string }) =>
      `Shipping for ${inputs.shopName}`,
    checkout_grand_total: () => 'Grand total',
    cart_title: () => 'Your cart',
    cart_shop_subtotal: () => 'Subtotal',
    product_no_image: () => 'No image',
  },
}))

function makeSummary() {
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
    grandTotalCents: 2500,
  }
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockResolvedValue(undefined)
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

  it('renders order summary with shop items', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByText('Test Shop')).toBeDefined()
    expect(screen.getByText('Vase')).toBeDefined()
    expect(screen.getByText('× 2')).toBeDefined()
  })

  it('renders shipping options per shop', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByRole('radio', { name: /Standard/i })).toBeDefined()
    expect(screen.getByRole('radio', { name: /Express/i })).toBeDefined()
  })

  it('selects standard shipping by default', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    const standard = screen.getByRole('radio', { name: /Standard/i }) as HTMLInputElement
    expect(standard.checked).toBe(true)
  })

  it('allows switching shipping method', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    const express = screen.getByRole('radio', { name: /Express/i }) as HTMLInputElement
    fireEvent.click(express)
    expect(express.checked).toBe(true)
  })

  it('shows validation errors when fields are empty on submit', async () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    const submitButton = screen.getByRole('button', { name: 'Place order' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeDefined()
    })
  })

  it('calls createCheckout with correct data when form is valid', async () => {
    const mockCreateCheckout = createCheckout as unknown as ReturnType<typeof vi.fn>
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-123' })

    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))

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
        }),
      })
    })
  })

  it('navigates to success page after successful order', async () => {
    const mockCreateCheckout = createCheckout as unknown as ReturnType<typeof vi.fn>
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-123' })

    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/orders/$platformOrderId/success',
        params: { platformOrderId: 'order-123' },
      })
    })
  })

  it('shows stock exhaustion error with product names on 409', async () => {
    const mockCreateCheckout = createCheckout as unknown as ReturnType<typeof vi.fn>
    const response = new Response(
      JSON.stringify({ error: 'Conflict', message: 'Out of stock', productIds: ['prod-1'] }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
    mockCreateCheckout.mockRejectedValue(response)

    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => {
      expect(screen.getByText('Some items are no longer available.')).toBeDefined()
      expect(screen.getByText('Vase — out of stock')).toBeDefined()
    })
  })

  it('shows generic error for non-409 failures', async () => {
    const mockCreateCheckout = createCheckout as unknown as ReturnType<typeof vi.fn>
    mockCreateCheckout.mockRejectedValue(new Error('Network error'))

    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeDefined()
    })
  })

  it('redirects to signin on 401', async () => {
    const mockCreateCheckout = createCheckout as unknown as ReturnType<typeof vi.fn>
    const response = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockCreateCheckout.mockRejectedValue(response)

    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Germany' } })

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/signin',
        search: { redirect: '/checkout' },
      })
    })
  })
})
