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

export interface ReportSellerReplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy?: boolean
  error?: string | null
  onSubmit: (reason: ReviewReportReason, details: string | null) => void
}

const REASONS: { value: ReviewReportReason; label: () => string }[] = [
  { value: 'not_authentic', label: () => m.seller_reply_report_reason_not_authentic() },
  { value: 'offensive', label: () => m.review_report_reason_offensive() },
  { value: 'spam', label: () => m.review_report_reason_spam() },
  { value: 'personal_data', label: () => m.review_report_reason_personal_data() },
  { value: 'other', label: () => m.review_report_reason_other() },
]

export function ReportSellerReplyDialog({
  open,
  onOpenChange,
  busy = false,
  error = null,
  onSubmit,
}: ReportSellerReplyDialogProps) {
  const [reason, setReason] = useState<ReviewReportReason>('not_authentic')
  const [details, setDetails] = useState('')
  const groupId = useId()
  const detailsId = useId()
  const detailsRequired = reason === 'other'
  const canSubmit = !busy && (!detailsRequired || details.trim().length > 0)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && busy) return
    if (!nextOpen) {
      setReason('not_authentic')
      setDetails('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='w-full max-w-md p-6'>
          <DialogTitle>{m.seller_reply_report_title()}</DialogTitle>
          <DialogDescription className='mt-2'>
            {m.seller_reply_report_description()}
          </DialogDescription>

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
              {m.seller_reply_report_details_label()}
            </Label>
            <Textarea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={2000}
              className='mt-1'
              placeholder={m.seller_reply_report_details_placeholder()}
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
              onClick={() => handleOpenChange(false)}
            >
              {m.confirm_dialog_cancel()}
            </Button>
            <Button
              type='button'
              variant='primary'
              isLoading={busy}
              disabled={!canSubmit}
              onClick={() => onSubmit(reason, details.trim() === '' ? null : details.trim())}
            >
              {m.seller_reply_report_submit()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
