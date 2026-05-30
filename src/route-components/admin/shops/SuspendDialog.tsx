import { useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import type { ShopListItem } from '#/lib/shop-moderation'
import { m } from '#/paraglide/messages'

interface SuspendDialogProps {
  shop: ShopListItem | null
  onClose: () => void
  onConfirm: (note: string) => void
  isProcessing: boolean
}

export function SuspendDialog({ shop, onClose, onConfirm, isProcessing }: SuspendDialogProps) {
  const [note, setNote] = useState('')

  const handleClose = () => {
    setNote('')
    onClose()
  }

  const handleConfirm = () => {
    onConfirm(note.trim())
    setNote('')
  }

  return (
    <Dialog open={!!shop} onOpenChange={(open) => !open && handleClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md'>
          <DialogTitle>
            {shop ? m.admin_shops_suspend_dialog_title({ name: shop.name }) : ''}
          </DialogTitle>
          <DialogDescription>{m.admin_shops_suspend_dialog_description()}</DialogDescription>

          <label
            htmlFor='moderation-note'
            className='mb-1.5 mt-4 block text-sm font-semibold text-text-secondary'
          >
            {m.admin_shops_suspend_note_label()}
          </label>
          <textarea
            id='moderation-note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            className='mb-2 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            placeholder={m.admin_shops_suspend_note_placeholder()}
          />
          <p className='mb-4 text-xs text-text-muted'>{m.admin_shops_suspend_note_optional()}</p>

          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={handleClose}>
              {m.admin_shops_cancel()}
            </Button>
            <Button variant='danger' onClick={handleConfirm} isLoading={isProcessing}>
              {m.admin_shops_confirm_suspend()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
