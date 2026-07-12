export type DisputeStatus = 'open' | 'resolved' | 'closed'

const VALID_DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ['resolved'],
  resolved: [],
  closed: [],
}

export function isValidDisputeTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  return VALID_DISPUTE_TRANSITIONS[from]?.includes(to) ?? false
}
