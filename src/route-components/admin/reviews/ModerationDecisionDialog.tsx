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

export type ModerationStatus = 'approved' | 'flagged' | 'hidden'

export interface ModerationDecisionDialogProps {
  open: boolean
  status: ModerationStatus | null
  busy?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (ground: 'illegal' | 'terms', explanation: string) => void
}

/**
 * Collects the grounds a moderation decision has to be justified on.
 *
 * DSA Article 17(3) requires the statement of reasons sent to the author to say
 * which ground applies — the law (d) or the terms (e) — and to set out the facts
 * relied on (b). Neither can be inferred from the status alone, so both are
 * collected before the decision is applied rather than after.
 *
 * The explanation is sent verbatim to the review's author, which the dialog says
 * plainly: a moderator writing internal shorthand would otherwise be publishing
 * it to the person they are moderating.
 */
export function ModerationDecisionDialog({
  open,
  status,
  busy = false,
  error = null,
  onOpenChange,
  onConfirm,
}: ModerationDecisionDialogProps) {
  const [ground, setGround] = useState<'illegal' | 'terms'>('terms')
  const [explanation, setExplanation] = useState('')
  const groundName = useId()
  const explanationId = useId()

  const canSubmit = !busy && explanation.trim().length > 0

  const title =
    status === 'approved'
      ? m.admin_reviews_decision_title_restore()
      : m.admin_reviews_decision_title_restrict()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='w-full max-w-md p-6'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='mt-2'>
            {m.admin_reviews_decision_description()}
          </DialogDescription>

          <fieldset className='mt-5 border-0 p-0'>
            <legend className='mb-2 text-sm font-medium text-text-primary'>
              {m.admin_reviews_decision_ground_label()}
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
                    checked={ground === value}
                    onChange={() => setGround(value)}
                    className='size-4 accent-accent-primary'
                  />
                  {value === 'terms'
                    ? m.admin_reviews_decision_ground_terms()
                    : m.admin_reviews_decision_ground_illegal()}
                </label>
              ))}
            </div>
          </fieldset>

          <div className='mt-4'>
            <Label htmlFor={explanationId} required>
              {m.admin_reviews_decision_explanation_label()}
            </Label>
            <p className='mt-1 text-xs text-text-muted'>
              {m.admin_reviews_decision_explanation_hint()}
            </p>
            <Textarea
              id={explanationId}
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
              variant={status === 'approved' ? 'primary' : 'danger'}
              disabled={!canSubmit}
              onClick={() => onConfirm(ground, explanation.trim())}
            >
              {m.admin_reviews_decision_submit()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
