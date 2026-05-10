// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CartPage from './CartPage'

const mockRefreshCart = vi.fn()
const mockUpdateCartItem = vi.hoisted(() => vi.fn())
const mockRemoveCartItem = vi.hoisted(() => vi.fn())

vi.mock('#/components/CartProvider', () => ({
  useCart: () => ({
    cart: null,
    isLoading: false,
    error: null,
    refreshCart: mockRefreshCart,
  }),
}))

vi.mock('#/lib/cart', () => ({
  updateCartItem: mockUpdateCartItem,
  removeCartItem: mockRemoveCartItem,
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    cart_title: () => 'Your cart',
    cart_empty_title: () => 'Your cart is empty',
    cart_empty_description: () => "Looks like you haven't added anything to your cart yet.",
    cart_empty_browse: () => 'Browse products',
    cart_shop_subtotal: () => 'Subtotal',
    cart_item_unavailable: () => 'Unavailable',
    cart_item_stock_warning: (inputs: { count: string }) => `Only ${inputs.count} in stock`,
    cart_item_remove: () => 'Remove item from cart',
    cart_item_remove_confirm_title: () => 'Remove item',
    cart_item_remove_confirm_description: () =>
      'Are you sure you want to remove this item from your cart?',
    cart_item_remove_confirm_button: () => 'Confirm Remove',
    cart_item_remove_cancel_button: () => 'Cancel',
    cart_checkout_disabled_unavailable: () => 'Unavailable items prevent checkout',
    cart_proceed_to_checkout: () => 'Proceed to checkout',
    cart_total: () => 'Total',
    cart_items_count: (inputs: { count: string }) => `${inputs.count} items`,
    cart_item_single: () => '1 item',
    cart_quantity_label: () => 'Quantity',
    cart_shop_checkout_disabled: () => 'Checkout unavailable — this shop has unavailable items',
    cart_error_updating: () => 'Failed to update quantity',
    cart_error_removing: () => 'Failed to remove item',
    product_no_image: () => 'No image available',
    product_decrease_quantity: () => 'Decrease quantity',
    product_increase_quantity: () => 'Increase quantity',
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
  }) => (
    <a
      href={props.to}
      className={props.className}
    >
      {props.children}
    </a>
  ),
}))

vi.mock('./ui/primitives/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid='dialog'>{children}</div> : null,
  DialogBackdrop: () => <div data-testid='dialog-backdrop' />,
  DialogPopup: ({ children }: { children: React.ReactNode }) => <div role='dialog'>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogClose: ({ children }: { children: React.ReactNode }) => children,
  DialogPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeCart(overrides?: Partial<Parameters<typeof CartPage>[0]['cart']>) {
  return {
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
            product: {
              id: 'prod-1',
              name: 'Vase',
              slug: 'vase',
              priceCents: 1000,
              stockCount: 10,
              imageUrl: 'http://example.com/vase.jpg',
            },
            unavailable: false,
            stockWarning: false,
          },
        ],
        subtotalCents: 2000,
      },
    ],
    totalCents: 2000,
    totalItems: 2,
    ...overrides,
  }
}

describe('CartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateCartItem.mockResolvedValue({})
    mockRemoveCartItem.mockResolvedValue({ success: true })
  })

  it('renders empty cart state', () => {
    render(<CartPage cart={null} />)
    expect(screen.getByText('Your cart is empty')).toBeDefined()
    expect(screen.getByText("Looks like you haven't added anything to your cart yet.")).toBeDefined()
    expect(screen.getByRole('link', { name: 'Browse products' })).toBeDefined()
  })

  it('renders empty cart state when shops array is empty', () => {
    render(<CartPage cart={makeCart({ shops: [], totalItems: 0, totalCents: 0 })} />)
    expect(screen.getByText('Your cart is empty')).toBeDefined()
  })

  it('renders cart title with item count', () => {
    render(<CartPage cart={makeCart()} />)
    expect(screen.getByText('Your cart')).toBeDefined()
    expect(screen.getByText('2 items')).toBeDefined()
  })

  it('renders single item count', () => {
    render(<CartPage cart={makeCart({ totalItems: 1 })} />)
    expect(screen.getByText('1 item')).toBeDefined()
  })

  it('renders shop name and subtotal', () => {
    render(<CartPage cart={makeCart()} />)
    expect(screen.getByRole('heading', { name: 'Test Shop' })).toBeDefined()
    expect(screen.getByText('Subtotal')).toBeDefined()
  })

  it('renders product details', () => {
    render(<CartPage cart={makeCart()} />)
    expect(screen.getByText('Vase')).toBeDefined()
    expect(screen.getByText('€10,00')).toBeDefined()
  })

  it('renders product image', () => {
    render(<CartPage cart={makeCart()} />)
    const img = screen.getByAltText('Vase')
    expect(img).toBeDefined()
    expect(img.getAttribute('src')).toBe('http://example.com/vase.jpg')
  })

  it('renders quantity controls', () => {
    render(<CartPage cart={makeCart()} />)
    expect(screen.getByLabelText('Decrease quantity')).toBeDefined()
    expect(screen.getByLabelText('Increase quantity')).toBeDefined()
  })

  it('disables decrease quantity when quantity is 1', () => {
    const cart = makeCart()
    cart.shops[0].items[0].quantity = 1
    render(<CartPage cart={cart} />)
    expect(screen.getByLabelText('Decrease quantity').hasAttribute('disabled')).toBe(true)
  })

  it('disables increase quantity when at stock limit', () => {
    const cart = makeCart()
    cart.shops[0].items[0].quantity = 10
    cart.shops[0].items[0].product!.stockCount = 10
    render(<CartPage cart={cart} />)
    expect(screen.getByLabelText('Increase quantity').hasAttribute('disabled')).toBe(true)
  })

  it('calls updateCartItem when increasing quantity', async () => {
    render(<CartPage cart={makeCart()} />)
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    await waitFor(() => {
      expect(mockUpdateCartItem).toHaveBeenCalledWith({ data: { productId: 'prod-1', quantity: 3 } })
    })
  })

  it('calls updateCartItem when decreasing quantity', async () => {
    render(<CartPage cart={makeCart()} />)
    fireEvent.click(screen.getByLabelText('Decrease quantity'))
    await waitFor(() => {
      expect(mockUpdateCartItem).toHaveBeenCalledWith({ data: { productId: 'prod-1', quantity: 1 } })
    })
  })

  it('shows remove confirmation dialog', async () => {
    render(<CartPage cart={makeCart()} />)
    const removeButton = screen.getByLabelText('Remove item from cart')
    fireEvent.click(removeButton)
    await waitFor(() => {
      expect(screen.getByText('Remove item')).toBeDefined()
      expect(screen.getByText('Are you sure you want to remove this item from your cart?')).toBeDefined()
    })
  })

  it('calls removeCartItem after confirmation', async () => {
    render(<CartPage cart={makeCart()} />)
    fireEvent.click(screen.getByLabelText('Remove item from cart'))
    await waitFor(() => {
      expect(screen.getByText('Remove item')).toBeDefined()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Remove' }))
    await waitFor(() => {
      expect(mockRemoveCartItem).toHaveBeenCalledWith({ data: { productId: 'prod-1' } })
    })
  })

  it('renders unavailable item without quantity controls', () => {
    const cart = makeCart()
    cart.shops[0].items[0].unavailable = true
    cart.shops[0].items[0].product = null
    render(<CartPage cart={cart} />)
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByLabelText('Decrease quantity')).toBeNull()
    expect(screen.queryByLabelText('Increase quantity')).toBeNull()
  })

  it('renders stock warning badge', () => {
    const cart = makeCart()
    cart.shops[0].items[0].stockWarning = true
    cart.shops[0].items[0].product!.stockCount = 1
    render(<CartPage cart={cart} />)
    expect(screen.getByText('Only 1 in stock')).toBeDefined()
  })

  it('disables checkout when unavailable items exist', () => {
    const cart = makeCart()
    cart.shops[0].items[0].unavailable = true
    render(<CartPage cart={cart} />)
    const checkoutBtn = screen.getByRole('button', { name: 'Proceed to checkout' })
    expect(checkoutBtn.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Unavailable items prevent checkout')).toBeDefined()
  })

  it('enables checkout when all items are available', () => {
    render(<CartPage cart={makeCart()} />)
    const checkoutBtn = screen.getByRole('button', { name: 'Proceed to checkout' })
    expect(checkoutBtn.hasAttribute('disabled')).toBe(false)
  })

  it('renders total prominently', () => {
    render(<CartPage cart={makeCart()} />)
    expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(1)
    const totals = screen.getAllByText('€20,00')
    expect(totals.some((el) => el.className.includes('text-xl'))).toBe(true)
  })

  it('renders fallback image when product has no image', () => {
    const cart = makeCart()
    cart.shops[0].items[0].product!.imageUrl = null
    render(<CartPage cart={cart} />)
    expect(screen.getByText('No image available')).toBeDefined()
  })

  it('shows update error message when quantity update fails', async () => {
    mockUpdateCartItem.mockRejectedValue(new Error('fail'))
    render(<CartPage cart={makeCart()} />)
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    await waitFor(() => {
      expect(screen.getByText('Failed to update quantity')).toBeDefined()
    })
  })

  it('shows remove error message when removal fails', async () => {
    mockRemoveCartItem.mockRejectedValue(new Error('fail'))
    render(<CartPage cart={makeCart()} />)
    fireEvent.click(screen.getByLabelText('Remove item from cart'))
    await waitFor(() => {
      expect(screen.getByText('Remove item')).toBeDefined()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Remove' }))
    await waitFor(() => {
      expect(screen.getByText('Failed to remove item')).toBeDefined()
    })
  })

  it('renders multiple shop groups', () => {
    const cart = makeCart({
      shops: [
        {
          shopId: 'shop-1',
          shopName: 'Shop A',
          shopSlug: 'shop-a',
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              quantity: 1,
              product: {
                id: 'prod-1',
                name: 'Vase',
                slug: 'vase',
                priceCents: 1000,
                stockCount: 10,
                imageUrl: null,
              },
              unavailable: false,
              stockWarning: false,
            },
          ],
          subtotalCents: 1000,
        },
        {
          shopId: 'shop-2',
          shopName: 'Shop B',
          shopSlug: 'shop-b',
          items: [
            {
              id: 'item-2',
              productId: 'prod-2',
              quantity: 1,
              product: {
                id: 'prod-2',
                name: 'Bowl',
                slug: 'bowl',
                priceCents: 2000,
                stockCount: 5,
                imageUrl: null,
              },
              unavailable: false,
              stockWarning: false,
            },
          ],
          subtotalCents: 2000,
        },
      ],
      totalCents: 3000,
      totalItems: 2,
    })
    render(<CartPage cart={cart} />)
    expect(screen.getByRole('heading', { name: 'Shop A' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Shop B' })).toBeDefined()
    expect(screen.getByText('Vase')).toBeDefined()
    expect(screen.getByText('Bowl')).toBeDefined()
  })
})
