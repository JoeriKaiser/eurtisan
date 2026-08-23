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

import { defaultSellerLegal, makeServicePointSummary, makeSummary } from './checkout-fixtures'

// Shipping options and the pick-up point panel are driven by the page-level
// form and summary state, so this suite renders the full checkout composition.
describe('CheckoutShippingStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-1' })
    mockGetCheckoutSummary.mockResolvedValue(makeSummary())
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

  it('renders shipping method options per shop with carrier name and estimated days', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    // Shop name heading in shipping methods section
    const shopHeadings = screen.getAllByText('Test Shop')
    expect(shopHeadings.length).toBeGreaterThanOrEqual(1)

    // Carrier name and service names (appear in both shipping options and sidebar summary)
    expect(screen.getAllByText('DHL Standard').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('DHL Express').length).toBeGreaterThanOrEqual(1)

    // Estimated delivery days
    expect(screen.getByText('2–4 business days')).toBeDefined()
    expect(screen.getByText('1 business day')).toBeDefined()
  })

  it('allows selecting different shipping options', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    // Click the express radio (label text includes carrier/estimated days, so use regex)
    const expressRadio = screen.getByLabelText(/DHL Express/i)
    fireEvent.click(expressRadio)
    // Verify the radio is checked
    expect(expressRadio).toHaveProperty('checked', true)
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
              weightGrams: null,
              volumeMl: null,
              soldBy: null,
              lengthCm: null,
              widthCm: null,
              heightCm: null,
            },
          ],
          subtotalCents: 1000,
          vatEstimateCents: 0,
          sellerLegal: { ...defaultSellerLegal, tradeName: 'Fallback Shop' },
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

  it('keeps the selected shipping method attached to the correct shop after a re-fetch reverses shop order', async () => {
    const summaryAFirst = makeSummary({
      shops: [
        {
          shopId: 'shop-a',
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
              weightGrams: null,
              volumeMl: null,
              soldBy: null,
              lengthCm: null,
              widthCm: null,
              heightCm: null,
            },
          ],
          subtotalCents: 1000,
          vatEstimateCents: 0,
          sellerLegal: { ...defaultSellerLegal, tradeName: 'Shop A' },
          shippingOptions: [
            {
              method: 'standard' as const,
              costCents: 500,
              label: 'Standard',
              rateId: 'rate-a-std',
              carrier: 'dhl',
              serviceName: 'DHL Standard',
              estimatedDays: { min: 2, max: 4 },
              fallback: false,
            },
            {
              method: 'express' as const,
              costCents: 1000,
              label: 'Express',
              rateId: 'rate-a-xpr',
              carrier: 'dhl',
              serviceName: 'DHL Express',
              estimatedDays: { min: 1, max: 1 },
              fallback: false,
            },
          ],
        },
        {
          shopId: 'shop-b',
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
              weightGrams: null,
              volumeMl: null,
              soldBy: null,
              lengthCm: null,
              widthCm: null,
              heightCm: null,
            },
          ],
          subtotalCents: 2000,
          vatEstimateCents: 0,
          sellerLegal: { ...defaultSellerLegal, tradeName: 'Shop B' },
          shippingOptions: [
            {
              method: 'standard' as const,
              costCents: 500,
              label: 'Standard',
              rateId: 'rate-b-std',
              carrier: 'dhl',
              serviceName: 'DHL Standard',
              estimatedDays: { min: 2, max: 4 },
              fallback: false,
            },
          ],
        },
      ],
    })

    const summaryBFirst = {
      ...summaryAFirst,
      shops: [summaryAFirst.shops[1], summaryAFirst.shops[0]],
    }

    mockGetCheckoutSummary.mockResolvedValueOnce(summaryAFirst).mockResolvedValueOnce(summaryBFirst)

    render(
      <CheckoutPage
        summary={summaryAFirst}
        cartId='cart-1'
        initialContactEmail='buyer@example.com'
      />,
    )

    // Fill the shipping address to trigger the first rate fetch
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'DE' } })

    await waitFor(
      () => {
        expect(mockGetCheckoutSummary).toHaveBeenCalledTimes(1)
      },
      { timeout: 1500 },
    )

    // Select express for Shop A (first in the initial order)
    const shopAExpress = screen.getByLabelText(/DHL Express/i)
    fireEvent.click(shopAExpress)
    expect(shopAExpress).toHaveProperty('checked', true)

    // Change the city to trigger a second rate fetch that returns shops reversed
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Munich' } })

    await waitFor(
      () => {
        expect(mockGetCheckoutSummary).toHaveBeenCalledTimes(2)
      },
      { timeout: 1500 },
    )

    // After reversal, Shop B is first and Shop A is second. The express option
    // must still belong to Shop A, not Shop B.
    const shopFieldsets = screen.getAllByRole('group')
    expect(shopFieldsets[0].textContent).toContain('Shop B')
    expect(shopFieldsets[1].textContent).toContain('Shop A')

    const allExpressRadios = screen.getAllByLabelText(/DHL Express/i)
    expect(allExpressRadios.length).toBe(1)
    expect(allExpressRadios[0]).toHaveProperty('checked', true)

    // The single express radio should be inside Shop A's fieldset
    const shopAFieldset = shopFieldsets[1]
    expect(shopAFieldset?.contains(allExpressRadios[0])).toBe(true)
  })

  it('renders pick-up point selection section and warning banner when a service-point option is selected', () => {
    render(<CheckoutPage summary={makeServicePointSummary()} cartId='cart-1' />)
    expect(screen.getByText('Pick-up Point')).toBeDefined()
    expect(
      screen.getByText('Please select a pick-up point before placing your order.'),
    ).toBeDefined()
    // Submit button should be disabled
    const submitBtn = screen.getByRole('button', { name: 'Confirm purchase' })
    expect(submitBtn).toHaveProperty('disabled', true)
  })
})
