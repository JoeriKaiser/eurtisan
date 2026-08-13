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

interface RoleDialogProps {
  user: AdminUserListItem | null
  selectedRole: string
  onSelectedRoleChange: (role: string) => void
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
}

export function RoleDialog({
  user,
  selectedRole,
  onSelectedRoleChange,
  onClose,
  onConfirm,
  isSubmitting,
}: RoleDialogProps) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md'>
          <DialogTitle>{m.admin_users_role_dialog_title()}</DialogTitle>
          <DialogDescription>{m.admin_users_role_dialog_description()}</DialogDescription>

          <div className='mt-4'>
            <label
              htmlFor='role-select'
              className='mb-1.5 block text-sm font-semibold text-text-secondary'
            >
              {m.admin_users_role_label()}
            </label>
            <select
              id='role-select'
              value={selectedRole}
              onChange={(e) => onSelectedRoleChange(e.target.value)}
              className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 text-sm text-text-primary focus-visible:outline-none'
            >
              <option value='customer'>{m.admin_users_role_customer()}</option>
              <option value='creator'>{m.admin_users_role_creator()}</option>
              <option value='admin'>{m.admin_users_role_admin()}</option>
            </select>
          </div>

          <div className='mt-6 flex justify-end gap-3'>
            <Button variant='secondary' onClick={onClose}>
              {m.admin_common_cancel()}
            </Button>
            <Button onClick={onConfirm} isLoading={isSubmitting}>
              {m.admin_common_confirm()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
