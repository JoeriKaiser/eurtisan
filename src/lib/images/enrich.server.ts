import { buildImgproxyUrl } from './storage.server'

export const DEFAULT_PRODUCT_WIDTHS = [400, 800, 1200] as const
export const THUMBNAIL_PRODUCT_WIDTHS = [80, 160] as const

export interface EnrichedImage {
  id: string
  url: string
  srcset: string
  thumbnailSrcset: string
  altText: string | null
  sortOrder: number
}

export function enrichImage(
  image: { id: string; url: string; altText: string | null; sortOrder: number },
  widths: readonly number[] = DEFAULT_PRODUCT_WIDTHS,
  thumbnailWidths: readonly number[] = THUMBNAIL_PRODUCT_WIDTHS,
): EnrichedImage {
  if (
    image.url.startsWith('http://') ||
    image.url.startsWith('https://') ||
    image.url.startsWith('/uploads/')
  ) {
    return {
      ...image,
      url: image.url,
      srcset: widths.map((w) => `${image.url} ${w}w`).join(', '),
      thumbnailSrcset: thumbnailWidths.map((w) => `${image.url} ${w}w`).join(', '),
    }
  }

  const url = buildImgproxyUrl(image.url, { format: 'webp' })
  const srcset = widths
    .map((w) => `${buildImgproxyUrl(image.url, { width: w, format: 'webp' })} ${w}w`)
    .join(', ')
  const thumbnailSrcset = thumbnailWidths
    .map((w) => `${buildImgproxyUrl(image.url, { width: w, format: 'webp' })} ${w}w`)
    .join(', ')

  return {
    ...image,
    url,
    srcset,
    thumbnailSrcset,
  }
}

export function enrichProductImageUrls<
  T extends {
    imageUrl?: string | null
    images?: Array<{ id: string; url: string; altText: string | null; sortOrder: number }>
  },
>(product: T): T & { images?: EnrichedImage[] } {
  const images = product.images?.map((img) => enrichImage(img))
  const primaryImage =
    images && images.length > 0
      ? [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0]
      : undefined

  let imageUrl = product.imageUrl
  if (primaryImage?.url) {
    imageUrl = primaryImage.url
  } else if (product.imageUrl) {
    imageUrl =
      product.imageUrl.startsWith('http://') ||
      product.imageUrl.startsWith('https://') ||
      product.imageUrl.startsWith('/uploads/')
        ? product.imageUrl
        : buildImgproxyUrl(product.imageUrl, { format: 'webp' })
  }

  return {
    ...product,
    ...(images !== undefined ? { images } : {}),
    imageUrl,
  } as T & { images?: EnrichedImage[] }
}
