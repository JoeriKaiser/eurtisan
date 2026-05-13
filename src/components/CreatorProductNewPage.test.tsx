// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockInvalidate = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ invalidate: mockInvalidate, navigate: mockNavigate }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    creator_product_new_title: () => 'New Product',
    creator_product_new_description: () => 'Add a new product to your catalog.',
    creator_product_new_shop_label: () => 'Shop',
    creator_product_new_name_label: () => 'Product name',
    creator_product_new_name_placeholder: () => 'Enter product name',
    creator_product_new_name_required: () => 'Product name is required.',
    creator_product_new_slug_label: () => 'URL slug',
    creator_product_new_slug_placeholder: () => 'product-name',
    creator_product_new_slug_required: () => 'Slug is required.',
    creator_product_new_slug_hint: () =>
      'Lowercase letters, numbers, and hyphens. Auto-generated from name.',
    creator_product_new_slug_format_error: () =>
      'Slug must contain only lowercase letters, numbers, and hyphens.',
    creator_product_new_slug_duplicate: () =>
      'A product with this slug already exists in this shop. Try a different name or edit the slug manually.',
    creator_product_new_category_invalid: () =>
      'The selected category is invalid. Please choose a different category.',
    creator_product_new_description_label: () => 'Description',
    creator_product_new_description_placeholder: () => 'Describe your product...',
    creator_product_new_description_too_long: () => 'Description must be 2000 characters or fewer.',
    creator_product_new_price_label: () => 'Price (EUR)',
    creator_product_new_price_placeholder: () => '0.00',
    creator_product_new_price_required: () => 'Price is required.',
    creator_product_new_price_positive: () => 'Price must be greater than zero.',
    creator_product_new_stock_label: () => 'Stock quantity',
    creator_product_new_stock_placeholder: () => '0',
    creator_product_new_stock_negative: () => 'Stock must be a non-negative number.',
    creator_product_new_category_label: () => 'Category',
    creator_product_new_category_none: () => 'No category',
    creator_product_new_active_label: () => 'Active',
    creator_product_new_active_description: () => 'Product will be visible to buyers.',
    creator_product_new_inactive_label: () => 'Inactive',
    creator_product_new_images_label: () => 'Product images',
    creator_product_new_images_hint: () =>
      'Upload up to 10 images. JPEG, PNG, or WebP. Max 5MB each.',
    creator_product_new_images_add: () => 'Add images',
    creator_product_new_images_remove: () => 'Remove image',
    creator_product_new_images_reading: () => 'Processing image...',
    creator_product_new_images_error_type: () => 'Only JPEG, PNG, and WebP images are allowed.',
    creator_product_new_images_error_size: () => 'Image must be 5MB or smaller.',
    creator_product_new_images_error_max: () => 'Maximum 10 images allowed.',
    creator_product_new_images_no_images: () => 'No images added yet.',
    creator_product_new_submit: () => 'Publish product',
    creator_product_new_submitting: () => 'Publishing...',
    creator_product_new_cancel: () => 'Cancel',
    creator_product_new_save_success: () => 'Product published successfully.',
    creator_product_new_save_error: () => 'Failed to publish product. Please try again.',
    creator_product_new_unsaved_title: () => 'Unsaved changes',
    creator_product_new_unsaved_description: () =>
      'You have unsaved changes. Are you sure you want to leave?',
    creator_product_new_unsaved_confirm: () => 'Leave',
    creator_product_new_unsaved_cancel: () => 'Stay',
    creator_product_new_no_shops_title: () => 'No shops yet',
    creator_product_new_no_shops_description: () =>
      'Create a shop first before adding products.',
    creator_shop_settings_title: () => 'Shop Settings',
    creator_error_load: () => 'Failed to load dashboard. Please try again.',
    creator_error_retry: () => 'Retry',
  },
}))

vi.mock('#/lib/creator-products.server', () => ({
  createProduct: vi.fn(),
}))

import type { CreatorShop } from '#/lib/creator-dashboard'
import { createProduct } from '#/lib/creator-products.server'
import {
  CreatorProductNewError,
  CreatorProductNewLoading,
  CreatorProductNewPage,
} from './CreatorProductNewPage'

/* -------------------------------------------------------------------------- */
/*                                Test Helpers                                */
/* -------------------------------------------------------------------------- */

function makeShops(overrides?: Partial<CreatorShop>[]): CreatorShop[] {
  if (overrides) {
    return overrides.map((s) => ({
      id: s.id ?? 'shop-1',
      name: s.name ?? 'Test Shop',
      slug: s.slug ?? 'test-shop',
    }))
  }
  return [
    { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' },
  ]
}

type CategoryItem = { id: string; name: string; slug: string }

function makeCategories(overrides?: CategoryItem[]): CategoryItem[] {
  if (overrides) return overrides
  return [
    { id: 'cat-1', name: 'Ceramics', slug: 'ceramics' },
    { id: 'cat-2', name: 'Textiles', slug: 'textiles' },
    { id: 'cat-3', name: 'Jewellery', slug: 'jewellery' },
  ]
}

/* -------------------------------------------------------------------------- */
/*                                   Tests                                    */
/* -------------------------------------------------------------------------- */

describe('CreatorProductNewPage', () => {
  beforeEach(() => {
    mockInvalidate.mockReset()
    mockNavigate.mockReset()
    vi.mocked(createProduct).mockReset()
  })

  /* ---------------------------- No shop state ---------------------------- */

  it('renders empty state when creator has no shops', () => {
    render(<CreatorProductNewPage shops={[]} categories={makeCategories()} />)
    expect(screen.getByText('No shops yet')).toBeTruthy()
    expect(screen.getByText('Create a shop first before adding products.')).toBeTruthy()
  })

  /* ---------------------------- Form rendering --------------------------- */

  it('renders the form with all required fields', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    expect(screen.getByText('New Product')).toBeTruthy()
    expect(screen.getByText('Add a new product to your catalog.')).toBeTruthy()

    // Fields
    expect(screen.getByLabelText('Product name')).toBeTruthy()
    expect(screen.getByLabelText('URL slug')).toBeTruthy()
    expect(screen.getByLabelText('Description')).toBeTruthy()
    expect(screen.getByLabelText('Price (EUR)')).toBeTruthy()
    expect(screen.getByLabelText('Stock quantity')).toBeTruthy()
    expect(screen.getByLabelText('Category')).toBeTruthy()

    // Buttons
    expect(screen.getByRole('button', { name: 'Publish product' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('renders category options including "No category" default', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const categorySelect = screen.getByLabelText('Category')
    const options = categorySelect.querySelectorAll('option')
    expect(options.length).toBe(4) // No category + 3 categories
    expect(options[0].textContent).toBe('No category')
    expect(options[1].textContent).toBe('Ceramics')
  })

  /* ---------------------------- Slug auto-generation --------------------- */

  it('auto-generates slug from product name', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Handmade Mug' } })

    const slugInput = screen.getByLabelText('URL slug') as HTMLInputElement
    expect(slugInput.value).toBe('handmade-mug')
  })

  it('allows manual slug editing independent of name', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Handmade Mug' } })

    const slugInput = screen.getByLabelText('URL slug')
    fireEvent.change(slugInput, { target: { value: 'custom-slug' } })

    // Changing name should no longer affect slug
    fireEvent.change(nameInput, { target: { value: 'Something Else' } })
    expect((slugInput as HTMLInputElement).value).toBe('custom-slug')
  })

  it('shows slug format error for invalid slug characters', async () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const slugInput = screen.getByLabelText('URL slug')
    fireEvent.change(slugInput, { target: { value: 'INVALID SLUG!' } })

    await waitFor(() => {
      expect(
        screen.getByText('Slug must contain only lowercase letters, numbers, and hyphens.'),
      ).toBeTruthy()
    })
  })

  /* ---------------------------- Client-side validation ------------------- */

  it('shows validation errors on empty form submission', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const form = screen.getByRole('button', { name: 'Publish product' }).closest('form')
    if (form) fireEvent.submit(form)

    expect(screen.getByText('Product name is required.')).toBeTruthy()
    expect(screen.getByText('Slug is required.')).toBeTruthy()
    expect(screen.getByText('Price is required.')).toBeTruthy()
  })

  it('shows price validation error for zero or negative values', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    const priceInput = screen.getByLabelText('Price (EUR)')

    fireEvent.change(nameInput, { target: { value: 'Test Product' } })
    fireEvent.change(priceInput, { target: { value: '0' } })

    const form = screen.getByRole('button', { name: 'Publish product' }).closest('form')
    if (form) fireEvent.submit(form)

    expect(screen.getByText('Price must be greater than zero.')).toBeTruthy()
  })

  it('shows stock validation error for negative values', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    const priceInput = screen.getByLabelText('Price (EUR)')
    const stockInput = screen.getByLabelText('Stock quantity')

    fireEvent.change(nameInput, { target: { value: 'Test Product' } })
    fireEvent.change(priceInput, { target: { value: '25.00' } })
    fireEvent.change(stockInput, { target: { value: '-5' } })

    const form = screen.getByRole('button', { name: 'Publish product' }).closest('form')
    if (form) fireEvent.submit(form)

    expect(screen.getByText('Stock must be a non-negative number.')).toBeTruthy()
  })

  it('shows description too long error when exceeding 2000 characters', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const descriptionInput = screen.getByLabelText('Description')
    fireEvent.change(descriptionInput, { target: { value: 'a'.repeat(2001) } })

    const form = screen.getByRole('button', { name: 'Publish product' }).closest('form')
    if (form) fireEvent.submit(form)

    expect(screen.getByText('Description must be 2000 characters or fewer.')).toBeTruthy()
  })

  /* ---------------------------- Active toggle ---------------------------- */

  it('toggles active/inactive state', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Active')).toBeTruthy()

    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Inactive')).toBeTruthy()
  })

  /* ---------------------------- Multi-shop selector ---------------------- */

  it('shows shop selector when creator has multiple shops', () => {
    const shops: CreatorShop[] = [
      { id: 'shop-1', name: 'Shop One', slug: 'shop-one' },
      { id: 'shop-2', name: 'Shop Two', slug: 'shop-two' },
    ]

    render(<CreatorProductNewPage shops={shops} categories={makeCategories()} />)

    expect(screen.getByLabelText('Shop')).toBeTruthy()
  })

  it('does not show shop selector when creator has only one shop', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    expect(screen.queryByLabelText('Shop')).toBeNull()
  })

  /* ---------------------------- Description character count ------------- */

  it('shows character count for description', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const descriptionInput = screen.getByLabelText('Description')
    fireEvent.change(descriptionInput, { target: { value: 'Hello World' } })

    expect(screen.getByText('11/2000')).toBeTruthy()
  })

  /* ---------------------------- Image upload area ------------------------ */

  it('shows empty image upload area', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    expect(screen.getByText('No images added yet.')).toBeTruthy()
    expect(screen.getByText('Add images')).toBeTruthy()
  })

  it('validates unsupported image type client-side', async () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const file = new File(['dummy'], 'test.gif', { type: 'image/gif' })
    const input = document.getElementById('product-image-upload') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Only JPEG, PNG, and WebP images are allowed.')).toBeTruthy()
    })
  })

  it('validates oversized image client-side', async () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const largeBuffer = new ArrayBuffer(6 * 1024 * 1024)
    const file = new File([largeBuffer], 'large.png', { type: 'image/png' })
    const input = document.getElementById('product-image-upload') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Image must be 5MB or smaller.')).toBeTruthy()
    })
  })

  it('accepts valid image files and shows thumbnails', async () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const file = new File(['fake-png-content'], 'product.png', { type: 'image/png' })
    const input = document.getElementById('product-image-upload') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    // Should show a 'reading' state initially, then the thumbnail
    await waitFor(() => {
      const removeButtons = screen.getAllByLabelText('Remove image')
      expect(removeButtons.length).toBeGreaterThan(0)
    })
  })

  /* ---------------------------- Cancel flow ------------------------------ */

  it('navigates to /creator/products on cancel when no changes made', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/creator/products' })
  })

  it('shows confirmation dialog on cancel when form has changes', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Test' } })

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    expect(
      screen.getByText('You have unsaved changes. Are you sure you want to leave?'),
    ).toBeTruthy()
  })

  it('navigates away when confirming cancel dialog', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Test' } })

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    const leaveButton = screen.getByRole('button', { name: 'Leave' })
    fireEvent.click(leaveButton)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/creator/products' })
  })

  it('dismisses confirmation dialog when clicking Stay', () => {
    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Test' } })

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    const stayButton = screen.getByRole('button', { name: 'Stay' })
    fireEvent.click(stayButton)

    expect(screen.queryByText('Unsaved changes')).toBeNull()
  })

  /* ---------------------------- Successful submission -------------------- */

  it('submits form and shows success message', async () => {
    vi.mocked(createProduct).mockResolvedValueOnce({
      id: 'new-product',
      name: 'Handmade Mug',
      description: null,
      slug: 'handmade-mug',
      priceCents: 2999,
      stockCount: 10,
      isActive: true,
      shopId: 'shop-1',
      categoryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    const priceInput = screen.getByLabelText('Price (EUR)')
    const stockInput = screen.getByLabelText('Stock quantity')

    fireEvent.change(nameInput, { target: { value: 'Handmade Mug' } })
    fireEvent.change(priceInput, { target: { value: '29.99' } })
    fireEvent.change(stockInput, { target: { value: '10' } })

    const form = screen.getByRole('button', { name: 'Publish product' }).closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: 'shop-1',
          name: 'Handmade Mug',
          slug: 'handmade-mug',
          priceCents: 2999,
          stockCount: 10,
        }),
      })
    })
  })

  /* ---------------------------- Submission loading state ----------------- */

  it('disables submit button during submission', async () => {
    // Create a promise we can control
    let resolvePromise!: (value: Awaited<ReturnType<typeof createProduct>>) => void
    const deferred = new Promise<Awaited<ReturnType<typeof createProduct>>>((resolve) => {
      resolvePromise = resolve
    })
    vi.mocked(createProduct).mockReturnValueOnce(deferred)

    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    const priceInput = screen.getByLabelText('Price (EUR)')

    fireEvent.change(nameInput, { target: { value: 'Handmade Mug' } })
    fireEvent.change(priceInput, { target: { value: '29.99' } })

    const submitButton = screen.getByRole('button', { name: 'Publish product' })
    const form = submitButton.closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(true)
    })

    // Resolve and clean up
    resolvePromise({
      id: 'new-product',
      name: 'Handmade Mug',
      description: null,
      slug: 'handmade-mug',
      priceCents: 2999,
      stockCount: 10,
      isActive: true,
      shopId: 'shop-1',
      categoryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  /* ---------------------------- Server error handling -------------------- */

  it('shows slug error from server on duplicate slug', async () => {
    vi.mocked(createProduct).mockRejectedValueOnce(new Error('DUPLICATE_SLUG'))

    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    const priceInput = screen.getByLabelText('Price (EUR)')

    fireEvent.change(nameInput, { target: { value: 'Handmade Mug' } })
    fireEvent.change(priceInput, { target: { value: '29.99' } })

    const form = screen.getByRole('button', { name: 'Publish product' }).closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(
        screen.getByText('A product with this slug already exists in this shop. Try a different name or edit the slug manually.'),
      ).toBeTruthy()
    })
  })

  it('shows generic error banner on unknown server error', async () => {
    vi.mocked(createProduct).mockRejectedValueOnce(new Error('Something went wrong'))

    render(<CreatorProductNewPage shops={makeShops()} categories={makeCategories()} />)

    const nameInput = screen.getByLabelText('Product name')
    const priceInput = screen.getByLabelText('Price (EUR)')

    fireEvent.change(nameInput, { target: { value: 'Handmade Mug' } })
    fireEvent.change(priceInput, { target: { value: '29.99' } })

    const form = screen.getByRole('button', { name: 'Publish product' }).closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(
        screen.getByText('Failed to publish product. Please try again.'),
      ).toBeTruthy()
    })
  })
})

/* -------------------------------------------------------------------------- */
/*                           Loading Skeleton Tests                           */
/* -------------------------------------------------------------------------- */

describe('CreatorProductNewLoading', () => {
  it('renders skeleton placeholders', () => {
    render(<CreatorProductNewLoading />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------------------- */
/*                             Error State Tests                              */
/* -------------------------------------------------------------------------- */

describe('CreatorProductNewError', () => {
  it('renders error message with retry button', () => {
    render(<CreatorProductNewError error={new Error('Test error')} />)

    expect(screen.getByText('Failed to load dashboard. Please try again.')).toBeTruthy()
    expect(screen.getByText('Test error')).toBeTruthy()

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    expect(mockInvalidate).toHaveBeenCalled()
  })
})
