import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { addDisputeMessage } from '#/lib/disputes'

export function AdminMessageInput({
  disputeId,
  onMessageSent,
}: {
  disputeId: string
  onMessageSent: () => void
}) {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState({
    isSubmitting: false,
    error: null as string | null,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || status.isSubmitting) return

    setStatus({ isSubmitting: true, error: null })

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
          setStatus((prev) => ({ ...prev, error: body.message || 'Failed to send message' }))
        } catch {
          setStatus((prev) => ({ ...prev, error: 'Failed to send message' }))
        }
      } else if (err instanceof Error) {
        setStatus((prev) => ({ ...prev, error: err.message }))
      } else {
        setStatus((prev) => ({ ...prev, error: 'An unexpected error occurred' }))
      }
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className='mt-4 border-t border-border-default pt-4'>
      {status.error && (
        <div className='mb-3 rounded-lg bg-error/10 p-3 text-sm text-error' role='alert'>
          {status.error}
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
        disabled={status.isSubmitting}
        className='min-h-[5rem] w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50 resize-none'
        aria-label='Admin message'
      />
      <div className='mt-2 flex items-center justify-between'>
        <span className='text-xs text-text-muted'>{message.length} / 5000</span>
        <Button
          type='submit'
          isLoading={status.isSubmitting}
          disabled={!message.trim() || status.isSubmitting}
        >
          <Send size={16} aria-hidden='true' />
          Send
        </Button>
      </div>
    </form>
  )
}
