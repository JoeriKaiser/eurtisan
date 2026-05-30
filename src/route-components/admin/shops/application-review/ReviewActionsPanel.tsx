import { CheckCircle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

interface ReviewActionsPanelProps {
  note: string
  onNoteChange: (note: string) => void
  onAction: (action: 'approve' | 'request_changes' | 'reject') => void
  isProcessing: boolean
  actionType: 'approve' | 'request_changes' | 'reject' | null
}

export function ReviewActionsPanel({
  note,
  onNoteChange,
  onAction,
  isProcessing,
  actionType,
}: ReviewActionsPanelProps) {
  return (
    <div className='sticky top-4 space-y-4'>
      <div className='bg-surface-inset rounded-xl p-4 border border-border-subtle space-y-3'>
        <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
          Review Decision
        </h3>
        <Button
          variant='primary'
          className='w-full'
          onClick={() => onAction('approve')}
          isLoading={isProcessing && actionType === 'approve'}
          disabled={isProcessing}
        >
          <CheckCircle size={16} className='mr-1.5' />
          {m.admin_shops_review_approve()}
        </Button>
        <Button
          variant='secondary'
          className='w-full'
          onClick={() => onAction('request_changes')}
          isLoading={isProcessing && actionType === 'request_changes'}
          disabled={isProcessing}
        >
          {m.admin_shops_review_request_changes()}
        </Button>
        <Button
          variant='danger'
          className='w-full'
          onClick={() => onAction('reject')}
          isLoading={isProcessing && actionType === 'reject'}
          disabled={isProcessing}
        >
          {m.admin_shops_review_reject()}
        </Button>
      </div>

      <div>
        <label
          htmlFor='review-note'
          className='mb-1.5 block text-xs font-semibold text-text-secondary'
        >
          {m.admin_shops_review_note_label()}
        </label>
        <textarea
          id='review-note'
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={4}
          maxLength={2000}
          className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
          placeholder={m.admin_shops_review_note_placeholder()}
        />
      </div>
    </div>
  )
}
