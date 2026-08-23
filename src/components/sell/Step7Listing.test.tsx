// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Step7Listing } from './Step7Listing'

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => ({ categories: [] }),
}))
vi.mock('#/paraglide/runtime', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getLocale: () => 'en',
  }
})

const updateField = vi.fn()
const updateFields = vi.fn()
const runSave = vi.fn(async (fn: () => Promise<void>) => fn())
const registerStepActions = vi.fn()

const stepData = {
  productId: undefined,
  name: 'Handmade mug',
  slug: 'handmade-mug',
  description: '',
  price: '14,50',
  stockCount: '3',
  categoryId: '',
  vatRateCategory: 'standard',
  weightGrams: '500',
  lengthCm: '10',
  widthCm: '10',
  heightCm: '10',
  soldBy: '',
  volumeMl: '',
  images: [],
}

vi.mock('./OnboardingProvider', () => ({
  useOnboarding: () => ({
    draft: { id: 'draft-1' },
    getStepData: () => stepData,
    updateField,
    updateFields,
    runSave,
    registerStepActions,
  }),
}))

vi.mock('#/hooks/useImageUpload', () => ({
  useImageUpload: () => ({ upload: vi.fn(), uploading: false, error: null }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    onboarding_stage_product: () => 'Product',
    onboarding_product_title: () => 'Your product',
    onboarding_product_description: () => 'Describe your product.',
    onboarding_product_details: () => 'Product details',
    onboarding_product_name: () => 'Name',
    onboarding_product_name_placeholder: () => 'Name',
    onboarding_product_description_label: () => 'Description',
    onboarding_product_description_placeholder: () => 'Description',
    onboarding_product_category: () => 'Category',
    onboarding_product_category_placeholder: () => 'Choose a category',
    vat_category_label: () => 'VAT category',
    vat_category_standard: () => 'Standard',
    vat_category_reduced: () => 'Reduced',
    vat_category_exempt: () => 'Exempt',
    vat_category_hint: () => 'Hint',
    onboarding_product_photos: () => 'Photos',
    onboarding_product_photos_hint: () => 'Add photos.',
    onboarding_cover_image: () => 'Cover',
    onboarding_remove_product_image: (_args: { index: string }) => 'Remove image',
    onboarding_image_alt_placeholder: () => 'Alt text',
    onboarding_image_alt_label: (_args: { index: string }) => 'Alt text',
    onboarding_move_image_left: () => 'Move earlier',
    onboarding_move_image_right: () => 'Move later',
    onboarding_uploading_image: () => 'Uploading…',
    onboarding_add_product_photos: () => 'Add photos',
    onboarding_image_requirements: () => 'JPEG, PNG or WebP.',
    onboarding_sale_details: () => 'Price and stock',
    onboarding_product_price: () => 'Price',
    currency_symbol: () => '€',
    onboarding_product_quantity: () => 'Available quantity',
    onboarding_price_entered: () => 'Product price',
    onboarding_platform_fee: (args?: { percent?: number }) =>
      `Platform fee (${args?.percent ?? 'MISSING'}%)`,
    onboarding_estimated_earnings: () => 'Estimated earnings',
    onboarding_parcel_title: () => 'Packed parcel',
    onboarding_parcel_description: () => 'Parcel dimensions.',
    product_weight_label: () => 'Weight',
    product_length_label: () => 'Length',
    product_width_label: () => 'Width',
    product_height_label: () => 'Height',
    unit_price_sold_by_label: () => 'Sold by',
    creator_product_new_category_none: () => 'None',
    unit_price_basis_weight: () => 'Weight',
    unit_price_basis_volume: () => 'Volume',
    unit_price_volume_label: () => 'Volume (ml)',
    unit_price_hint: () => 'Hint',
  },
}))

describe('Step7Listing earnings preview', () => {
  it('previews cent-exact fees for comma decimal prices using the platform fee constant', () => {
    render(<Step7Listing />)

    expect(screen.getByText('€14.50')).toBeDefined()
    expect(screen.getByText('Platform fee (10%)')).toBeDefined()
    expect(screen.getByText('− €1.45')).toBeDefined()
    expect(screen.getByText('€13.05')).toBeDefined()
  })

  it('does not show a fabricated payment fee estimate', () => {
    render(<Step7Listing />)

    expect(screen.queryByText(/payment fee/i)).toBeNull()
  })
})
