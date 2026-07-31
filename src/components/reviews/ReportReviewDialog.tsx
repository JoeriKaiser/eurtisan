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
import type { ReviewReportReason } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'

export interface ReportReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy?: boolean
  error?: string | null
  onSubmit: (reason: ReviewReportReason, details: string | null) => void
}

/**
 * Order matters: authenticity first, because it is the ground
 * C. consom. L.111-7-2 obliges us to offer a free route for, and the one a
 * buyer is most likely to be acting on.
 */
const REASONS: { value: ReviewReportReason; label: () => string }[] = [
  { value: 'not_authentic', label: () => m.review_report_reason_not_authentic() },
  { value: 'offensive', label: () => m.review_report_reason_offensive() },
  { value: 'spam', label: () => m.review_report_reason_spam() },
  { value: 'personal_data', label: () => m.review_report_reason_personal_data() },
  { value: 'other', label: () => m.review_report_reason_other() },
]

/**
 * Collects a ground and an explanation before a review is reported.
 *
 * The button used to submit a bare review id, and the server flipped the review
 * to `flagged` on the spot. DSA Article 16(2) requires a notice to carry a
 * sufficiently substantiated explanation of why the reporter believes the
 * content is illegal, which a single click cannot express — and the ground is
 * what a later Article 17(3)(b) statement of reasons has to cite.
 *
 * `other` requires the free-text field, since the label alone substantiates
 * nothing.
 */
export function ReportReviewDialog({
  open,
  onOpenChange,
  busy = false,
  error = null,
  onSubmit,
}: ReportReviewDialogProps) {
  const [reason, setReason] = useState<ReviewReportReason>('not_authentic')
  const [details, setDetails] = useState('')
  const groupId = useId()
  const detailsId = useId()

  const detailsRequired = reason === 'other'
  const canSubmit = !busy && (!detailsRequired || details.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='w-full max-w-md p-6'>
          <DialogTitle>{m.review_report_title()}</DialogTitle>
          <DialogDescription className='mt-2'>{m.review_report_description()}</DialogDescription>

          <fieldset className='mt-5 border-0 p-0'>
            <legend className='mb-2 text-sm font-medium text-text-primary'>
              {m.review_report_reason_label()}
            </legend>
            <div className='space-y-2'>
              {REASONS.map((option) => (
                <label
                  key={option.value}
                  className='flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary'
                >
                  <input
                    type='radio'
                    name={groupId}
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    className='size-4 accent-accent-primary'
                  />
                  {option.label()}
                </label>
              ))}
            </div>
          </fieldset>

          <div className='mt-4'>
            <Label htmlFor={detailsId} required={detailsRequired}>
              {m.review_report_details_label()}
            </Label>
            <Textarea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={2000}
              className='mt-1'
              placeholder={m.review_report_details_placeholder()}
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
              variant='primary'
              disabled={!canSubmit}
              onClick={() => onSubmit(reason, details.trim() === '' ? null : details.trim())}
            >
              {m.review_report_submit()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
