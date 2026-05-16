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
    creator_shop_settings_title: () => 'Shop Settings',
    creator_shop_settings_description: () => "Manage your shop's public information and branding.",
    creator_shop_select_label: () => 'Select shop',
    creator_shop_name_label: () => 'Shop name',
    creator_shop_name_placeholder: () => 'Enter your shop name',
    creator_shop_name_required: () => 'Shop name is required.',
    creator_shop_slug_label: () => 'Shop URL slug',
    creator_shop_slug_placeholder: () => 'my-shop-name',
    creator_shop_slug_required: () => 'Shop slug is required.',
    creator_shop_slug_hint: () =>
      "Lowercase letters, numbers, and hyphens. Used in your shop's URL.",
    creator_shop_slug_format_error: () =>
      'Slug must contain only lowercase letters, numbers, and hyphens.',
    creator_shop_slug_taken_error: () => 'This slug is already in use by another shop.',
    creator_shop_slug_check_error: () => 'Unable to check slug availability. Please try again.',
    creator_shop_slug_checking: () => 'Checking slug availability',
    creator_shop_slug_available: () => 'Slug is available',
    creator_shop_slug_unavailable: () => 'Slug is unavailable',
    creator_shop_description_label: () => 'Description',
    creator_shop_description_placeholder: () => 'Tell visitors about your shop...',
    creator_shop_description_too_long: () => 'Description must be 2000 characters or fewer.',
    creator_shop_image_label: () => 'Shop image',
    creator_shop_image_hint: () =>
      'Upload a banner or logo for your shop. JPEG, PNG, or WebP. Max 5MB.',
    creator_shop_image_upload: () => 'Upload image',
    creator_shop_image_change: () => 'Change image',
    creator_shop_image_remove: () => 'Remove image',
    creator_shop_image_empty: () => 'No image uploaded yet.',
    creator_shop_image_preview_alt: () => 'Shop image preview',
    creator_shop_image_type_error: () => 'Only JPEG, PNG, and WebP images are allowed.',
    creator_shop_image_size_error: () => 'Image must be 5MB or smaller.',
    creator_shop_image_upload_error: () =>
      'Failed to upload image. Please check the file and try again.',
    creator_shop_save: () => 'Save changes',
    creator_shop_saving: () => 'Saving…',
    creator_shop_save_success: () => 'Shop settings saved successfully.',
    creator_shop_save_error: () => 'Failed to save shop settings. Please try again.',
    creator_shop_cancel: () => 'Cancel',
    creator_shop_not_found: () => 'Shop not found',
    creator_shop_not_found_description: () =>
      'The shop you are looking for does not exist or you do not have access to it.',
    creator_no_shops_title: () => 'Welcome, creator!',
    creator_no_shops_description: () => "You don't have any shops yet.",
    creator_error_load: () => 'Failed to load dashboard. Please try again.',
    creator_error_retry: () => 'Retry',
  },
}))

vi.mock('#/lib/shop-settings', () => ({
  updateShop: vi.fn(),
  uploadShopImage: vi.fn(),
  checkShopSlug: vi.fn(),
}))

import {
  CreatorShopSettingsError,
  CreatorShopSettingsLoading,
  CreatorShopSettingsPage,
} from './CreatorShopSettingsPage'

/* -------------------------------------------------------------------------- */
/*                                Test Helpers                                */
/* -------------------------------------------------------------------------- */

function makeShop(overrides?: Record<string, unknown>) {
  return {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    description: 'A description',
    image: null,
    ownerId: 'user-1',
    shippingOrigin: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Tests                                    */
/* -------------------------------------------------------------------------- */

describe('CreatorShopSettingsPage', () => {
  beforeEach(() => {
    mockInvalidate.mockReset()
    mockNavigate.mockReset()
  })

  /* ---------------------------- No shop state ---------------------------- */

  it('renders empty state when creator has no shops', () => {
    render(<CreatorShopSettingsPage shop={null} allShops={[]} />)
    // getByText throws if not found – it's an implicit assertion
    expect(screen.getByText('Welcome, creator!')).toBeTruthy()
    expect(screen.getByText("You don't have any shops yet.")).toBeTruthy()
  })

  /* ---------------------------- Not found state -------------------------- */

  it('renders not-found state when shopId does not match any shop', () => {
    render(
      <CreatorShopSettingsPage shop={null} allShops={[{ id: 'other-shop', name: 'Other Shop' }]} />,
    )
    expect(screen.getByText('Shop not found')).toBeTruthy()
  })

  /* ---------------------------- Form rendering --------------------------- */

  it('renders the form pre-populated with shop data', () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    expect(screen.getByText('Shop Settings')).toBeTruthy()
    expect(screen.getByDisplayValue('Test Shop')).toBeTruthy()
    expect(screen.getByDisplayValue('test-shop')).toBeTruthy()
    expect(screen.getByDisplayValue('A description')).toBeTruthy()
  })

  it('renders the save button as disabled when no changes are made', () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    const saveButton = screen.getByRole('button', { name: 'Save changes' })
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables save button when name is changed', () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    const nameInput = screen.getByDisplayValue('Test Shop')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })

    const saveButton = screen.getByRole('button', { name: 'Save changes' })
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)
  })

  /* ---------------------------- Multi-shop selector ---------------------- */

  it('shows shop selector when creator has multiple shops', () => {
    const shop = makeShop()
    const shops = [
      { id: 'shop-1', name: 'Shop One' },
      { id: 'shop-2', name: 'Shop Two' },
    ]

    render(<CreatorShopSettingsPage shop={shop} allShops={shops} />)

    expect(screen.getByText('Select shop')).toBeTruthy()
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('does not show shop selector when creator has only one shop', () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    expect(screen.queryByText('Select shop')).toBeNull()
  })

  it('navigates to new shop when selector changes', () => {
    const shop = makeShop()
    const shops = [
      { id: 'shop-1', name: 'Shop One' },
      { id: 'shop-2', name: 'Shop Two' },
    ]

    render(<CreatorShopSettingsPage shop={shop} allShops={shops} />)

    const selector = screen.getByRole('combobox')
    fireEvent.change(selector, { target: { value: 'shop-2' } })

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/creator/shop',
      search: { shopId: 'shop-2' },
    })
  })

  /* ---------------------------- Slug input ------------------------------- */

  it('renders slug help text', () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    expect(
      screen.getByText("Lowercase letters, numbers, and hyphens. Used in your shop's URL."),
    ).toBeTruthy()
  })

  /* ---------------------------- Image upload ----------------------------- */

  it('shows empty image upload area when no image exists', () => {
    const shop = makeShop({ image: null })
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    expect(screen.getByText('No image uploaded yet.')).toBeTruthy()
    expect(screen.getByText('Upload image')).toBeTruthy()
  })

  it('shows image preview when shop has an image', () => {
    const shop = makeShop({ image: '/uploads/shops/shop-1/banner.png' })
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    expect(screen.getByAltText('Shop image preview')).toBeTruthy()
    expect(screen.getByText('Change image')).toBeTruthy()
  })

  it('validates unsupported image type client-side', async () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    const file = new File(['dummy'], 'test.gif', { type: 'image/gif' })
    const input = document.getElementById('shop-image-upload') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Only JPEG, PNG, and WebP images are allowed.')).toBeTruthy()
    })
  })

  it('validates oversized image client-side', async () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    const largeBuffer = new ArrayBuffer(6 * 1024 * 1024)
    const file = new File([largeBuffer], 'large.png', { type: 'image/png' })
    const input = document.getElementById('shop-image-upload') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Image must be 5MB or smaller.')).toBeTruthy()
    })
  })

  /* ---------------------------- Name validation -------------------------- */

  it('shows validation error when name is empty on submit', () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    const nameInput = screen.getByDisplayValue('Test Shop')
    fireEvent.change(nameInput, { target: { value: '' } })

    // Trigger submit
    const form = nameInput.closest('form')
    if (form) fireEvent.submit(form)

    expect(screen.getByText('Shop name is required.')).toBeTruthy()
  })

  /* ---------------------------- Cancel button ---------------------------- */

  it('resets form to original values on cancel', () => {
    const shop = makeShop()
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    const nameInput = screen.getByDisplayValue('Test Shop')
    fireEvent.change(nameInput, { target: { value: 'Modified' } })

    expect(screen.getByDisplayValue('Modified')).toBeTruthy()

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(screen.getByDisplayValue('Test Shop')).toBeTruthy()
  })

  /* ---------------------------- Description ------------------------------ */

  it('renders description textarea with character count', () => {
    const shop = makeShop({ description: 'Short desc' })
    render(<CreatorShopSettingsPage shop={shop} allShops={[{ id: shop.id, name: shop.name }]} />)

    expect(screen.getByDisplayValue('Short desc')).toBeTruthy()
    expect(screen.getByText('10/2000')).toBeTruthy()
  })
})

/* -------------------------------------------------------------------------- */
/*                           Loading Skeleton Tests                           */
/* -------------------------------------------------------------------------- */

describe('CreatorShopSettingsLoading', () => {
  it('renders skeleton placeholders', () => {
    render(<CreatorShopSettingsLoading />)

    // Should contain skeletons (they have animate-pulse class)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

/* -------------------------------------------------------------------------- */
/*                             Error State Tests                              */
/* -------------------------------------------------------------------------- */

describe('CreatorShopSettingsError', () => {
  it('renders error message with retry button', () => {
    render(<CreatorShopSettingsError error={new Error('Test error')} />)

    expect(screen.getByText('Failed to load dashboard. Please try again.')).toBeTruthy()
    expect(screen.getByText('Test error')).toBeTruthy()

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    expect(mockInvalidate).toHaveBeenCalled()
  })
})
