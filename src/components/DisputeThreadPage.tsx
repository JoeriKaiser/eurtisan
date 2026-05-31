import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, MessageSquare, Send } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { addDisputeMessage } from '#/lib/disputes'
import type { DisputeDetail } from '#/lib/disputes.server'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { getLocalizedErrorMessage } from '#/lib/error-mapping'

export { DisputeThreadError } from './DisputeThreadError'
export { DisputeThreadLoading } from './DisputeThreadLoading'

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(date: Date): string {
  return DATE_FORMATTER.format(new Date(date))
}

export interface DisputeThreadPageProps {
  dispute: DisputeDetail
}

export default function DisputeThreadPage({ dispute }: DisputeThreadPageProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const canPostMessage = dispute.status === 'open'

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await addDisputeMessage({
        data: { disputeId: dispute.id, message: trimmed },
      })
      setMessage('')
      router.invalidate()
    } catch (err) {
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({ message: 'Unknown error' }))
        const errorMsg = getLocalizedErrorMessage(body.code || body.message)
        setSubmitError(errorMsg || m.dispute_error_send())
      } else {
        setSubmitError(m.dispute_error_send())
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6'>
          <Link
            to='/orders/$platformOrderId'
            params={{ platformOrderId: dispute.order.platformOrderId }}
            className='inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary no-underline'
          >
            <ArrowLeft size={16} aria-hidden='true' />
            {m.dispute_back_to_order()}
          </Link>
        </div>

        <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='display-title text-2xl font-semibold text-text-primary sm:text-3xl'>
              {m.dispute_title()}
            </h1>
            <p className='mt-1 font-mono text-sm text-text-secondary'>{dispute.id}</p>
          </div>
          <Badge variant={dispute.status === 'open' ? 'warning' : 'default'}>
            {dispute.status}
          </Badge>
        </div>

        <div className='space-y-6'>
          {/* Summary Card */}
          <div className='island-shell rounded-2xl p-6'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <p className='text-sm text-text-secondary'>{m.dispute_reason()}</p>
                <p className='font-medium text-text-primary'>{dispute.reason}</p>
              </div>
              <div>
                <p className='text-sm text-text-secondary'>{m.dispute_status()}</p>
                <p className='font-medium text-text-primary'>{dispute.status}</p>
              </div>
              <div>
                <p className='text-sm text-text-secondary'>{m.dispute_shop()}</p>
                <p className='font-medium text-text-primary'>{dispute.order.shopName}</p>
              </div>
              <div>
                <p className='text-sm text-text-secondary'>{m.dispute_order_total()}</p>
                <p className='font-medium text-text-primary'>
                  {formatPriceEUR(dispute.order.totalCents)}
                </p>
              </div>
            </div>
            <div className='mt-4 border-t border-border-default pt-4'>
              <p className='text-sm text-text-secondary'>{m.dispute_description_label()}</p>
              <p className='mt-1 whitespace-pre-wrap text-sm text-text-primary'>
                {dispute.description}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className='island-shell rounded-2xl p-6'>
            <h2 className='mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary'>
              <MessageSquare size={18} aria-hidden='true' />
              {m.dispute_messages_title()}
            </h2>

            {dispute.messages.length === 0 ? (
              <p className='py-8 text-center text-sm text-text-secondary'>
                {m.dispute_messages_empty()}
              </p>
            ) : (
              <ul className='space-y-4' aria-label={m.dispute_messages_title()}>
                {dispute.messages.map((msg) => (
                  <li
                    key={msg.id}
                    className='rounded-xl border border-border-default bg-surface-default p-4'
                  >
                    <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                      <span className='text-sm font-semibold text-text-primary'>
                        {msg.senderName}
                      </span>
                      <time
                        className='text-xs text-text-muted'
                        dateTime={msg.createdAt.toISOString()}
                        title={formatDate(msg.createdAt)}
                      >
                        {formatDate(msg.createdAt)}
                      </time>
                    </div>
                    <p className='whitespace-pre-wrap text-sm text-text-secondary'>{msg.message}</p>
                  </li>
                ))}
              </ul>
            )}

            {/* Message Input */}
            {canPostMessage && (
              <div className='mt-6 border-t border-border-default pt-4'>
                {submitError && (
                  <p className='mb-2 text-sm text-error' role='alert'>
                    {submitError}
                  </p>
                )}
                <div className='flex items-end gap-2'>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={m.dispute_message_placeholder()}
                    rows={3}
                    maxLength={5000}
                    disabled={isSubmitting}
                    className='min-h-[5rem] flex-1 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50 resize-none'
                    aria-label={m.dispute_message_placeholder()}
                  />
                  <Button
                    onClick={handleSubmit}
                    isLoading={isSubmitting}
                    disabled={!message.trim() || isSubmitting}
                    className='h-10 shrink-0'
                    aria-label={m.dispute_message_submit()}
                  >
                    <Send size={16} aria-hidden='true' />
                    <span className='sr-only sm:not-sr-only'>{m.dispute_message_submit()}</span>
                  </Button>
                </div>
              </div>
            )}

            {dispute.status !== 'open' && (
              <div className='mt-6 rounded-lg bg-surface-inset p-4 text-center text-sm text-text-secondary'>
                {m.dispute_status()}: {dispute.status}
                {dispute.resolution && ` — ${dispute.resolution}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
