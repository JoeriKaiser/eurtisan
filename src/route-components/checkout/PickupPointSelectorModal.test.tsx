// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

import { makeServicePointSummary } from './checkout-fixtures'

describe('PickupPointSelectorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-1' })
    mockGetCheckoutSummary.mockResolvedValue(makeServicePointSummary())
    // Return deterministic mock service points for the pick-up point modal
    mockGetServicePoints.mockResolvedValue([
      {
        id: 'FR-75001-01',
        name: 'Relay Pick-up - Auchan',
        street: '25 Rue de Rivoli',
        postalCode: '75001',
        city: 'Paris',
        country: 'FR',
        distance: '0.4 km',
      },
      {
        id: 'FR-75001-02',
        name: 'Épicerie du Coin',
        street: '14 Rue Saint-Denis',
        postalCode: '75001',
        city: 'Paris',
        country: 'FR',
        distance: '0.8 km',
      },
    ])
  })

  it('opens pick-up point selector modal and allows selecting a point', async () => {
    render(<CheckoutPage summary={makeServicePointSummary()} cartId='cart-1' />)

    // Initially, no pickup point is shown
    expect(screen.queryByText('Relay Pick-up - Auchan')).toBeNull()

    // Fill in postal code and country to avoid empty required fields in modal search
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '75001' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'FR' } })

    // Click Select Pick-up Point button
    fireEvent.click(screen.getByRole('button', { name: 'Select Pick-up Point' }))

    // Verify the dialog is visible and shows details
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Select Pick-up Point' })).toBeDefined()

    // Click Search in the modal
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    // Now the mock service points should be displayed
    await waitFor(() => {
      expect(screen.getByText('Relay Pick-up - Auchan')).toBeDefined()
      expect(screen.getByText('25 Rue de Rivoli')).toBeDefined()
    })

    // Click Select on the first pick-up point
    const selectButtons = screen.getAllByRole('button', { name: 'Select' })
    fireEvent.click(selectButtons[0])

    // The modal should close and the selected point details should be rendered on the main page
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByText('Relay Pick-up - Auchan')).toBeDefined()
      expect(screen.getByText('25 Rue de Rivoli')).toBeDefined()
      // The warning banner should be gone
      expect(
        screen.queryByText('Please select a pick-up point before placing your order.'),
      ).toBeNull()
      // A pick-up point alone is insufficient until the address has a fresh quote.
      const submitBtn = screen.getByRole('button', { name: 'Confirm purchase' })
      expect(submitBtn).toHaveProperty('disabled', true)
    })
  })
})
