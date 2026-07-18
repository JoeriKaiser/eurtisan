import { CheckCircle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

interface ReviewActionsPanelProps {
  note: string
  onNoteChange: (note: string) => void
  stage: number
  onStageChange: (stage: number) => void
  onAction: (action: 'approve' | 'request_changes' | 'reject') => void
  isProcessing: boolean
  actionType: 'approve' | 'request_changes' | 'reject' | null
}

export function ReviewActionsPanel({
  note,
  onNoteChange,
  stage,
  onStageChange,
  onAction,
  isProcessing,
  actionType,
}: ReviewActionsPanelProps) {
  return (
    <div className='rounded-2xl border border-border-default bg-surface-inset p-5 lg:sticky lg:top-0'>
      <div>
        <h3 className='text-base font-semibold text-text-primary'>
          {m.admin_shops_review_decision_title()}
        </h3>
        <p className='mt-1 text-sm leading-relaxed text-text-secondary'>
          {m.admin_shops_review_decision_description()}
        </p>
      </div>

      <div className='mt-5 space-y-4'>
        <div>
          <label
            htmlFor='review-stage'
            className='mb-1.5 block text-sm font-semibold text-text-primary'
          >
            {m.admin_shops_review_stage_label()}
          </label>
          <select
            id='review-stage'
            value={stage}
            onChange={(event) => onStageChange(Number(event.target.value))}
            className='h-11 w-full rounded-xl border border-border-default bg-surface-default px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
          >
            <option value={1}>{m.onboarding_stage_profile()}</option>
            <option value={2}>{m.onboarding_stage_seller()}</option>
            <option value={3}>{m.onboarding_stage_product()}</option>
            <option value={4}>{m.onboarding_stage_delivery()}</option>
          </select>
        </div>

        <div>
          <label
            htmlFor='review-note'
            className='mb-1.5 block text-sm font-semibold text-text-primary'
          >
            {m.admin_shops_review_note_label()}
          </label>
          <textarea
            id='review-note'
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={4}
            maxLength={2000}
            aria-describedby='review-note-help'
            className='w-full resize-y rounded-xl border border-border-default bg-surface-default px-3 py-2.5 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            placeholder={m.admin_shops_review_note_placeholder()}
          />
          <p id='review-note-help' className='mt-1.5 text-xs leading-relaxed text-text-muted'>
            {m.admin_shops_review_note_help()}
          </p>
        </div>
      </div>

      <div className='mt-6 space-y-2 border-t border-border-default pt-5'>
        <Button
          variant='primary'
          className='w-full'
          onClick={() => onAction('approve')}
          isLoading={isProcessing && actionType === 'approve'}
          disabled={isProcessing}
        >
          <CheckCircle size={16} aria-hidden='true' />
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
    </div>
  )
}
