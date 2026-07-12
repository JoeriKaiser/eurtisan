export type PublicProduct = {
  id: string
  name: string
  description: string | null
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  status: 'draft' | 'published' | 'archived'
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  categoryName: string | null
  categorySlug: string | null
  shopName: string | null
  shopSlug: string | null
  shopIsVatRegistered: boolean
  imageUrl: string | null
}

export type RecentProduct = PublicProduct & {
  image: { id: string; url: string; altText: string | null; sortOrder: number } | null
}

export type FeaturedShop = {
  id: string
  name: string
  description: string | null
  slug: string
  productCount: number
  tagline: string | null
  category: string | null
  image: string | null
}

export type ProductDetail = PublicProduct & {
  images: { id: string; url: string; altText: string | null; sortOrder: number }[]
  shopDescription: string | null
  categoryId: string | null
  shopIsVatRegistered: boolean
}

export type ListProductsFilters = {
  shopSlug?: string
  categorySlug?: string
  activeOnly?: boolean
  minPriceCents?: number
  maxPriceCents?: number
}

export type Pagination = {
  page: number
  pageSize: number
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc'

export type SearchSortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest'

export type SearchFilters = {
  categorySlug?: string
  shopSlug?: string
  minPriceCents?: number
  maxPriceCents?: number
}

export type PaginatedProducts = {
  products: PublicProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
export type ShopSummary = {
  id: string
  name: string
  description: string | null
  slug: string
  image: string | null
}
