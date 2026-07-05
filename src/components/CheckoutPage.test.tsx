// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CheckoutPage from './CheckoutPage'

const mockCreateCheckout = vi.hoisted(() => vi.fn())
const mockGetCheckoutSummary = vi.hoisted(() => vi.fn())
const mockGetServicePoints = vi.hoisted(() => vi.fn())

vi.mock('#/lib/checkout', () => ({
  createCheckout: mockCreateCheckout,
  getCheckoutSummary: mockGetCheckoutSummary,
  getServicePoints: mockGetServicePoints,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
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
    checkout_field_country_placeholder: () => 'Select a country',
    checkout_shipping_method: () => 'Shipping method',
    shipping_estimatedDays_one: () => '1 business day',
    shipping_estimatedDays_other: (inputs: { count: number }) => `${inputs.count} business days`,
    shipping_estimatedDays_range: (inputs: { min: number; max: number }) =>
      `${inputs.min}–${inputs.max} business days`,
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
    checkout_shippingUnsupported: () => 'We cannot ship to this address for this shop.',
    checkout_pickup_point_label: () => 'Pick-up Point',
    checkout_pickup_point_id: (inputs: { id: string }) => `ID: ${inputs.id}`,
    checkout_no_pickup_point: () => 'No Pick-up Point Selected',
    checkout_pickup_point_hint: () =>
      'Please choose a pick-up point location to complete your order.',
    checkout_pickup_point_change: () => 'Change Pick-up Point',
    checkout_pickup_point_select: () => 'Select Pick-up Point',
    checkout_pickup_point_required: () =>
      'Please select a pick-up point before placing your order.',
    checkout_rate_error: () => 'Could not fetch shipping rates. Please try again.',
    checkout_missing_url: () => 'Checkout URL is missing. Please try again.',
    checkout_shipping_label: () => 'Shipping',
    checkout_includes_vat: () => 'Includes VAT',
    checkout_total_vat: () => 'Total VAT included',
    checkout_vat_id_label: () => 'VAT ID (Optional)',
    checkout_vat_id_description: () => 'For EU VAT-registered businesses',
    checkout_vat_id_placeholder: () => 'e.g., DE123456789',
    checkout_vat_id_helper: () =>
      'Enter to enable zero-rated EU cross-border billing. Must match the billing country.',
    checkout_vat_id_invalid_format: () => 'Invalid VAT ID format',
    checkout_vat_id_invalid_prefix: () => 'VAT ID country prefix must match the billing country',
    product_no_image: () => 'No image available',
    cart_shop_subtotal: () => 'Subtotal',
    error_cart_empty: () => 'Cart is empty',
    error_out_of_stock: () => 'Some items are out of stock',
    error_dispute_window_expired: () => 'Dispute window has expired (30 days)',
    error_unexpected: () => 'An unexpected error occurred',
    checkout_legal_heading: () => 'Seller information & your rights',
    checkout_seller_identity_title: () => 'Seller (trader)',
    checkout_seller_contact_label: () => 'Contact',
    checkout_seller_vat_label: () => 'VAT number',
    checkout_withdrawal_notice: () => '14-day withdrawal notice',
    checkout_terms_notice_prefix: () => 'By confirming, you agree to our',
    checkout_terms_notice_and: () => 'and',
    footer_legal_terms: () => 'Terms of Service',
    footer_legal_privacy: () => 'Privacy Policy',
  },
}))

const defaultSellerLegal = {
  tradeName: 'Test Shop',
  contactEmail: 'seller@example.com',
  vatId: null,
  address: { street: '1 Rue Test', city: 'Paris', postalCode: '75001', country: 'FR' },
} as const

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
            weightGrams: null,
            lengthCm: null,
            widthCm: null,
            heightCm: null,
          },
        ],
        subtotalCents: 2000,
        vatEstimateCents: 0,
        sellerLegal: defaultSellerLegal,
        shippingOptions: [
          {
            method: 'standard' as const,
            costCents: 500,
            label: 'Standard',
            rateId: 'rate-std-1',
            carrier: 'dhl',
            serviceName: 'DHL Standard',
            estimatedDays: { min: 2, max: 4 },
            fallback: false,
          },
          {
            method: 'express' as const,
            costCents: 1000,
            label: 'Express',
            rateId: 'rate-xpr-1',
            carrier: 'dhl',
            serviceName: 'DHL Express',
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

function makeServicePointSummary(
  overrides?: Partial<Parameters<typeof CheckoutPage>[0]['summary']>,
) {
  return {
    ...makeSummary(),
    shops: [
      {
        ...makeSummary().shops[0],
        shippingOptions: [
          {
            method: 'standard' as const,
            costCents: 500,
            label: 'Standard',
            rateId: 'sendcloud_std_test_001',
            carrier: 'sendcloud',
            serviceName: 'Sendcloud Standard',
            estimatedDays: { min: 2, max: 4 },
            fallback: false,
            supportsServicePoint: true,
          },
          {
            method: 'express' as const,
            costCents: 1000,
            label: 'Express',
            rateId: 'sendcloud_xpr_test_001',
            carrier: 'sendcloud',
            serviceName: 'Sendcloud Express',
            estimatedDays: { min: 1, max: 1 },
            fallback: false,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCheckout.mockResolvedValue({ platformOrderId: 'order-1' })
    // Return the same summary by default for rate fetches
    mockGetCheckoutSummary.mockResolvedValue(makeSummary())
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
    expect(screen.getAllByText('DHL Standard').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('DHL Express').length).toBeGreaterThanOrEqual(1)

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
    const expressRadio = screen.getByLabelText(/DHL Express/i)
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
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'DE' } })

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
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'DE' } })

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
    expect(screen.getAllByText('€25.00').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByLabelText(/DHL Express/i))
    // Express shipping: 2000 + 1000 = 3000
    expect(screen.getAllByText('€30.00').length).toBeGreaterThanOrEqual(1)
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

    render(<CheckoutPage summary={summaryAFirst} cartId='cart-1' />)

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

  describe('Service Point Selection', () => {
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
        // Submit button should be enabled
        const submitBtn = screen.getByRole('button', { name: 'Confirm purchase' })
        expect(submitBtn).toHaveProperty('disabled', false)
      })
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
