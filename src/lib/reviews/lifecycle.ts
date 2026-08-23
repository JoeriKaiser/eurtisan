export const ELIGIBILITY_DAYS = 14
export const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getDaysRemaining(deliveredAt: Date | null): number | null {
  if (!deliveredAt) return null
  const eligibleDate = new Date(deliveredAt.getTime() + ELIGIBILITY_DAYS * MS_PER_DAY)
  const now = new Date()
  const diff = eligibleDate.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / MS_PER_DAY))
}

export function isEligibleForReview(deliveredAt: Date | null): boolean {
  if (!deliveredAt) return false
  const eligibleDate = new Date(deliveredAt.getTime() + ELIGIBILITY_DAYS * MS_PER_DAY)
  return new Date() >= eligibleDate
}

/** Statuses that restrict what other people see, as opposed to restoring it. */
export const RESTRICTING_STATUSES = new Set(['flagged', 'hidden'])
