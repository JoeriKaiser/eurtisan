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
export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful'

export interface ProductReview {
  id: string
  buyerName: string
  rating: number
  comment: string | null
  createdAt: Date
  /**
   * When the buyer received the product — the "date of the consumer's
   * experience" C. consom. L.111-7-2 requires shown next to the publication
   * date. Null only for orders delivered before delivery timestamps existed.
   */
  experiencedAt: Date | null
  /** Seller-authored response, only when its moderation state is approved. */
  sellerReply: SellerReply | null
  /** Total helpful votes; voter identities are never part of this view. */
  helpfulCount: number
  /** Whether the authenticated viewer has marked this review helpful. */
  viewerHasMarkedHelpful: boolean
  /** Whether the authenticated viewer may add or remove their helpful vote. */
  canMarkHelpful: boolean
  /** Whether the authenticated current shop owner may write the official reply. */
  canReply: boolean
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
  sort: ReviewSort
  /** Applied rating filter, or null when every rating is included. */
  ratingFilter: number | null
}

export type ReviewReportReason = 'not_authentic' | 'offensive' | 'spam' | 'personal_data' | 'other'

export interface SellerReply {
  id: string
  body: string
  sellerName: string
  createdAt: Date
  updatedAt: Date
  canManage: boolean
  canReport: boolean
}

export interface AdminSellerReply {
  id: string
  reviewId: string
  reviewRating: number
  reviewComment: string | null
  buyerName: string
  productId: string
  productName: string
  shopName: string
  shopSlug: string
  sellerName: string
  body: string
  moderationStatus: 'approved' | 'flagged' | 'hidden'
  openReports: number
  createdAt: Date
  updatedAt: Date
}

export interface AdminSellerRepliesResult {
  sellerReplies: AdminSellerReply[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SellerReplyModerationDecision {
  ground: 'illegal' | 'terms'
  legalBasis: string
  explanation: string
  actorUserId: string
}

export interface AdminReview {
  id: string
  productId: string
  productName: string
  buyerName: string
  rating: number
  comment: string | null
  moderationStatus: 'approved' | 'flagged' | 'hidden'
  /** Open notices against this review. Zero is the normal case. */
  openReports: number
  createdAt: Date
}

export interface AdminReviewsResult {
  reviews: AdminReview[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
