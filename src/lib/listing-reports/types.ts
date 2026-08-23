/**
 * Browser-safe types for DSA Art. 16 notice-and-action on listings and shops.
 * Server implementations live in `./operations.server`; nothing here may
 * import a server-only module.
 */

export const LISTING_REPORT_REASONS = [
  'counterfeit',
  'unsafe',
  'illegal_goods',
  'fraud',
  'other',
] as const

export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number]

export type ListingReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed'

/** The outcomes an admin decision can record; both close a report for good. */
export type ListingReportResolutionOutcome = 'actioned' | 'dismissed'

export type ListingReportTargetType = 'product' | 'shop'

export interface CreateListingReportResult {
  /**
   * False when this notice was newly recorded, true when the same person had
   * already reported the same product/shop — the unique index makes a second
   * notice idempotent rather than an error.
   */
  alreadyReported: boolean
}

export interface ResolveListingReportResult {
  success: true
}

/**
 * One row of the admin triage queue: a notice about a product or a shop,
 * joined with the names an admin needs to act without leaving the table.
 *
 * For a product notice `shopId`/`shopName` identify the shop selling it; for a
 * shop notice they repeat the target.
 */
export interface AdminListingReport {
  targetType: ListingReportTargetType
  id: string
  targetId: string
  targetName: string
  shopId: string
  shopName: string
  reporterName: string | null
  reason: ListingReportReason
  details: string | null
  status: ListingReportStatus
  resolutionNote: string | null
  createdAt: Date
  resolvedAt: Date | null
}

export interface AdminListingReportsResult {
  reports: AdminListingReport[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
