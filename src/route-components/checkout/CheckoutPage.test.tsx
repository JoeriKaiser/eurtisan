// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
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

import { defaultSellerLegal, makeSummary } from './checkout-fixtures'

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-1' })
    // Return the same summary by default for rate fetches
    mockGetCheckoutSummary.mockResolvedValue(makeSummary())
  })

  it('has no automated accessibility violations in the initial checkout state', async () => {
    const { container } = render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders checkout title', () => {
    render(<CheckoutPage summary={makeSummary()} cartId='cart-1' />)
    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeDefined()
  })

  it('explains an undeclared seller status and disables checkout actions', () => {
    render(
      <CheckoutPage
        summary={makeSummary({
          shops: [
            {
              ...makeSummary().shops[0],
              sellerLegal: { ...defaultSellerLegal, traderStatus: null },
            },
          ],
        })}
        cartId='cart-1'
      />,
    )

    expect(
      screen.getByText(
        'This seller has not declared whether they are a trader. Purchases are unavailable until the declaration is provided.',
      ),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Pay €25.00' })).toHaveProperty('disabled', true)
  })

  it('calls createCheckout with rateId and redirects on success', async () => {
    const savedLocation = window.location
    delete (window as { location?: unknown }).location
    window.location = { ...savedLocation, href: 'http://localhost/' } as Location & string

    const checkoutUrl = 'https://checkout.mollie.com/pay/test_payment_1'
    mockCreateCheckout.mockResolvedValue({
      platformOrderId: 'order-1',
      checkoutUrl,
    })

    render(
      <CheckoutPage
        summary={makeSummary()}
        cartId='cart-1'
        initialContactEmail='buyer@example.com'
      />,
    )

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), {
      target: { value: '123 Main St' },
    })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'DE' } })

    // Wait for the debounced rate fetch
    await waitFor(
      () => {
        expect(mockGetCheckoutSummary).toHaveBeenCalled()
      },
      { timeout: 1500 },
    )

    const submitButton = screen.getByRole('button', { name: 'Confirm purchase' })
    await waitFor(() => expect(submitButton).toHaveProperty('disabled', false))
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockCreateCheckout).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cartId: 'cart-1',
          shippingAddress: expect.objectContaining({
            name: 'Test User',
            street: '123 Main St',
            city: 'Berlin',
            postalCode: '10115',
            country: 'DE',
          }),
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

  it('displays submit error when createCheckout fails', async () => {
    mockCreateCheckout.mockRejectedValue(
      new Response(JSON.stringify({ message: 'Cart is empty' }), { status: 409 }),
    )

    render(
      <CheckoutPage
        summary={makeSummary()}
        cartId='cart-1'
        initialContactEmail='buyer@example.com'
      />,
    )

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'DE' } })

    // Wait for debounced rate fetch
    await waitFor(
      () => {
        expect(mockGetCheckoutSummary).toHaveBeenCalled()
      },
      { timeout: 1500 },
    )

    const submitButton = screen.getByRole('button', { name: 'Confirm purchase' })
    await waitFor(() => expect(submitButton).toHaveProperty('disabled', false))
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText('Cart is empty')).toBeDefined()
    })
  })

  it('updates grand total when shipping method changes', async () => {
    // The component now treats the server-returned summary as the single source
    // of truth for grand totals. Provide a valid address so changing the
    // shipping method triggers a refetch, then mock the express response.
    mockGetCheckoutSummary.mockResolvedValueOnce(makeSummary())
    mockGetCheckoutSummary.mockResolvedValueOnce(
      makeSummary({
        shops: [
          {
            ...makeSummary().shops[0],
            shippingOptions: makeSummary().shops[0].shippingOptions,
          },
        ],
        grandTotalCents: 3000,
      }),
    )

    render(
      <CheckoutPage
        summary={makeSummary()}
        cartId='cart-1'
        initialContactEmail='buyer@example.com'
      />,
    )

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '123 Main St' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Berlin' } })
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '10115' } })
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'DE' } })

    await waitFor(() => expect(mockGetCheckoutSummary).toHaveBeenCalled(), { timeout: 1500 })

    // Standard shipping: 2000 + 500 = 2500
    expect(screen.getAllByText('€25.00').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByLabelText(/DHL Express/i))

    await waitFor(() => expect(mockGetCheckoutSummary).toHaveBeenCalledTimes(2), {
      timeout: 1500,
    })

    // Express shipping: 2000 + 1000 = 3000
    expect(screen.getAllByText('€30.00').length).toBeGreaterThanOrEqual(1)
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

    render(<CheckoutPage summary={summary} cartId='cart-1' />)
    expect(screen.getAllByText('Shop A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Shop B').length).toBeGreaterThanOrEqual(1)
  })
})
