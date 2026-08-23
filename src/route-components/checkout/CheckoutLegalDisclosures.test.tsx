// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckoutLegalDisclosures } from './CheckoutLegalDisclosures'

// vi.mock factories are hoisted above imports, so the mock module must be
// loaded with a dynamic import here; a static import would not be initialized yet.
vi.mock('@tanstack/react-router', async () => {
  return await import('./checkout-test-router')
})

vi.mock('#/paraglide/messages', async () => {
  return await import('./checkout-test-messages')
})

import { defaultSellerLegal, makeSummary } from './checkout-fixtures'

describe('CheckoutLegalDisclosures', () => {
  it('renders the declared trader status for each seller, including the non-trader consequence', () => {
    const firstShop = makeSummary().shops[0]
    render(
      <CheckoutLegalDisclosures
        shops={[
          firstShop,
          {
            ...firstShop,
            shopId: 'shop-2',
            shopName: 'Private Maker',
            shopSlug: 'private-maker',
            sellerLegal: {
              ...defaultSellerLegal,
              tradeName: 'Private Maker',
              traderStatus: 'non_trader',
            },
          },
        ]}
      />,
    )

    expect(screen.getByText('This seller has declared that they are a trader.')).toBeDefined()
    expect(screen.getByText('This seller has declared that they are not a trader.')).toBeDefined()
    expect(
      screen.getByText(
        'Consumer rights stemming from EU consumer protection law do not apply to the contract.',
      ),
    ).toBeDefined()
  })
})
