export type ShopStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'approved'
  | 'active'
  | 'paused'
  | 'archived'
  | 'rejected'
  | 'suspended'

/**
 * Valid shop lifecycle status transitions.
 *
 * Note: Account deletion is a forced system transition that bypasses this
 * helper (see {@link deleteUserAccount}). It directly sets shops to
 * `archived` because deletion is a compliance operation and must succeed even
 * for statuses that are not normally archivable.
 */
const VALID_SHOP_TRANSITIONS: Record<ShopStatus, ShopStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['approved', 'changes_requested', 'rejected'],
  changes_requested: ['pending_review', 'rejected'],
  approved: ['active'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],
  rejected: [],
  suspended: [], // managed by isSuspended, not status transitions
}

export function isValidShopStatusTransition(from: ShopStatus, to: ShopStatus): boolean {
  return VALID_SHOP_TRANSITIONS[from]?.includes(to) ?? false
}
