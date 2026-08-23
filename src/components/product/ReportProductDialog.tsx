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

export type ProductReportReason = 'illegal' | 'ip' | 'fraud' | 'offensive' | 'other'

export interface ReportProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  busy?: boolean
  error?: string | null
  onSubmit: (reason: ProductReportReason, details: string | null) => void
}

const REASONS: { value: ProductReportReason; label: () => string }[] = [
  { value: 'illegal', label: () => m.product_report_reason_illegal() },
  { value: 'ip', label: () => m.product_report_reason_ip() },
  { value: 'fraud', label: () => m.product_report_reason_fraud() },
  { value: 'offensive', label: () => m.product_report_reason_offensive() },
  { value: 'other', label: () => m.product_report_reason_other() },
]

/**
 * DSA Article 16 Notice and Action dialog for product listings.
 * Collects structured grounds and substantiated explanation before submission.
 */
export function ReportProductDialog({
  open,
  onOpenChange,
  productName: _productName,
  busy = false,
  error = null,
  onSubmit,
}: ReportProductDialogProps) {
  const [reason, setReason] = useState<ProductReportReason>('illegal')
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
          <DialogTitle>{m.product_report_title()}</DialogTitle>
          <DialogDescription className='mt-2'>{m.product_report_description()}</DialogDescription>

          <fieldset className='mt-5 border-0 p-0'>
            <legend className='mb-2 text-sm font-medium text-text-primary'>
              {m.product_report_reason_label()}
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
              {m.product_report_details_label()}
            </Label>
            <Textarea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={2000}
              className='mt-1'
              placeholder={m.product_report_details_placeholder()}
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
              {m.product_report_submit()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
