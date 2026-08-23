import { Link } from '@tanstack/react-router'
import { AlertTriangle, MessageSquare } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { OrderShopGroup } from '#/lib/orders.server'
import { m } from '#/paraglide/messages'
import { formatDate } from './order-date'

export function isDisputeEligible(deliveredAt: Date | null): boolean {
  if (!deliveredAt) return false
  const daysSinceDelivery = (Date.now() - deliveredAt.getTime()) / (24 * 60 * 60 * 1000)
  return daysSinceDelivery <= 30
}

export interface OpenedDispute {
  disputeId: string
  shopOrderId: string
}

export interface OrderDisputeRowProps {
  shop: OrderShopGroup
  openedDispute: OpenedDispute | null
  onOpenDispute: (shop: OrderShopGroup) => void
}

export function OrderDisputeRow({ shop, openedDispute, onOpenDispute }: OrderDisputeRowProps) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3'>
      <div className='max-w-xl' aria-live='polite'>
        {shop.nonDeliveryEligibility && shop.status !== 'delivered' && (
          <>
            <p className='text-sm font-medium text-text-primary'>
              {shop.nonDeliveryEligibility.eligible
                ? m.order_non_delivery_eligible()
                : shop.nonDeliveryEligibility.eligibleAt
                  ? m.order_non_delivery_eligible_date({
                      date: formatDate(shop.nonDeliveryEligibility.eligibleAt),
                    })
                  : m.order_non_delivery_unavailable()}
            </p>
            <p className='mt-1 text-xs text-text-muted'>
              {m.order_non_delivery_evidence_guidance()}
            </p>
          </>
        )}
      </div>
      {shop.disputeId ? (
        <Link
          to='/disputes/$disputeId'
          params={{ disputeId: shop.disputeId }}
          className='inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent-secondary transition-colors hover:bg-accent-secondary-subtle hover:text-accent-secondary-hover no-underline'
        >
          <MessageSquare size={14} aria-hidden='true' />
          {m.order_detail_view_dispute()}
        </Link>
      ) : openedDispute?.shopOrderId === shop.shopOrderId ? (
        <Link
          to='/disputes/$disputeId'
          params={{ disputeId: openedDispute.disputeId }}
          className='inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent-secondary transition-colors hover:bg-accent-secondary-subtle hover:text-accent-secondary-hover no-underline'
        >
          <MessageSquare size={14} aria-hidden='true' />
          {m.order_detail_view_dispute()}
        </Link>
      ) : shop.status === 'delivered' ? (
        isDisputeEligible(shop.deliveredAt) ? (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onOpenDispute(shop)}
            className='text-error hover:bg-error/5 hover:text-error'
          >
            <AlertTriangle size={14} className='mr-1' aria-hidden='true' />
            {m.order_detail_open_dispute()}
          </Button>
        ) : (
          <Button
            variant='ghost'
            size='sm'
            disabled
            title={m.order_detail_dispute_disabled_tooltip()}
            className='text-text-muted'
          >
            <AlertTriangle size={14} className='mr-1' aria-hidden='true' />
            {m.order_detail_open_dispute()}
          </Button>
        )
      ) : shop.nonDeliveryEligibility?.eligible ? (
        <Button variant='secondary' size='sm' onClick={() => onOpenDispute(shop)}>
          <AlertTriangle size={14} className='mr-1' aria-hidden='true' />
          {m.order_detail_open_dispute()}
        </Button>
      ) : null}
    </div>
  )
}
