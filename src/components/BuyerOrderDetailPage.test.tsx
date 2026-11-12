// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BuyerOrderDetailPage from './BuyerOrderDetailPage'
import type { OrderDetail } from '#/lib/orders/types'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
  }) => {
    let href = to
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        href = href.replace(`$${key}`, val)
      }
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  },
  useRouter: () => ({
    invalidate: vi.fn(),
  }),
}))

vi.mock('#/lib/cart-hooks', () => ({
  useAddToCart: () => ({
    mutateAsync: vi.fn(),
  }),
}))

vi.mock('#/hooks/useCountdown', () => ({
  useCountdown: () => ({ remaining: 0, start: vi.fn() }),
  useReservationCountdown: () => 0,
}))

const mockOrder: OrderDetail = {
  id: 'order-1',
  orderNumber: 'EUR-2026-0001',
  totalCents: 4500,
  status: 'paid',
  createdAt: new Date('2026-11-12T10:00:00Z'),
  cancelledAt: null,
  cancellationReason: null,
  shippingAddress: {
    name: 'Jean Dupont',
    street: '12 Rue de Rivoli',
    city: 'Paris',
    postalCode: '75001',
    country: 'FR',
    phone: '+33123456789',
  },
  shops: [
    {
      shopOrderId: 'so-1',
      shopId: 'shop-1',
      shopName: 'Atelier Céramique',
      shopSlug: 'atelier-ceramique',
      shippingMethod: 'standard',
      shippingRateId: null,
      shippingCostCents: 500,
      subtotalCents: 4000,
      vatAmountCents: 800,
      shippingVatRateBasisPoints: 2000,
      shippingVatAmountCents: 100,
      status: 'paid',
      trackingNumber: null,
      trackingUrl: null,
      deliveredAt: null,
      shippingLabels: [],
      trackingStatus: null,
      invoiceNumber: null,
      disputeId: null,
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Grès Vase',
          unitPriceCents: 4000,
          quantity: 1,
          totalCents: 4000,
          vatRateBasisPoints: 2000,
          vatAmountCents: 800,
          imageUrl: null,
        },
      ],
    },
  ],
}

describe('BuyerOrderDetailPage', () => {
  it('renders order number and items', () => {
    render(<BuyerOrderDetailPage order={mockOrder} />)
    expect(screen.getByText(/EUR-2026-0001/)).toBeTruthy()
    expect(screen.getAllByText('Grès Vase').length).toBeGreaterThan(0)
  })

  it('links shop header and item row to shop storefront when shopSlug is present', () => {
    render(<BuyerOrderDetailPage order={mockOrder} />)

    const shopLinks = screen.getAllByRole('link', { name: /Atelier Céramique/i })
    expect(shopLinks.length).toBeGreaterThan(0)
    expect(shopLinks[0].getAttribute('href')).toBe('/shops/atelier-ceramique')

    const visitShopLink = screen.getByRole('link', { name: /Visit shop|Voir la boutique/i })
    expect(visitShopLink).toBeTruthy()
    expect(visitShopLink.getAttribute('href')).toBe('/shops/atelier-ceramique')
  })
})
