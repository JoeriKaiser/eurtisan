import { useLoaderData, Link, useRouter } from '@tanstack/react-router'
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
import { formatPriceEUR } from '#/lib/pricing'
import { ResolutionForm } from './ResolutionForm'
import { MessageThread } from './MessageThread'
import { AdminMessageInput } from './AdminMessageInput'
function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    item_not_received: 'Item not received',
    not_as_described: 'Not as described',
    damaged: 'Damaged',
    other: 'Other',
  }
  return labels[reason] ?? reason
}

function getResolutionLabel(resolution: string): string {
  const labels: Record<string, string> = {
    close: 'Closed — no action',
    partial_refund: 'Partial refund',
    full_refund: 'Full refund',
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

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''}`
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`
  return `${diffMinutes} min`
}

/* -------------------------------------------------------------------------- */
/*                           Main Page Component                              */
/* -------------------------------------------------------------------------- */

export function AdminDisputeDetailPage() {
  const { dispute } = useLoaderData({ from: '/admin/disputes/$disputeId' })
  const router = useRouter()
  const [justResolved, setJustResolved] = useState(false)

  const isResolved = dispute.status === 'resolved' || justResolved

  const handleResolved = useCallback(() => {
    setJustResolved(true)
    router.invalidate()
  }, [router])

  const handleMessageSent = useCallback(() => {
    router.invalidate()
  }, [router])

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
            Back to queue
          </Link>
          <Badge variant={isResolved ? 'success' : 'warning'}>
            {isResolved ? 'Resolved' : 'Open'}
          </Badge>
        </div>

        {/* Title */}
        <div className='mb-8'>
          <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
            Dispute {getReasonLabel(dispute.reason)}
          </h1>
          <div className='flex flex-wrap items-center gap-4 text-sm text-text-secondary'>
            <span className='flex items-center gap-1.5'>
              <Clock size={14} aria-hidden='true' />
              {getDisputeAge(dispute.createdAt)} old
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
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-xs text-text-muted'>Shop</p>
                  <p className='text-sm font-medium text-text-primary'>{dispute.order.shopName}</p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>Order ID</p>
                  <p className='font-mono text-sm text-text-primary'>
                    {dispute.order.id.slice(0, 8)}…
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>Date</p>
                  <p className='text-sm text-text-primary'>
                    {new Date(dispute.order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>Status</p>
                  <Badge variant='default' className='mt-1 capitalize'>
                    {dispute.order.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>Subtotal</p>
                  <p className='text-sm text-text-primary'>
                    {formatPriceEUR(dispute.order.subtotalCents)}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>Shipping</p>
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
                    Items Purchased
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
                      Total: {formatPriceEUR(dispute.order.totalCents)}
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
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-xs text-text-muted'>Buyer</p>
                  <p className='text-sm font-medium text-text-primary'>{dispute.buyer.name}</p>
                  <p className='mt-1 flex items-center gap-1 text-xs text-text-muted'>
                    <Mail size={12} aria-hidden='true' />
                    {dispute.buyer.email}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-text-muted'>Shop Owner</p>
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
              <CardTitle>Dispute Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap text-sm text-text-secondary'>
                {dispute.description}
              </p>
            </CardContent>
          </Card>

          {/* Message Thread */}
          <section>
            <h2 className='mb-4 text-lg font-semibold text-text-primary'>Message Thread</h2>
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
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  <p className='text-sm text-text-primary'>
                    <span className='font-medium'>Decision:</span>{' '}
                    {getResolutionLabel(dispute.resolution ?? '')}
                  </p>
                  {dispute.refundCents != null && dispute.refundCents > 0 && (
                    <p className='text-sm text-text-primary'>
                      <span className='font-medium'>Refund:</span>{' '}
                      {formatPriceEUR(dispute.refundCents)}
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
