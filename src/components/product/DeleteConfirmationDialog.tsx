import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'

interface DeleteConfirmationDialogProps {
  open: boolean
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmationDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-sm'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <div className='mt-6 flex justify-end gap-3'>
            <Button variant='secondary' onClick={onCancel} disabled={deleting}>
              {cancelLabel}
            </Button>
            <Button variant='danger' onClick={onConfirm} isLoading={deleting} disabled={deleting}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
