// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutPage } from '../checkout'

const mockCreateCheckout = vi.hoisted(() => vi.fn())
const mockGetCheckoutSummary = vi.hoisted(() => vi.fn())
const mockGetServicePoints = vi.hoisted(() => vi.fn())

vi.mock('#/lib/checkout', () => ({
  createCheckout: mockCreateCheckout,
  getCheckoutSummary: mockGetCheckoutSummary,
  getServicePoints: mockGetServicePoints,
}))

// vi.mock factories are hoisted above imports, so the mock module must be
// loaded with a dynamic import here; a static import would not be initialized yet.
vi.mock('@tanstack/react-router', async () => {
  return await import('./checkout-test-router')
})

vi.mock('#/paraglide/messages', async () => {
  return await import('./checkout-test-messages')
})

import { makeSummary } from './checkout-fixtures'

// The address fields are managed by the page-level TanStack form, so this
// suite renders the full checkout composition and asserts on the address step.
describe('CheckoutAddressStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-1' })
    mockGetCheckoutSummary.mockResolvedValue(makeSummary())
  })

  it('renders shipping address fields', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByLabelText('Full name')).toBeDefined()
    expect(screen.getByLabelText('Street address')).toBeDefined()
    expect(screen.getByLabelText('City')).toBeDefined()
    expect(screen.getByLabelText('Postal code')).toBeDefined()
    expect(screen.getByLabelText('Country')).toBeDefined()
  })

  it('shows validation errors for empty required fields on submit', async () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    const submitButton = screen.getByRole('button', { name: 'Confirm purchase' })
    const form = submitButton.closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeDefined()
      expect(screen.getByText('Street address is required')).toBeDefined()
      expect(screen.getByText('City is required')).toBeDefined()
      expect(screen.getByLabelText('Postal code').getAttribute('aria-invalid')).toBe('true')
      expect(screen.getByLabelText('Country').getAttribute('aria-invalid')).toBe('true')
    })
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

  describe('VAT ID validation', () => {
    it('shows an inline error for an invalid billing VAT ID', async () => {
      render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

      fireEvent.click(screen.getByLabelText('Same as shipping address'))
      const billingSection = screen
        .getByRole('heading', { name: 'Billing address' })
        .closest('section')
      if (!billingSection) throw new Error('Billing section not found')

      // Fill the billing address so only the VAT ID is invalid.
      fireEvent.change(within(billingSection).getByLabelText('Full name'), {
        target: { value: 'Test Buyer' },
      })
      fireEvent.change(within(billingSection).getByLabelText('Street address'), {
        target: { value: '42 Main St' },
      })
      fireEvent.change(within(billingSection).getByLabelText('City'), {
        target: { value: 'Berlin' },
      })
      fireEvent.change(within(billingSection).getByLabelText('Postal code'), {
        target: { value: '10115' },
      })
      fireEvent.change(within(billingSection).getByLabelText('Country'), {
        target: { value: 'DE' },
      })
      fireEvent.change(within(billingSection).getByLabelText('VAT ID (Optional)'), {
        target: { value: 'DE123' },
      })
      fireEvent.blur(within(billingSection).getByLabelText('VAT ID (Optional)'))

      await waitFor(() => {
        expect(screen.getByText('Invalid VAT ID format')).toBeDefined()
      })
    })

    it('shows no error for a well-formed billing VAT ID', async () => {
      render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)

      fireEvent.click(screen.getByLabelText('Same as shipping address'))
      const billingSection = screen
        .getByRole('heading', { name: 'Billing address' })
        .closest('section')
      if (!billingSection) throw new Error('Billing section not found')

      fireEvent.change(within(billingSection).getByLabelText('Full name'), {
        target: { value: 'Test Buyer' },
      })
      fireEvent.change(within(billingSection).getByLabelText('Street address'), {
        target: { value: '42 Main St' },
      })
      fireEvent.change(within(billingSection).getByLabelText('City'), {
        target: { value: 'Paris' },
      })
      fireEvent.change(within(billingSection).getByLabelText('Postal code'), {
        target: { value: '75008' },
      })
      fireEvent.change(within(billingSection).getByLabelText('Country'), {
        target: { value: 'FR' },
      })
      fireEvent.change(within(billingSection).getByLabelText('VAT ID (Optional)'), {
        target: { value: 'FR12345678901' },
      })
      fireEvent.blur(within(billingSection).getByLabelText('VAT ID (Optional)'))

      await waitFor(() => {
        expect(screen.queryByText('Invalid VAT ID format')).toBeNull()
        expect(
          screen.queryByText('VAT ID country prefix must match the billing country'),
        ).toBeNull()
      })
    })
  })
})
