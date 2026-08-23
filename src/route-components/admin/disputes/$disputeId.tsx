import { useLoaderData, Link, useRouter } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Mail,
  Package,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { formatDateMediumTime } from '#/lib/format-date'
import { formatPriceEUR } from '#/lib/pricing'
import { ResolutionForm } from './ResolutionForm'
import { MessageThread } from './MessageThread'
import { AdminMessageInput } from './AdminMessageInput'
function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    item_not_received: m.dispute_reason_item_not_received(),
    not_as_described: m.dispute_reason_not_as_described(),
    damaged: m.dispute_reason_damaged(),
    other: m.dispute_reason_other(),
  }
  return labels[reason] ?? reason
}

function getResolutionLabel(resolution: string): string {
  const labels: Record<string, string> = {
    close: m.dispute_resolution_close(),
    partial_refund: m.dispute_resolution_partial_refund(),
    full_refund: m.dispute_resolution_full_refund(),
  }
  return labels[resolution] ?? resolution
}

function getDisputeAge(createdAt: Date | string): string {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 0)
    return m.admin_dispute_age_old({ age: m.admin_dispute_age_days({ count: diffDays }) })
  if (diffHours > 0)
    return m.admin_dispute_age_old({ age: m.admin_dispute_age_hours({ count: diffHours }) })
  return m.admin_dispute_age_old({ age: m.admin_dispute_age_minutes({ count: diffMinutes }) })
}

/* -------------------------------------------------------------------------- */
/*                           Main Page Component                              */
/* -------------------------------------------------------------------------- */

export function AdminDisputeDetailPage() {
  const { dispute } = useLoaderData({ from: '/admin/disputes/$disputeId' })
  const router = useRouter()
  const [resolvedData, setResolvedData] = useState<{
    resolution: string
    refundCents: number | null
  } | null>(null)

  const isResolved = dispute.status === 'resolved' || resolvedData !== null

  const handleResolved = useCallback(
    (resolution: 'close' | 'partial_refund' | 'full_refund', refundCents: number | null) => {
      setResolvedData({ resolution, refundCents })
      router.invalidate()
    },
    [router],
  )

  const handleMessageSent = useCallback(() => {
    router.invalidate()
  }, [router])

  const decision = resolvedData?.resolution ?? dispute.resolution ?? ''
  const displayRefundCents = resolvedData?.refundCents ?? dispute.refundCents

  return (
    <div className='py-8'>
      <div className='mx-auto max-w-4xl'>
        {/* Header */}
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <Link
            to='/admin/disputes'
            search={{ page: 1 }}
            className='inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary'
          >
            <ArrowLeft size={16} aria-hidden='true' />
            {m.admin_dispute_back_to_queue()}
          </Link>
          <Badge variant={isResolved ? 'success' : 'warning'}>
            {isResolved ? m.dispute_status_resolved() : m.dispute_status_open()}
          </Badge>
        </div>

        {/* Title */}
        <div className='mb-8'>
          <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
            {m.admin_dispute_title({ reason: getReasonLabel(dispute.reason) })}
          </h1>
          <div className='flex flex-wrap items-center gap-4 text-sm text-text-secondary'>
            <span className='flex items-center gap-1.5'>
              <Clock size={14} aria-hidden='true' />
              {getDisputeAge(dispute.createdAt)}
            </span>
            <span className='font-mono text-text-muted'>{dispute.id.slice(0, 8)}…</span>
          </div>
        </div>

        <div className='space-y-6'>
          {/* Order Summary */}
          <Card variant='default'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Package size={18} aria-hidden='true' />
                {m.admin_dispute_order_summary()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-xs text-text-muted'>{m.dispute_shop()}</p>
                  <p className='text-sm font-medium text-text-primary'>{dispute.order.shopName}</p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>{m.admin_dispute_order_id()}</p>
                  <p className='font-mono text-sm text-text-primary'>
                    {dispute.order.id.slice(0, 8)}…
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>{m.admin_disputes_col_date()}</p>
                  <p className='text-sm text-text-primary'>
                    {formatDateMediumTime(dispute.order.createdAt)}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>{m.dispute_status()}</p>
                  <Badge variant='default' className='mt-1 capitalize'>
                    {dispute.order.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>{m.cart_shop_subtotal()}</p>
                  <p className='text-sm text-text-primary'>
                    {formatPriceEUR(dispute.order.subtotalCents)}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>{m.checkout_shipping()}</p>
                  <p className='text-sm text-text-primary'>
                    {formatPriceEUR(dispute.order.shippingCostCents)}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              {dispute.order.items.length > 0 && (
                <div className='mt-6 border-t border-border-default pt-4'>
                  <h3 className='mb-3 flex items-center gap-2 text-sm font-medium text-text-secondary'>
                    <ShoppingBag size={14} aria-hidden='true' />
                    {m.admin_dispute_items_purchased()}
                  </h3>
                  <div className='divide-y divide-border-default'>
                    {dispute.order.items.map((item) => (
                      <div key={item.id} className='flex items-center justify-between py-2'>
                        <div>
                          <p className='text-sm text-text-primary'>{item.productName}</p>
                          <p className='text-xs text-text-muted'>
                            {formatPriceEUR(item.unitPriceCents)} × {item.quantity}
                          </p>
                        </div>
                        <p className='text-sm font-medium text-text-primary'>
                          {formatPriceEUR(item.totalCents)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className='mt-2 flex justify-end border-t border-border-default pt-2'>
                    <p className='text-sm font-semibold text-text-primary'>
                      {m.admin_dispute_total({
                        total: formatPriceEUR(dispute.order.totalCents),
                      })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Participants */}
          <Card variant='default'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <ShieldCheck size={18} aria-hidden='true' />
                {m.admin_dispute_participants()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-xs text-text-muted'>{m.admin_disputes_col_buyer()}</p>
                  <p className='text-sm font-medium text-text-primary'>{dispute.buyer.name}</p>
                  <p className='mt-1 flex items-center gap-1 text-xs text-text-muted'>
                    <Mail size={12} aria-hidden='true' />
                    {dispute.buyer.email}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>{m.admin_dispute_shop_owner()}</p>
                  <p className='text-sm font-medium text-text-primary'>{dispute.shop.name}</p>
                  <p className='mt-1 flex items-center gap-1 text-xs text-text-muted'>
                    <Mail size={12} aria-hidden='true' />
                    {dispute.shop.email}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card variant='default'>
            <CardHeader>
              <CardTitle>{m.admin_dispute_description_title()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap text-sm text-text-secondary'>
                {dispute.description}
              </p>
            </CardContent>
          </Card>

          {/* Message Thread */}
          <section>
            <h2 className='mb-4 text-lg font-semibold text-text-primary'>
              {m.admin_dispute_message_thread()}
            </h2>
            <MessageThread messages={dispute.messages} />
            {!isResolved && (
              <AdminMessageInput disputeId={dispute.id} onMessageSent={handleMessageSent} />
            )}
          </section>

          {/* Resolution */}
          {isResolved ? (
            <Card variant='default'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <CheckCircle2 size={18} className='text-success' aria-hidden='true' />
                  {m.dispute_resolution_label()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  <p className='text-sm text-text-primary'>
                    <span className='font-medium'>{m.admin_dispute_decision()}</span>{' '}
                    {getResolutionLabel(decision)}
                  </p>
                  {displayRefundCents != null && displayRefundCents > 0 && (
                    <p className='text-sm text-text-primary'>
                      <span className='font-medium'>{m.admin_dispute_refund()}</span>{' '}
                      {formatPriceEUR(displayRefundCents)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <ResolutionForm
              disputeId={dispute.id}
              orderTotalCents={dispute.order.totalCents}
              orderStatus={dispute.order.status}
              onResolved={handleResolved}
            />
          )}
        </div>
      </div>
    </div>
  )
}
