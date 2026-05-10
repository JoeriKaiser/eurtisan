// @vitest-environment jsdom

import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CartProvider, useCart } from './CartProvider'

const mockGetCart = vi.hoisted(() => vi.fn())

vi.mock('#/lib/cart', () => ({
  getCart: mockGetCart,
}))

function TestConsumer() {
  const { cart, isLoading, error } = useCart()
  return (
    <div>
      <span data-testid='loading'>{isLoading ? 'loading' : 'idle'}</span>
      <span data-testid='items'>{cart?.totalItems ?? 0}</span>
      <span data-testid='error'>{error?.message ?? 'no-error'}</span>
    </div>
  )
}

describe('CartProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('fetches cart on mount', async () => {
    mockGetCart.mockResolvedValue({
      id: 'cart-1',
      userId: null,
      sessionId: 'sess-1',
      expiresAt: null,
      shops: [
        {
          shopId: 'shop-1',
          shopName: 'Test Shop',
          shopSlug: 'test-shop',
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              quantity: 2,
              product: null,
              unavailable: false,
              stockWarning: false,
            },
          ],
          subtotalCents: 2000,
        },
      ],
      totalCents: 2000,
      totalItems: 2,
    })

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('2')
    })
    expect(mockGetCart).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('error').textContent).toBe('no-error')
  })

  it('handles null cart gracefully', async () => {
    mockGetCart.mockResolvedValue(null)

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('0')
    })
    expect(screen.getByTestId('error').textContent).toBe('no-error')
  })

  it('exposes error when fetch fails', async () => {
    mockGetCart.mockRejectedValue(new Error('network down'))

    render(
      <CartProvider>
        <TestConsumer />
      </CartProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('network down')
    })
    expect(screen.getByTestId('items').textContent).toBe('0')
  })

  it('refreshCart re-fetches and updates state', async () => {
    mockGetCart
      .mockResolvedValueOnce({
        id: 'cart-1',
        userId: null,
        sessionId: 'sess-1',
        expiresAt: null,
        shops: [],
        totalCents: 0,
        totalItems: 0,
      })
      .mockResolvedValueOnce({
        id: 'cart-1',
        userId: null,
        sessionId: 'sess-1',
        expiresAt: null,
        shops: [
          {
            shopId: 'shop-1',
            shopName: 'Test Shop',
            shopSlug: 'test-shop',
            items: [
              {
                id: 'item-1',
                productId: 'prod-1',
                quantity: 1,
                product: null,
                unavailable: false,
                stockWarning: false,
              },
            ],
            subtotalCents: 1000,
          },
        ],
        totalCents: 1000,
        totalItems: 1,
      })

    function RefreshTrigger() {
      const { refreshCart } = useCart()
      return (
        <button type='button' data-testid='refresh' onClick={() => void refreshCart()}>
          Refresh
        </button>
      )
    }

    render(
      <CartProvider>
        <TestConsumer />
        <RefreshTrigger />
      </CartProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('0')
    })

    await act(async () => {
      screen.getByTestId('refresh').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('1')
    })
    expect(mockGetCart).toHaveBeenCalledTimes(2)
  })
})
