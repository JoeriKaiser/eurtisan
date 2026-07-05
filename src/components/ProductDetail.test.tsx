// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductDetail as ProductDetailType } from '#/lib/products.server'
import ProductDetail from './ProductDetail'

const mockRefreshCart = vi.fn()
const mockAddToCart = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    [key: string]: unknown
  }) => (
    <a
      href={props.to as string}
      className={props.className}
      aria-label={props['aria-label'] as string}
    >
      {props.children}
    </a>
  ),
}))

vi.mock('#/components/CartProvider', () => ({
  useCart: () => ({ cart: null, isLoading: false, refreshCart: mockRefreshCart }),
}))

vi.mock('#/lib/cart-hooks', () => ({
  useAddToCart: () => ({
    mutateAsync: mockAddToCart,
    isPending: false,
  }),
}))

vi.mock('#/components/ProductReviews', () => ({
  default: ({ productId }: { productId: string }) => (
    <div data-testid='product-reviews' data-product-id={productId} />
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    product_no_image: () => 'No image available',
    product_gallery_label: () => 'Product images',
    product_gallery_image: ({ index, total }: { index: string; total: string }) =>
      `Image ${index} of ${total}`,
    product_uncategorized: () => 'Uncategorized',
    product_out_of_stock: () => 'Out of stock',
    product_in_stock: ({ count }: { count: number }) => `${count} in stock`,
    product_quantity: () => 'Quantity',
    product_decrease_quantity: () => 'Decrease quantity',
    product_increase_quantity: () => 'Increase quantity',
    product_add_to_cart: () => 'Add to cart',
    product_sold_by: () => 'Sold by',
    product_unknown_shop: () => 'Unknown shop',
    product_visit_shop: () => 'Visit shop',
    cart_add_success: () => 'Added to cart',
    cart_add_stock_limit: () => 'Updated to available stock limit',
    cart_add_error: () => 'Could not add to cart. Please try again.',
    cart_add_loading: () => 'Adding...',
    vat_included: () => 'incl. VAT',
    vat_exempt_short: () => 'VAT exempt',
  },
}))

function makeProduct(overrides?: Partial<ProductDetailType>): ProductDetailType {
  return {
    id: 'prod-1',
    name: 'Handmade Vase',
    description: 'A beautiful ceramic vase crafted by artisans.',
    slug: 'handmade-vase',
    priceCents: 2999,
    stockCount: 5,
    isActive: true,
    status: 'published',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    categoryName: 'Pottery',
    categorySlug: 'pottery',
    shopName: 'Artisan Studio',
    shopSlug: 'artisan-studio',
    shopIsVatRegistered: false,
    shopDescription: 'Handcrafted goods from local artisans.',
    categoryId: 'cat-1',
    imageUrl: null,
    images: [
      { id: 'img-1', url: 'http://example.com/1.jpg', altText: 'Front view', sortOrder: 0 },
      { id: 'img-2', url: 'http://example.com/2.jpg', altText: 'Side view', sortOrder: 1 },
    ],
    ...overrides,
  }
}

describe('ProductDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddToCart.mockResolvedValue({ id: 'item-1', productId: 'prod-1', quantity: 1 })
  })

  it('renders product name', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Handmade Vase')
  })

  it('renders price in EUR format', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('€29.99')).toBeDefined()
  })

  it('renders full description', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('A beautiful ceramic vase crafted by artisans.')).toBeDefined()
  })

  it('renders stock count when in stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    expect(screen.getByText('5 in stock')).toBeDefined()
  })

  it('shows out-of-stock message when stock is zero', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 0 })} />)
    const badges = screen.getAllByText('Out of stock')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders image gallery with thumbnails', () => {
    render(<ProductDetail product={makeProduct()} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(2)
  })

  it('switches main image when thumbnail is clicked', () => {
    render(<ProductDetail product={makeProduct()} />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
  })

  it('shows placeholder when no images exist', () => {
    render(<ProductDetail product={makeProduct({ images: [] })} />)
    expect(screen.getByText('No image available')).toBeDefined()
  })

  it('disables add-to-cart button when out of stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 0 })} />)
    const button = screen.getByRole('button', { name: /Out of stock/i })
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('enables add-to-cart button when in stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 3 })} />)
    const button = screen.getByRole('button', { name: /Add to cart/i })
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('increments quantity', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const increase = screen.getByRole('button', { name: /Increase quantity/i })
    fireEvent.click(increase)
    expect(screen.getByDisplayValue('2')).toBeDefined()
  })

  it('decrements quantity', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const increase = screen.getByRole('button', { name: /Increase quantity/i })
    const decrease = screen.getByRole('button', { name: /Decrease quantity/i })
    fireEvent.click(increase)
    fireEvent.click(decrease)
    expect(screen.getByDisplayValue('1')).toBeDefined()
  })

  it('disables quantity buttons when out of stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 0 })} />)
    const increase = screen.getByRole('button', { name: /Increase quantity/i })
    const decrease = screen.getByRole('button', { name: /Decrease quantity/i })
    expect(increase.hasAttribute('disabled')).toBe(true)
    expect(decrease.hasAttribute('disabled')).toBe(true)
  })

  it('renders a number quantity input for accessibility', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    expect(input.tagName.toLowerCase()).toBe('input')
    expect(input.type).toBe('number')
  })

  it('updates quantity when typing a valid number', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 10 })} />)
    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    fireEvent.change(input, { target: { value: '4' } })
    expect(input.value).toBe('4')
  })

  it('clamps quantity to stock count when typing a larger number', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12' } })
    expect(input.value).toBe('5')
  })

  it('resets quantity to one when input is cleared', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('1')
  })

  it('renders shop name and description', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('Artisan Studio')).toBeDefined()
    expect(screen.getByText('Handcrafted goods from local artisans.')).toBeDefined()
  })

  it('renders category name', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('Pottery')).toBeDefined()
  })

  it('renders uncategorized when category is null', () => {
    render(<ProductDetail product={makeProduct({ categoryName: null })} />)
    expect(screen.getByText('Uncategorized')).toBeDefined()
  })

  it('renders ProductReviews with product id', () => {
    render(<ProductDetail product={makeProduct()} />)
    const reviews = screen.getByTestId('product-reviews')
    expect(reviews.getAttribute('data-product-id')).toBe('prod-1')
  })

  it('has keyboard-accessible thumbnail buttons', () => {
    render(<ProductDetail product={makeProduct()} />)
    const tabs = screen.getAllByRole('tab')
    for (const tab of tabs) {
      expect(tab.tagName.toLowerCase()).toBe('button')
    }
  })

  it('shows "incl. VAT" when shop is VAT registered', () => {
    render(<ProductDetail product={makeProduct({ shopIsVatRegistered: true })} />)
    expect(screen.getByText('incl. VAT')).toBeDefined()
  })

  it('shows "VAT exempt" when shop is not VAT registered', () => {
    render(<ProductDetail product={makeProduct({ shopIsVatRegistered: false })} />)
    expect(screen.getByText('VAT exempt')).toBeDefined()
  })

  it('calls addToCart and shows success message on submit', async () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const button = screen.getByRole('button', { name: /Add to cart/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Added to cart')).toBeDefined()
    })
    expect(mockAddToCart).toHaveBeenCalledWith({
      productId: 'prod-1',
      quantity: 1,
    })
  })

  it('shows stock limit message when quantity is capped', async () => {
    mockAddToCart.mockResolvedValue({ id: 'item-1', productId: 'prod-1', quantity: 3 })
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const increase = screen.getByRole('button', { name: /Increase quantity/i })
    fireEvent.click(increase)
    fireEvent.click(increase)
    fireEvent.click(increase)
    fireEvent.click(increase)
    // quantity is now 5, but server caps at 3
    const button = screen.getByRole('button', { name: /Add to cart/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Updated to available stock limit')).toBeDefined()
    })
  })

  it('shows error message when addToCart fails', async () => {
    mockAddToCart.mockRejectedValue(new Error('fail'))
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const button = screen.getByRole('button', { name: /Add to cart/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Could not add to cart. Please try again.')).toBeDefined()
    })
  })

  it('disables add-to-cart button while adding', async () => {
    let resolve: (value: unknown) => void = () => {}
    mockAddToCart.mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res
        }),
    )
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const button = screen.getByRole('button', { name: /Add to cart/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Adding...')).toBeDefined()
    })
    expect(button.hasAttribute('disabled')).toBe(true)

    resolve({ id: 'item-1', productId: 'prod-1', quantity: 1 })
  })
})
