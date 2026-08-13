import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import type { AdminCategoryItem } from '#/lib/admin-categories'
import { m } from '#/paraglide/messages'

interface DeleteDialogProps {
  target: AdminCategoryItem | null
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteDialog({ target, onClose, onConfirm, isDeleting }: DeleteDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md'>
          <DialogTitle>{m.admin_categories_delete_title({ name: target?.name ?? '' })}</DialogTitle>
          <DialogDescription>{m.admin_categories_delete_description()}</DialogDescription>

          <div className='mt-6 flex justify-end gap-3'>
            <Button variant='secondary' onClick={onClose}>
              {m.admin_common_cancel()}
            </Button>
            <Button variant='danger' onClick={onConfirm} isLoading={isDeleting}>
              {m.admin_categories_delete_confirm()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
