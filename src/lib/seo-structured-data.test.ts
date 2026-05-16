import { describe, expect, it, vi } from 'vitest'

// Mock paraglide messages before importing the module under test
vi.mock('#/paraglide/messages', () => ({
  m: {
    meta_title_default: () => 'Eurtisan — European Marketplace for Makers',
  },
}))

import {
  generateProductJsonLd,
  generateStoreJsonLd,
  generateWebSiteJsonLd,
} from './seo-structured-data'

describe('generateProductJsonLd', () => {
  const baseProductInput = {
    productId: 'prod-123',
    name: 'Handmade Ceramic Vase',
    description: 'A beautiful hand-thrown ceramic vase.',
    canonicalPath: '/products/handmade-vase',
    images: [{ url: '/uploads/vase-1.jpg' }, { url: '/uploads/vase-2.jpg' }],
    price: '29.99',
    stockCount: 5,
    brandName: 'Clay & Kiln Studio',
    categoryName: 'Home & Living',
  }

  it('produces a valid Product schema with all fields', () => {
    const result = generateProductJsonLd(baseProductInput)

    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Product')
    expect(result.name).toBe('Handmade Ceramic Vase')
    expect(result.description).toBe('A beautiful hand-thrown ceramic vase.')
    expect(result.sku).toBe('prod-123')
    expect(result.url).toBe('/products/handmade-vase')

    // Offers
    const offers = result.offers as Record<string, unknown>
    expect(offers['@type']).toBe('Offer')
    expect(offers.price).toBe('29.99')
    expect(offers.priceCurrency).toBe('EUR')
    expect(offers.availability).toBe('https://schema.org/InStock')
    expect(offers.url).toBe('/products/handmade-vase')

    // Images array
    expect(result.image).toEqual(['/uploads/vase-1.jpg', '/uploads/vase-2.jpg'])

    // Brand
    const brand = result.brand as Record<string, unknown>
    expect(brand['@type']).toBe('Brand')
    expect(brand.name).toBe('Clay & Kiln Studio')

    // Category
    expect(result.category).toBe('Home & Living')
  })

  it('marks out-of-stock products correctly', () => {
    const result = generateProductJsonLd({
      ...baseProductInput,
      stockCount: 0,
    })

    const offers = result.offers as Record<string, unknown>
    expect(offers.availability).toBe('https://schema.org/OutOfStock')
  })

  it('omits description when null or empty', () => {
    const result = generateProductJsonLd({
      ...baseProductInput,
      description: null,
    })

    expect(result.description).toBeUndefined()
  })

  it('omits images when array is empty', () => {
    const result = generateProductJsonLd({
      ...baseProductInput,
      images: [],
    })

    expect(result.image).toBeUndefined()
  })

  it('omits brand when brandName is undefined', () => {
    const result = generateProductJsonLd({
      ...baseProductInput,
      brandName: undefined,
    })

    expect(result.brand).toBeUndefined()
  })

  it('omits category when categoryName is null', () => {
    const result = generateProductJsonLd({
      ...baseProductInput,
      categoryName: null,
    })

    expect(result.category).toBeUndefined()
  })

  it('defaults currency to EUR', () => {
    const result = generateProductJsonLd({
      ...baseProductInput,
      currency: undefined,
    })

    const offers = result.offers as Record<string, unknown>
    expect(offers.priceCurrency).toBe('EUR')
  })

  it('uses custom currency when provided', () => {
    const result = generateProductJsonLd({
      ...baseProductInput,
      currency: 'CHF',
    })

    const offers = result.offers as Record<string, unknown>
    expect(offers.priceCurrency).toBe('CHF')
  })
})

describe('generateStoreJsonLd', () => {
  const baseStoreInput = {
    shopName: 'Clay & Kiln Studio',
    description: 'Handmade ceramics from a small Barcelona studio.',
    canonicalPath: '/shops/clay-kiln',
    image: '/uploads/shop-banner.jpg',
  }

  it('produces a valid Store schema with all fields', () => {
    const result = generateStoreJsonLd(baseStoreInput)

    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Store')
    expect(result.name).toBe('Clay & Kiln Studio')
    expect(result.description).toBe('Handmade ceramics from a small Barcelona studio.')
    expect(result.url).toBe('/shops/clay-kiln')
    expect(result.image).toBe('/uploads/shop-banner.jpg')
  })

  it('omits description when null', () => {
    const result = generateStoreJsonLd({
      ...baseStoreInput,
      description: null,
    })

    expect(result.description).toBeUndefined()
  })

  it('omits image when null', () => {
    const result = generateStoreJsonLd({
      ...baseStoreInput,
      image: null,
    })

    expect(result.image).toBeUndefined()
  })
})

describe('generateWebSiteJsonLd', () => {
  it('produces a valid WebSite schema with defaults', () => {
    const result = generateWebSiteJsonLd()

    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('WebSite')
    expect(result.name).toBe('Eurtisan — European Marketplace for Makers')
    expect(result.url).toBe('/')

    const action = result.potentialAction as Record<string, unknown>
    expect(action['@type']).toBe('SearchAction')

    const target = action.target as Record<string, unknown>
    expect(target['@type']).toBe('EntryPoint')
    expect(target.urlTemplate).toBe('/search?q={search_term_string}')

    expect(action['query-input']).toBe('required name=search_term_string')
  })

  it('accepts custom name', () => {
    const result = generateWebSiteJsonLd({ name: 'Eurtisan' })

    expect(result.name).toBe('Eurtisan')
  })

  it('accepts custom URL', () => {
    const result = generateWebSiteJsonLd({ url: 'https://eurtisan.com' })

    expect(result.url).toBe('https://eurtisan.com')
  })

  it('accepts custom search URL template', () => {
    const result = generateWebSiteJsonLd({
      searchUrlTemplate: 'https://eurtisan.com/search?q={search_term_string}',
    })

    const action = result.potentialAction as Record<string, unknown>
    const target = action.target as Record<string, unknown>
    expect(target.urlTemplate).toBe('https://eurtisan.com/search?q={search_term_string}')
  })
})
