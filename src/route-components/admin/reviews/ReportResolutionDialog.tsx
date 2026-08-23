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
import type { ListingReportResolutionOutcome } from '#/lib/listing-reports/types'
import { m } from '#/paraglide/messages'

export interface ReportResolutionDialogProps {
  open: boolean
  outcome: ListingReportResolutionOutcome
  busy?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (outcome: ListingReportResolutionOutcome, note: string) => void
}

/**
 * Records an admin decision on a listing or shop notice.
 *
 * The outcome is fixed by the button that opened this dialog and restated in
 * its title; what the moderator contributes here is the note — the words that
 * stay on the report as its audit trail. The decision is final once recorded
 * (the server refuses to overwrite it), so both are collected before anything
 * is sent.
 */
export function ReportResolutionDialog({
  open,
  outcome,
  busy = false,
  error = null,
  onOpenChange,
  onConfirm,
}: ReportResolutionDialogProps) {
  const [note, setNote] = useState('')
  const noteId = useId()

  const canSubmit = !busy && note.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='w-full max-w-md p-6'>
          <DialogTitle>
            {outcome === 'actioned'
              ? m.listing_report_admin_resolve_title_actioned()
              : m.listing_report_admin_resolve_title_dismissed()}
          </DialogTitle>
          <DialogDescription className='mt-2'>
            {m.listing_report_admin_resolve_description()}
          </DialogDescription>

          <div className='mt-4'>
            <Label htmlFor={noteId} required>
              {m.listing_report_admin_note_label()}
            </Label>
            <Textarea
              id={noteId}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              className='mt-1'
              placeholder={m.listing_report_admin_note_hint()}
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
              onClick={() => onConfirm(outcome, note.trim())}
            >
              {m.listing_report_admin_resolve_submit()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
