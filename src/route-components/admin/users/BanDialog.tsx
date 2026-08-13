import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import type { AdminUserListItem } from '#/lib/admin-users'
import { m } from '#/paraglide/messages'

interface BanDialogProps {
  user: AdminUserListItem | null
  banReason: string
  onBanReasonChange: (reason: string) => void
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
}

export function BanDialog({
  user,
  banReason,
  onBanReasonChange,
  onClose,
  onConfirm,
  isSubmitting,
}: BanDialogProps) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md'>
          <DialogTitle>{m.admin_users_ban_dialog_title({ name: user?.name ?? '' })}</DialogTitle>
          <DialogDescription>{m.admin_users_ban_dialog_description()}</DialogDescription>

          <div className='mt-4'>
            <label
              htmlFor='ban-reason'
              className='mb-1.5 block text-sm font-semibold text-text-secondary'
            >
              {m.admin_users_ban_reason_label()}
            </label>
            <textarea
              id='ban-reason'
              value={banReason}
              onChange={(e) => onBanReasonChange(e.target.value)}
              rows={3}
              maxLength={2000}
              className='mb-2 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
              placeholder={m.admin_users_ban_reason_placeholder()}
            />
            <p className='text-xs text-text-muted'>{m.admin_users_ban_reason_optional()}</p>
          </div>

          <div className='mt-6 flex justify-end gap-3'>
            <Button variant='secondary' onClick={onClose}>
              {m.admin_common_cancel()}
            </Button>
            <Button variant='danger' onClick={onConfirm} isLoading={isSubmitting}>
              {m.admin_users_ban_confirm()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
