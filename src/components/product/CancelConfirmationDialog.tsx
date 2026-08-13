import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'

interface CancelConfirmationDialogProps {
  open: boolean
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}

export function CancelConfirmationDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: CancelConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-sm'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <div className='mt-6 flex justify-end gap-3'>
            <Button variant='secondary' onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant='danger' onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
