import { useLoaderData, Link, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Package,
  Send,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { addDisputeMessage, resolveDispute } from '#/lib/disputes'
import { formatPriceEUR } from '#/lib/pricing'
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

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

/* -------------------------------------------------------------------------- */
/*                           Resolution Form                                  */
/* -------------------------------------------------------------------------- */

function ResolutionForm({
  disputeId,
  orderTotalCents,
  orderStatus,
  onResolved,
}: {
  disputeId: string
  orderTotalCents: number
  orderStatus: string
  onResolved: () => void
}) {
  const [resolution, setResolution] = useState<'close' | 'partial_refund' | 'full_refund'>('close')
  const [refundInput, setRefundInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const refundCents = useMemo(() => {
    const parsed = Number.parseFloat(refundInput)
    if (Number.isNaN(parsed) || parsed < 0) return null
    return Math.round(parsed * 100)
  }, [refundInput])

  const validate = useCallback(() => {
    setFieldError(null)
    if (resolution === 'partial_refund') {
      if (refundCents === null || refundCents <= 0) {
        setFieldError('Refund amount must be greater than 0')
        return false
      }
      if (refundCents > orderTotalCents) {
        setFieldError(`Refund cannot exceed ${formatPriceEUR(orderTotalCents)}`)
        return false
      }
    }
    return true
  }, [resolution, refundCents, orderTotalCents])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      setIsSubmitting(true)
      setError(null)

      try {
        await resolveDispute({
          data: {
            disputeId,
            resolution,
            refundCents: resolution === 'partial_refund' ? refundCents : null,
          },
        })
        onResolved()
      } catch (err) {
        if (err instanceof Response) {
          try {
            const body = await err.json()
            setError(body.message || 'Failed to resolve dispute')
          } catch {
            setError('Failed to resolve dispute')
          }
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('An unexpected error occurred')
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [disputeId, resolution, refundCents, validate, onResolved],
  )

  const refundDisabled = resolution !== 'partial_refund'

  return (
    <Card variant='default'>
      <CardHeader>
        <CardTitle>Resolve Dispute</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label
              htmlFor='resolution-type'
              className='mb-1.5 block text-sm font-medium text-text-secondary'
            >
              Resolution
            </label>
            <select
              id='resolution-type'
              value={resolution}
              onChange={(e) => {
                setResolution(e.target.value as 'close' | 'partial_refund' | 'full_refund')
                setFieldError(null)
              }}
              disabled={isSubmitting}
              className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:cursor-not-allowed disabled:opacity-50'
            >
              <option value='close'>Close (no action)</option>
              <option value='partial_refund'>Partial refund</option>
              <option value='full_refund' disabled={orderStatus === 'refunded'}>
                Full refund{orderStatus === 'refunded' ? ' — already refunded' : ''}
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor='refund-amount'
              className='mb-1.5 block text-sm font-medium text-text-secondary'
            >
              Refund amount (EUR)
            </label>
            <Input
              id='refund-amount'
              type='number'
              step='0.01'
              min='0.01'
              max={centsToEuros(orderTotalCents)}
              value={refundInput}
              onChange={(e) => {
                setRefundInput(e.target.value)
                if (fieldError) setFieldError(null)
              }}
              placeholder='0.00'
              disabled={isSubmitting || refundDisabled}
              error={fieldError ?? undefined}
            />
            {fieldError && (
              <p id='refund-amount-error' className='mt-1 text-xs text-error'>
                {fieldError}
              </p>
            )}
            <p className='mt-1 text-xs text-text-muted'>
              Order total: {formatPriceEUR(orderTotalCents)}
            </p>
          </div>

          {error && (
            <div className='rounded-lg bg-error/10 p-3 text-sm text-error' role='alert'>
              {error}
            </div>
          )}

          <Button type='submit' isLoading={isSubmitting} className='w-full sm:w-auto'>
            Submit Resolution
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                           Message Thread                                   */
/* -------------------------------------------------------------------------- */

function MessageThread({
  messages,
}: {
  messages: Array<{ id: string; senderName: string; message: string; createdAt: Date | string }>
}) {
  if (messages.length === 0) {
    return (
      <div className='rounded-xl border border-border-default bg-surface-default p-6 text-center'>
        <MessageCircle size={32} className='mx-auto mb-3 text-text-muted' aria-hidden='true' />
        <p className='text-sm text-text-secondary'>No messages yet.</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className='rounded-xl border border-border-default bg-surface-default p-4'
        >
          <div className='mb-2 flex items-center justify-between'>
            <span className='text-sm font-medium text-text-primary'>{msg.senderName}</span>
            <span className='text-xs text-text-muted'>
              {new Date(msg.createdAt).toLocaleString()}
            </span>
          </div>
          <p className='whitespace-pre-wrap text-sm text-text-secondary'>{msg.message}</p>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                           Admin Message Input                               */
/* -------------------------------------------------------------------------- */

function AdminMessageInput({
  disputeId,
  onMessageSent,
}: {
  disputeId: string
  onMessageSent: () => void
}) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      await addDisputeMessage({
        data: { disputeId, message: trimmed },
      })
      setMessage('')
      onMessageSent()
    } catch (err) {
      if (err instanceof Response) {
        try {
          const body = await err.json()
          setError(body.message || 'Failed to send message')
        } catch {
          setError('Failed to send message')
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='mt-4 border-t border-border-default pt-4'>
      {error && (
        <div className='mb-3 rounded-lg bg-error/10 p-3 text-sm text-error' role='alert'>
          {error}
        </div>
      )}
      <label htmlFor='admin-message' className='mb-2 block text-sm font-medium text-text-secondary'>
        Send a message
      </label>
      <textarea
        id='admin-message'
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder='Type your message to the buyer and creator…'
        rows={3}
        maxLength={5000}
        disabled={isSubmitting}
        className='min-h-[5rem] w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50 resize-none'
        aria-label='Admin message'
      />
      <div className='mt-2 flex items-center justify-between'>
        <span className='text-xs text-text-muted'>{message.length} / 5000</span>
        <Button type='submit' isLoading={isSubmitting} disabled={!message.trim() || isSubmitting}>
          <Send size={16} aria-hidden='true' />
          Send
        </Button>
      </div>
    </form>
  )
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

export function AdminDisputeDetailPending() {
  return (
    <div className='py-8'>
      <div className='mx-auto max-w-4xl'>
        <div className='mb-6 size-4 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-8 size-8 animate-pulse rounded bg-[var(--sand)]' />
        <div className='space-y-6'>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className='island-shell h-40 animate-pulse rounded-xl bg-[var(--sand)]' />
          ))}
        </div>
      </div>
    </div>
  )
}

export function AdminDisputeDetailError({ error }: { error: Error }) {
  return (
    <div className='py-8'>
      <div className='mx-auto max-w-4xl text-center'>
        <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
        <h1 className='display-title mb-4 text-2xl font-semibold text-text-primary'>
          Failed to load dispute
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
        <Link
          to='/admin/disputes'
          search={{ page: 1 }}
          className='inline-flex items-center gap-2 text-sm text-accent-primary hover:underline'
        >
          <ArrowLeft size={16} aria-hidden='true' />
          Back to queue
        </Link>
      </div>
    </div>
  )
}
