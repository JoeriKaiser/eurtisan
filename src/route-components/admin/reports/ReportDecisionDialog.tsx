import { useId, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { Textarea } from '#/components/ui/textarea'
import { m } from '#/paraglide/messages'

export interface ReportDecisionDialogProps {
  open: boolean
  content: 'product' | 'shop'
  busy?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (ground: 'illegal' | 'terms', explanation: string) => void
}

export function ReportDecisionDialog({
  open,
  content,
  busy = false,
  error = null,
  onOpenChange,
  onConfirm,
}: ReportDecisionDialogProps) {
  const [ground, setGround] = useState<'illegal' | 'terms'>('terms')
  const [explanation, setExplanation] = useState('')
  const groundName = useId()
  const explanationId = useId()
  const explanationHintId = `${explanationId}-hint`

  const canSubmit = !busy && explanation.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='w-full max-w-md p-6'>
          <DialogTitle>
            {content === 'shop'
              ? m.admin_reports_decision_title_shop()
              : m.admin_reports_decision_title_product()}
          </DialogTitle>
          <DialogDescription className='mt-2'>
            {m.admin_reports_decision_description()}
          </DialogDescription>

          <fieldset className='mt-5 border-0 p-0'>
            <legend className='mb-2 text-sm font-medium text-text-primary'>
              {m.admin_reports_decision_ground_label()}
            </legend>
            <div className='space-y-2'>
              {(['terms', 'illegal'] as const).map((value) => (
                <label
                  key={value}
                  className='flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary'
                >
                  <input
                    type='radio'
                    name={groundName}
                    value={value}
                    required
                    disabled={busy}
                    checked={ground === value}
                    onChange={() => setGround(value)}
                    className='size-4 accent-accent-primary'
                  />
                  {value === 'terms'
                    ? m.admin_reports_decision_ground_terms()
                    : m.admin_reports_decision_ground_illegal()}
                </label>
              ))}
            </div>
          </fieldset>

          <div className='mt-4'>
            <Label htmlFor={explanationId} required>
              {m.admin_reports_decision_explanation_label()}
            </Label>
            <p id={explanationHintId} className='mt-1 text-xs text-text-muted'>
              {m.admin_reports_decision_explanation_hint()}
            </p>
            <Textarea
              id={explanationId}
              aria-describedby={explanationHintId}
              required
              disabled={busy}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={4}
              maxLength={2000}
              className='mt-1'
            />
          </div>

          {error && (
            <p className='mt-3 text-sm text-error' role='alert'>
              {error}
            </p>
          )}

          <div className='mt-6 flex justify-end gap-2'>
            <Button
              type='button'
              variant='secondary'
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {m.confirm_dialog_cancel()}
            </Button>
            <Button
              type='button'
              variant='danger'
              isLoading={busy}
              disabled={!canSubmit}
              onClick={() => onConfirm(ground, explanation.trim())}
            >
              {m.admin_reports_decision_submit()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
