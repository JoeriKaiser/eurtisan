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
import type { ListingReportReason, ListingReportTargetType } from '#/lib/listing-reports/types'
import { m } from '#/paraglide/messages'

export interface ReportListingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What the notice is about; only the wording adapts, the grounds are shared. */
  targetType: ListingReportTargetType
  busy?: boolean
  error?: string | null
  onSubmit: (reason: ListingReportReason, details: string | null) => void
}

/**
 * Marketplace-violation grounds, most actionable first and `other` last:
 * DSA Article 16(2) requires a notice to carry a sufficiently substantiated
 * explanation, and a bare "something else" substantiates nothing — which is
 * why it forces the free-text field.
 */
const REASONS: { value: ListingReportReason; label: () => string }[] = [
  { value: 'counterfeit', label: () => m.listing_report_reason_counterfeit() },
  { value: 'unsafe', label: () => m.listing_report_reason_unsafe() },
  { value: 'illegal_goods', label: () => m.listing_report_reason_illegal_goods() },
  { value: 'fraud', label: () => m.listing_report_reason_fraud() },
  { value: 'other', label: () => m.listing_report_reason_other() },
]

/**
 * Collects a ground and an explanation before a product or shop is reported,
 * mirroring `ReportReviewDialog`. The notice is recorded for admin triage;
 * nothing about the listing changes until a person decides.
 */
export function ReportListingDialog({
  open,
  onOpenChange,
  targetType,
  busy = false,
  error = null,
  onSubmit,
}: ReportListingDialogProps) {
  const [reason, setReason] = useState<ListingReportReason>('counterfeit')
  const [details, setDetails] = useState('')
  const groupId = useId()
  const detailsId = useId()

  const title =
    targetType === 'shop' ? m.listing_report_title_shop() : m.listing_report_title_product()
  const description =
    targetType === 'shop'
      ? m.listing_report_description_shop()
      : m.listing_report_description_product()

  const detailsRequired = reason === 'other'
  const canSubmit = !busy && (!detailsRequired || details.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='w-full max-w-md p-6'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='mt-2'>{description}</DialogDescription>

          <fieldset className='mt-5 border-0 p-0'>
            <legend className='mb-2 text-sm font-medium text-text-primary'>
              {m.listing_report_reason_label()}
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
              {m.listing_report_details_label()}
            </Label>
            <Textarea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              maxLength={2000}
              className='mt-1'
              placeholder={m.listing_report_details_placeholder()}
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
              {m.listing_report_submit()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
