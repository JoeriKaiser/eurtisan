import type { TraderStatus } from '../shops/trader-status'

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
  /** Unit-pricing declaration (Directive 98/6/EC); null when not declared. */
  weightGrams: number | null
  volumeMl: number | null
  soldBy: 'weight' | 'volume' | null
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
  /** Seller-declared CRD status. Null only for a legacy shop awaiting declaration. */
  traderStatus: TraderStatus | null
  categoryId: string | null
  shopIsVatRegistered: boolean
  /**
   * How long the maker takes to dispatch, in business days, from the shop's
   * `shippingOrigin`. Null when the shop never set it or a legacy row lacks it.
   * Settings address edits preserve this value by merging into the decrypted
   * origin rather than replacing it.
   *
   * Transit time is deliberately absent: it needs a carrier quote against a
   * destination, and a delivery date that turns out wrong at checkout costs more
   * trust than it wins.
   */
  dispatchDays: { min: number; max: number } | null
  /**
   * The seller's own low-stock threshold, so availability language follows what
   * they consider scarce rather than a number hardcoded in the UI.
   */
  lowStockThreshold: number
  /**
   * Approved-review aggregate, or null when the product has none. Shares
   * `PUBLIC_REVIEW_FILTER` with the review list and the search index — the three
   * disagreeing is exactly what the reviews phase fixed.
   */
  rating: { average: number; reviewCount: number } | null
}

export type ListProductsFilters = {
  shopSlug?: string
  /**
   * Exact category match. A parent slug matches **only** products assigned
   * directly to that parent — use `categoryIds` when subcategories must be
   * included. Correct for the shop storefront, whose filter list is built from
   * categories that actually occur on that shop's products.
   */
  categorySlug?: string
  /**
   * Descendant-aware category match, from `getDescendantCategoryIds`. This is
   * what category browsing needs: browsing "Ceramics" must show everything
   * under it, not just products pinned to the parent node itself.
   */
  categoryIds?: string[]
  activeOnly?: boolean
  minPriceCents?: number
  maxPriceCents?: number
  /** Case-insensitive partial match on the product name. */
  search?: string
  /** Same meaning as `SearchFilters.inStockOnly` — see `buildProductWhere`. */
  inStockOnly?: boolean
  /**
   * Product to leave out. Exists for the "more from this shop" rail, which must
   * not offer the product the buyer is already looking at.
   */
  excludeProductId?: string
}

/** Browsing state for one category page, mirroring `ShopProductsOptions`. */
export type CategoryProductsOptions = {
  minPriceCents?: number
  maxPriceCents?: number
  inStockOnly?: boolean
  sort?: SortOption
}

/** Browsing state for a single shop's storefront. */
export type ShopProductsOptions = {
  search?: string
  categorySlug?: string
  inStockOnly?: boolean
  sort?: SortOption
  pagination?: Pagination
}

export type ShopProductCategory = {
  id: string
  name: string
  slug: string
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
  inStockOnly?: boolean
}

/**
 * Result counts per facet value, as returned by the search engine. Absent when
 * a search is served by the PostgreSQL fallback, which cannot produce counts
 * cheaply — consumers must degrade gracefully rather than assume presence.
 */
export type SearchFacets = {
  categorySlug: Record<string, number>
  inStock: Record<string, number>
  priceCents: { min: number; max: number } | null
}

export type PaginatedProducts = {
  products: PublicProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  facets?: SearchFacets
}
export type ShopSummary = {
  id: string
  name: string
  description: string | null
  slug: string
  image: string | null
}
