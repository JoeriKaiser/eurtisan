export const RETURN_POLICY_VERSION = 'eu-baseline-2026-01'
export const WITHDRAWAL_WINDOW_DAYS = 14
export const RETURN_SHIPMENT_WINDOW_DAYS = 14
export const DEFECT_REPORT_WINDOW_DAYS = 730
const DAY_MS = 24 * 60 * 60 * 1000

export type ReturnPolicy = 'standard' | 'personalized' | 'perishable' | 'hygiene_sealed'
export type ReturnRequestType = 'withdrawal' | 'defective'

export interface ReturnEligibilityInput {
  type: ReturnRequestType
  deliveredAt: Date | null
  returnPolicy: ReturnPolicy
  now?: Date
}

export interface ReturnEligibility {
  eligible: boolean
  deadline: Date | null
  exclusionCode: string | null
}

export function getReturnEligibility(input: ReturnEligibilityInput): ReturnEligibility {
  if (!input.deliveredAt) {
    return { eligible: false, deadline: null, exclusionCode: 'NOT_DELIVERED' }
  }
  const now = input.now ?? new Date()
  const windowDays =
    input.type === 'withdrawal' ? WITHDRAWAL_WINDOW_DAYS : DEFECT_REPORT_WINDOW_DAYS
  const deadline = new Date(input.deliveredAt.getTime() + windowDays * DAY_MS)
  if (now > deadline) {
    return { eligible: false, deadline, exclusionCode: 'RETURN_WINDOW_EXPIRED' }
  }
  if (input.type === 'withdrawal' && input.returnPolicy !== 'standard') {
    return {
      eligible: false,
      deadline,
      exclusionCode: `RETURN_EXCLUDED_${input.returnPolicy.toUpperCase()}`,
    }
  }
  return { eligible: true, deadline, exclusionCode: null }
}

export function getReturnDeadline(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + RETURN_SHIPMENT_WINDOW_DAYS * DAY_MS)
}

export function calculateReturnRefund(input: {
  items: Array<{ unitPriceCents: number; quantity: number; orderedQuantity: number }>
  shopOrderItemCount: number
  standardShippingCostCents: number
}): { itemRefundCents: number; outboundShippingRefundCents: number; totalCents: number } {
  const itemRefundCents = input.items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  )
  const selectedQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0)
  const orderedSelectedQuantity = input.items.reduce((sum, item) => sum + item.orderedQuantity, 0)
  const isFullShopOrder =
    input.items.length === input.shopOrderItemCount && selectedQuantity === orderedSelectedQuantity
  const outboundShippingRefundCents = isFullShopOrder ? input.standardShippingCostCents : 0
  return {
    itemRefundCents,
    outboundShippingRefundCents,
    totalCents: itemRefundCents + outboundShippingRefundCents,
  }
}
