import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { m } from '#/paraglide/messages'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Defaults to a generic "Confirm". Use a verb naming the action. */
  confirmLabel?: string
  /** Styles the confirm button as destructive. */
  destructive?: boolean
  /** Disables the confirm button while the action is in flight. */
  busy?: boolean
  onConfirm: () => void
}

/**
 * Confirmation dialog for destructive actions.
 *
 * Replaces `window.confirm`, which cannot be styled, ignores the design system,
 * renders inconsistently across browsers, and — on some platforms — is
 * suppressible in a way that silently returns `false`. Building on the dialog
 * primitive also gives focus trapping and Escape handling for free.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='w-full max-w-md p-6'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='mt-2'>{description}</DialogDescription>

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
              variant={destructive ? 'danger' : 'primary'}
              disabled={busy}
              onClick={onConfirm}
            >
              {confirmLabel ?? m.confirm_dialog_confirm()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
