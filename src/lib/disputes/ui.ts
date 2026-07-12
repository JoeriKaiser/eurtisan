import { m } from '#/paraglide/messages'

export function getDisputeReasonLabel(reason: string): string {
  switch (reason) {
    case 'item_not_received':
      return m.dispute_reason_item_not_received()
    case 'not_as_described':
      return m.dispute_reason_not_as_described()
    case 'damaged':
      return m.dispute_reason_damaged()
    case 'other':
      return m.dispute_reason_other()
    default:
      return reason
  }
}

export function getDisputeStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return m.dispute_status_open()
    case 'resolved':
      return m.dispute_status_resolved()
    case 'closed':
      return m.dispute_status_closed()
    default:
      return status
  }
}

export function getDisputeResolutionLabel(resolution: string): string {
  switch (resolution) {
    case 'close':
      return m.dispute_resolution_close()
    case 'partial_refund':
      return m.dispute_resolution_partial_refund()
    case 'full_refund':
      return m.dispute_resolution_full_refund()
    default:
      return resolution
  }
}

export function getDisputeReference(id: string): string {
  return `#${id.slice(0, 8)}`
}
