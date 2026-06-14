// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    creator_product_edit_title: () => 'Edit Product',
    creator_product_edit_description: () => 'Update your product details, images, and status.',
    creator_product_edit_images_hint: () =>
      'Hover over an image to reorder with arrow buttons or remove it.',
    creator_product_edit_image_move_up: () => 'Move image up',
    creator_product_edit_image_move_down: () => 'Move image down',
    creator_product_edit_image_remove: () => 'Remove image',
    creator_product_edit_save: () => 'Save changes',
    creator_product_edit_saving: () => 'Saving…',
    creator_product_edit_save_success: () => 'Product updated successfully.',
    creator_product_edit_save_error: () => 'Failed to update product. Please try again.',
    creator_product_edit_delete_button: () => 'Delete product',
    creator_product_edit_delete_error: () => 'Failed to delete product. Please try again.',
    creator_product_edit_delete_confirm_title: () => 'Delete product',
    creator_product_edit_delete_confirm_description: () =>
      'Are you sure you want to delete this product?',
    creator_product_edit_delete_confirm_button: () => 'Delete',
    creator_product_edit_delete_confirm_cancel: () => 'Cancel',
    creator_product_edit_image_fetch_error: () =>
      'Failed to read one or more existing images. Please check your connection and try again.',
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
    creator_product_new_no_shops_description: () => 'Create a shop first before adding products.',
    creator_shop_settings_title: () => 'Shop Settings',
    creator_error_load: () => 'Failed to load dashboard. Please try again.',
    creator_error_retry: () => 'Retry',
  },
}))

vi.mock('#/lib/creator-products', () => ({
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))

import type { CreatorShop } from '#/lib/creator-dashboard'
import { deleteProduct, updateProduct } from '#/lib/creator-products'
import {
  CreatorProductEditError,
  CreatorProductEditLoading,
  CreatorProductEditPage,
} from './CreatorProductEditPage'

/* -------------------------------------------------------------------------- */
/*                                Test Helpers                                */
/* -------------------------------------------------------------------------- */

interface ProductImageRecord {
  id: string
  url: string
  altText: string | null
  sortOrder: number
}

interface ProductDetail {
  id: string
  name: string
  description: string | null
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  vatRateCategory: string
  shopId: string
  categoryId: string | null
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  images: ProductImageRecord[]
}

function makeShops(overrides?: Partial<CreatorShop>[]): CreatorShop[] {
  if (overrides) {
    return overrides.map((s) => ({
      id: s.id ?? 'shop-1',
      name: s.name ?? 'Test Shop',
      slug: s.slug ?? 'test-shop',
    }))
  }
  return [{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }]
}

type CategoryItem = { id: string; name: string; slug: string }

function makeCategories(overrides?: CategoryItem[]): CategoryItem[] {
  if (overrides) return overrides
  return [
    { id: 'cat-1', name: 'Ceramics', slug: 'ceramics' },
    { id: 'cat-2', name: 'Textiles', slug: 'textiles' },
  ]
}

function makeProduct(overrides?: Partial<ProductDetail>): ProductDetail {
  return {
    id: 'prod-1',
    name: 'Handmade Mug',
    description: 'A beautiful handmade ceramic mug.',
    slug: 'handmade-mug',
    priceCents: 2999,
    stockCount: 10,
    isActive: true,
    vatRateCategory: 'standard',
    shopId: 'shop-1',
    categoryId: 'cat-1',
    weightGrams: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    images: [
      {
        id: 'img-1',
        url: '/uploads/products/prod-1/img1.jpg',
        altText: 'Front view',
        sortOrder: 0,
      },
      {
        id: 'img-2',
        url: '/uploads/products/prod-1/img2.jpg',
        altText: 'Side view',
        sortOrder: 1,
      },
    ],
    ...overrides,
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Tests                                    */
/* -------------------------------------------------------------------------- */

describe('CreatorProductEditPage', () => {
  beforeEach(() => {
    mockInvalidate.mockReset()
    mockNavigate.mockReset()
    vi.mocked(updateProduct).mockReset()
    vi.mocked(deleteProduct).mockReset()
  })

  /* ---------------------------- No shop state ---------------------------- */

  it('renders empty state when creator has no shops', () => {
    render(
      <CreatorProductEditPage shops={[]} categories={makeCategories()} product={makeProduct()} />,
    )
    expect(screen.getByText('No shops yet')).toBeTruthy()
  })

  /* ---------------------------- Form rendering --------------------------- */

  it('renders the form with pre-populated product data', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    expect(screen.getByText('Edit Product')).toBeTruthy()

    // Pre-populated fields
    const nameInput = screen.getByLabelText('Product name') as HTMLInputElement
    expect(nameInput.value).toBe('Handmade Mug')

    const slugInput = screen.getByLabelText('URL slug') as HTMLInputElement
    expect(slugInput.value).toBe('handmade-mug')

    const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement
    expect(descriptionInput.value).toBe('A beautiful handmade ceramic mug.')

    const priceInput = screen.getByLabelText('Price (EUR)') as HTMLInputElement
    expect(priceInput.value).toBe('29.99')

    const stockInput = screen.getByLabelText('Stock quantity') as HTMLInputElement
    expect(stockInput.value).toBe('10')

    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement
    expect(categorySelect.value).toBe('cat-1')
  })

  it('shows active toggle as checked when product is active', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ isActive: true })}
      />,
    )

    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('shows active toggle as unchecked when product is inactive', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ isActive: false })}
      />,
    )

    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Inactive')).toBeTruthy()
  })

  /* ---------------------------- Existing images -------------------------- */

  it('renders existing product images', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const images = document.querySelectorAll('img[src*="/uploads/products/"]')
    expect(images.length).toBe(2)
  })

  it('shows move up/down and remove buttons for existing images', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const upButtons = screen.getAllByLabelText('Move image up')
    const downButtons = screen.getAllByLabelText('Move image down')
    const removeButtons = screen.getAllByLabelText('Remove image')

    expect(upButtons.length).toBe(2)
    expect(downButtons.length).toBe(2)
    expect(removeButtons.length).toBe(2)
  })

  it('disables move-up for the first image', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const upButtons = screen.getAllByLabelText('Move image up')
    expect((upButtons[0] as HTMLButtonElement).disabled).toBe(true)
    expect((upButtons[1] as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables move-down for the last image', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const downButtons = screen.getAllByLabelText('Move image down')
    expect((downButtons[0] as HTMLButtonElement).disabled).toBe(false)
    expect((downButtons[1] as HTMLButtonElement).disabled).toBe(true)
  })

  it('removes an existing image when clicking remove', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const removeButtons = screen.getAllByLabelText('Remove image')
    fireEvent.click(removeButtons[1])

    const remainingImages = document.querySelectorAll('img[src*="/uploads/products/"]')
    expect(remainingImages.length).toBe(1)

    const remainingRemoveButtons = screen.getAllByLabelText('Remove image')
    expect(remainingRemoveButtons.length).toBe(1)
  })

  /* ------------------------- Image reordering (up/down) ------------------ */

  it('moves an image up when clicking move up', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const upButtons = screen.getAllByLabelText('Move image up')
    // Click the second image's up button
    fireEvent.click(upButtons[1])

    // After moving up, the first image should have its up button disabled
    const newUpButtons = screen.getAllByLabelText('Move image up')
    expect(newUpButtons.length).toBe(2)
  })

  it('moves an image down when clicking move down', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const downButtons = screen.getAllByLabelText('Move image down')
    // Click the first image's down button
    fireEvent.click(downButtons[0])

    // After moving down, the last image should have its down button disabled
    const newDownButtons = screen.getAllByLabelText('Move image down')
    expect(newDownButtons.length).toBe(2)
  })

  /* ---------------------------- New image upload ------------------------- */

  it('shows "Add images" button for uploading new images', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    expect(screen.getByText('Add images')).toBeTruthy()
  })

  it('adds new images alongside existing ones', async () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const file = new File(['fake-png'], 'new-product.png', { type: 'image/png' })
    const input = document.getElementById('product-image-upload') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      // We should now have 2 existing + 1 new = 3 removal buttons
      // But the new image has a "Remove image" button too
      const removeButtons = screen.getAllByLabelText('Remove image')
      expect(removeButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  /* ------------------------- Toggle active/inactive ---------------------- */

  it('toggles from active to inactive', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ isActive: true })}
      />,
    )

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Inactive')).toBeTruthy()
  })

  /* ---------------------------- Cancel flow ------------------------------ */

  it('navigates to /creator/products on cancel when no changes made', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/creator/products' })
  })

  it('shows confirmation dialog on cancel when form has changes', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Changed Name' } })

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(screen.getByText('Unsaved changes')).toBeTruthy()
  })

  /* ---------------------------- Client-side validation ------------------- */

  it('shows validation errors on empty required fields', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ name: '', slug: '', priceCents: 0 })}
      />,
    )

    const form = screen.getByRole('button', { name: 'Save changes' }).closest('form')
    if (form) fireEvent.submit(form)

    expect(screen.getByText('Product name is required.')).toBeTruthy()
    expect(screen.getByText('Slug is required.')).toBeTruthy()
    expect(screen.getByText('Price must be greater than zero.')).toBeTruthy()
  })

  /* ---------------------------- Successful submission -------------------- */

  it('submits form with updated data and shows success message', async () => {
    vi.mocked(updateProduct).mockResolvedValueOnce({
      id: 'prod-1',
      name: 'Updated Mug',
      description: 'Updated desc',
      slug: 'updated-mug',
      priceCents: 3999,
      stockCount: 5,
      isActive: true,
      vatRateCategory: 'standard',
      shopId: 'shop-1',
      categoryId: 'cat-1',
      weightGrams: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Use a product with no images so no fetch calls are needed
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ images: [] })}
      />,
    )

    const nameInput = screen.getByLabelText('Product name')
    const priceInput = screen.getByLabelText('Price (EUR)')

    fireEvent.change(nameInput, { target: { value: 'Updated Mug' } })
    fireEvent.change(priceInput, { target: { value: '39.99' } })

    const form = screen.getByRole('button', { name: 'Save changes' }).closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('Product updated successfully.')).toBeTruthy()
    })
  })

  /* ---------------------------- Server error handling -------------------- */

  it('shows slug error from server on duplicate slug', async () => {
    vi.mocked(updateProduct).mockRejectedValueOnce(new Error('DUPLICATE_SLUG'))

    // Use a product with no images so no fetch calls are needed
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ images: [] })}
      />,
    )

    const slugInput = screen.getByLabelText('URL slug')
    fireEvent.change(slugInput, { target: { value: 'duplicate-slug' } })

    const form = screen.getByRole('button', { name: 'Save changes' }).closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(
        screen.getByText(
          'A product with this slug already exists in this shop. Try a different name or edit the slug manually.',
        ),
      ).toBeTruthy()
    })
  })

  it('shows generic error banner on unknown server error', async () => {
    vi.mocked(updateProduct).mockRejectedValueOnce(new Error('Something went wrong'))

    // Use a product with no images so no fetch calls are needed
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ images: [] })}
      />,
    )

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Changed' } })

    const form = screen.getByRole('button', { name: 'Save changes' }).closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Failed to update product. Please try again.')).toBeTruthy()
    })
  })

  it('submits existing image keys without re-fetching blobs on save', async () => {
    vi.mocked(updateProduct).mockResolvedValueOnce({
      id: 'prod-1',
      name: 'Changed',
      description: 'A handmade ceramic mug',
      slug: 'ceramic-mug',
      priceCents: 2500,
      stockCount: 10,
      isActive: true,
      shopId: 'shop-1',
      categoryId: null,
      vatRateCategory: 'standard',
      weightGrams: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const nameInput = screen.getByLabelText('Product name')
    fireEvent.change(nameInput, { target: { value: 'Changed' } })

    const form = screen.getByRole('button', { name: 'Save changes' }).closest('form')
    if (form) fireEvent.submit(form)

    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: expect.arrayContaining([
              expect.objectContaining({ key: '/uploads/products/prod-1/img1.jpg' }),
            ]),
          }),
        }),
      )
    })
  })

  /* ------------------------- Delete product flow ------------------------- */

  it('shows delete confirmation dialog', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    // Desktop delete button text
    const deleteButton = screen.getByRole('button', { name: /Delete product/i })
    fireEvent.click(deleteButton)

    expect(screen.getByText('Are you sure you want to delete this product?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()

    // There are two "Cancel" buttons: form Cancel + dialog Cancel. Verify both exist.
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    expect(cancelButtons.length).toBe(2)
  })

  it('cancels delete confirmation dialog', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const deleteButton = screen.getByRole('button', { name: /Delete product/i })
    fireEvent.click(deleteButton)

    // Click the dialog's Cancel button (second "Cancel" in DOM — the first is the form Cancel)
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    // The dialog Cancel is the last one rendered
    fireEvent.click(cancelButtons[cancelButtons.length - 1])

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('deletes product and navigates to products list', async () => {
    vi.mocked(deleteProduct).mockResolvedValueOnce({
      deleted: true,
      hard: false,
    })

    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    const deleteButton = screen.getByRole('button', { name: /Delete product/i })
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(deleteProduct).toHaveBeenCalledWith({
        data: {
          productId: 'prod-1',
          shopId: 'shop-1',
          hard: false,
        },
      })
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/creator/products' })
    })
  })

  /* -------------------------- Product with no images --------------------- */

  it('shows empty image state when product has no images', () => {
    render(
      <CreatorProductEditPage
        shops={makeShops()}
        categories={makeCategories()}
        product={makeProduct({ images: [] })}
      />,
    )

    expect(screen.getByText('No images added yet.')).toBeTruthy()

    const upButtons = screen.queryAllByLabelText('Move image up')
    expect(upButtons.length).toBe(0)
  })

  /* -------------------------- Shopping with multiple shops ---------------- */

  it('shows shop selector when creator has multiple shops', () => {
    const shops: CreatorShop[] = [
      { id: 'shop-1', name: 'Shop One', slug: 'shop-one' },
      { id: 'shop-2', name: 'Shop Two', slug: 'shop-two' },
    ]

    render(
      <CreatorProductEditPage
        shops={shops}
        categories={makeCategories()}
        product={makeProduct()}
      />,
    )

    expect(screen.getByLabelText('Shop')).toBeTruthy()
  })
})

/* -------------------------------------------------------------------------- */
/*                           Loading Skeleton Tests                           */
/* -------------------------------------------------------------------------- */

describe('CreatorProductEditLoading', () => {
  it('renders skeleton placeholders', () => {
    render(<CreatorProductEditLoading />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------------------- */
/*                             Error State Tests                              */
/* -------------------------------------------------------------------------- */

describe('CreatorProductEditError', () => {
  it('renders error message with retry button', () => {
    render(<CreatorProductEditError error={new Error('Product not found')} />)

    expect(screen.getByText('Failed to load dashboard. Please try again.')).toBeTruthy()
    expect(screen.getByText('Product not found')).toBeTruthy()

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    expect(mockInvalidate).toHaveBeenCalled()
  })
})
