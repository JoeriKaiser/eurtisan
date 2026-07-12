export interface ReviewableItem {
  shopOrderId: string
  productId: string
  productName: string
  deliveredAt: Date | null
  isEligible: boolean
  daysRemaining: number | null
  hasReview: boolean
}

export interface ReviewEligibilityResult {
  items: ReviewableItem[]
}

export interface CreatedReview {
  id: string
  shopOrderId: string
  productId: string
  rating: number
  comment: string | null
  createdAt: Date
}

export interface ProductReview {
  id: string
  buyerName: string
  rating: number
  comment: string | null
  createdAt: Date
}

export interface ReviewDistribution {
  rating: number
  count: number
}

export interface ProductReviewsResult {
  reviews: ProductReview[]
  total: number
  averageRating: number | null
  distribution: ReviewDistribution[]
  page: number
  pageSize: number
  totalPages: number
}

export interface AdminReview {
  id: string
  productId: string
  productName: string
  buyerName: string
  rating: number
  comment: string | null
  moderationStatus: 'approved' | 'flagged' | 'hidden'
  createdAt: Date
}

export interface AdminReviewsResult {
  reviews: AdminReview[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
