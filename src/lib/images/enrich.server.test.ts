import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PRODUCT_WIDTHS, enrichImage, enrichProductImageUrls } from './enrich.server'
import { buildImgproxyUrl } from './storage.server'

vi.mock('./storage.server', () => ({
  buildImgproxyUrl: vi.fn((key: string, options?: { width?: number; format?: string }) => {
    const opts = [
      options?.width ? `w:${options.width}` : '',
      options?.format ? `f:${options.format}` : '',
    ]
      .filter(Boolean)
      .join('/')
    const prefix = opts ? `/${opts}` : ''
    return `https://imgproxy.test${prefix}/${key}`
  }),
}))

describe('DEFAULT_PRODUCT_WIDTHS', () => {
  it('defines the standard responsive widths', () => {
    expect(DEFAULT_PRODUCT_WIDTHS).toEqual([400, 800, 1200])
  })
})

describe('enrichImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enriches a raw S3 key with signed imgproxy URL and srcset using default widths', () => {
    const rawImage = {
      id: 'img-1',
      url: 'products/ceramic-vase.jpg',
      altText: 'A lovely ceramic vase',
      sortOrder: 0,
    }

    const enriched = enrichImage(rawImage)

    expect(enriched.id).toBe('img-1')
    expect(enriched.altText).toBe('A lovely ceramic vase')
    expect(enriched.sortOrder).toBe(0)
    expect(enriched.url).toBe('https://imgproxy.test/f:webp/products/ceramic-vase.jpg')
    expect(enriched.srcset).toBe(
      'https://imgproxy.test/w:400/f:webp/products/ceramic-vase.jpg 400w, ' +
        'https://imgproxy.test/w:800/f:webp/products/ceramic-vase.jpg 800w, ' +
        'https://imgproxy.test/w:1200/f:webp/products/ceramic-vase.jpg 1200w',
    )
    expect(enriched.thumbnailSrcset).toBe(
      'https://imgproxy.test/w:80/f:webp/products/ceramic-vase.jpg 80w, ' +
        'https://imgproxy.test/w:160/f:webp/products/ceramic-vase.jpg 160w',
    )
  })

  it('enriches a raw S3 key with custom widths', () => {
    const rawImage = {
      id: 'img-thumb',
      url: 'products/thumb.png',
      altText: null,
      sortOrder: 1,
    }

    const enriched = enrichImage(rawImage, [80, 160])

    expect(enriched.url).toBe('https://imgproxy.test/f:webp/products/thumb.png')
    expect(enriched.srcset).toBe(
      'https://imgproxy.test/w:80/f:webp/products/thumb.png 80w, ' +
        'https://imgproxy.test/w:160/f:webp/products/thumb.png 160w',
    )
  })

  it('returns already signed /uploads/ URL as-is and maps srcset over it', () => {
    const signedImage = {
      id: 'img-signed',
      url: '/uploads/signed-signature/plain/s3://bucket/products/item.jpg',
      altText: 'Signed product',
      sortOrder: 0,
    }

    const enriched = enrichImage(signedImage)

    expect(buildImgproxyUrl).not.toHaveBeenCalled()
    expect(enriched.url).toBe(signedImage.url)
    expect(enriched.srcset).toBe(
      `${signedImage.url} 400w, ${signedImage.url} 800w, ${signedImage.url} 1200w`,
    )
  })

  it('returns external http:// and https:// URLs as-is and maps srcset over them', () => {
    const externalImage = {
      id: 'img-ext',
      url: 'https://images.unsplash.com/photo-12345',
      altText: 'External photo',
      sortOrder: 0,
    }

    const enriched = enrichImage(externalImage)

    expect(buildImgproxyUrl).not.toHaveBeenCalled()
    expect(enriched.url).toBe(externalImage.url)
    expect(enriched.srcset).toBe(
      `${externalImage.url} 400w, ${externalImage.url} 800w, ${externalImage.url} 1200w`,
    )
  })
})

describe('enrichProductImageUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enriches product images and sets imageUrl to the primary image signed url', () => {
    const product = {
      id: 'prod-1',
      name: 'Vase',
      imageUrl: null,
      images: [
        {
          id: 'img-1',
          url: 'products/vase-main.jpg',
          altText: 'Front view',
          sortOrder: 0,
        },
        {
          id: 'img-2',
          url: 'products/vase-side.jpg',
          altText: 'Side view',
          sortOrder: 1,
        },
      ],
    }

    const enriched = enrichProductImageUrls(product)

    expect(enriched.images).toHaveLength(2)
    expect(enriched.images?.[0].url).toBe('https://imgproxy.test/f:webp/products/vase-main.jpg')
    expect(enriched.images?.[0].srcset).toContain('400w')
    expect(enriched.images?.[1].url).toBe('https://imgproxy.test/f:webp/products/vase-side.jpg')
    expect(enriched.imageUrl).toBe('https://imgproxy.test/f:webp/products/vase-main.jpg')
  })

  it('selects the primary image by lowest sortOrder even if out of array order', () => {
    const product = {
      id: 'prod-2',
      imageUrl: null,
      images: [
        {
          id: 'img-second',
          url: 'products/second.jpg',
          altText: 'Second',
          sortOrder: 5,
        },
        {
          id: 'img-first',
          url: 'products/first.jpg',
          altText: 'First',
          sortOrder: 1,
        },
      ],
    }

    const enriched = enrichProductImageUrls(product)

    expect(enriched.imageUrl).toBe('https://imgproxy.test/f:webp/products/first.jpg')
  })

  it('enriches imageUrl directly when images array is not provided or empty', () => {
    const productWithKey = {
      id: 'prod-3',
      imageUrl: 'products/single.jpg',
    }

    const enrichedKey = enrichProductImageUrls(productWithKey)
    expect(enrichedKey.imageUrl).toBe('https://imgproxy.test/f:webp/products/single.jpg')

    const productWithExternal = {
      id: 'prod-4',
      imageUrl: 'https://example.com/external.png',
      images: [],
    }

    const enrichedExt = enrichProductImageUrls(productWithExternal)
    expect(enrichedExt.imageUrl).toBe('https://example.com/external.png')
  })

  it('leaves null or undefined imageUrl untouched when no images are present', () => {
    const productWithoutImages = {
      id: 'prod-5',
      imageUrl: null,
      images: [],
    }

    const enriched = enrichProductImageUrls(productWithoutImages)
    expect(enriched.imageUrl).toBeNull()
  })
})
