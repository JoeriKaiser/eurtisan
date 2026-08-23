// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
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

// The summary subscribes to the page-level form's shipping selections, so this
// suite renders the full checkout composition and asserts on the summary panel.
describe('CheckoutOrderSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-1' })
    mockGetCheckoutSummary.mockResolvedValue(makeSummary())
    mockGetServicePoints.mockResolvedValue([])
  })

  it('renders order summary with totals', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByText('Order summary')).toBeDefined()
    expect(screen.getAllByText('Grand total').length).toBeGreaterThanOrEqual(1)
  })

  it('updates order summary shipping line when shipping method changes', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    // Default summary shows Standard shipping.
    expect(screen.getAllByText('DHL Standard').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('€5.00').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByLabelText(/DHL Express/i))

    // Summary should now reflect the selected Express option and its cost.
    expect(screen.getAllByText('DHL Express').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('€10.00').length).toBeGreaterThanOrEqual(1)
  })
})
