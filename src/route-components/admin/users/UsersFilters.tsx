import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'

interface UsersFiltersProps {
  role: string | undefined
  status: string | undefined
  onRoleChange: (role: string) => void
  onStatusChange: (status: 'all' | 'active' | 'banned') => void
}

export function UsersFilters({ role, status, onRoleChange, onStatusChange }: UsersFiltersProps) {
  return (
    <div className='flex flex-wrap items-end gap-3'>
      <div className='flex flex-col gap-1'>
        <span className='text-xs font-medium text-text-muted'>{m.admin_users_role_filter()}</span>
        <select
          value={role ?? ''}
          onChange={(e) => onRoleChange(e.target.value)}
          className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
        >
          <option value=''>{m.admin_users_role_all()}</option>
          <option value='customer'>{m.admin_users_role_customer()}</option>
          <option value='creator'>{m.admin_users_role_creator()}</option>
          <option value='admin'>{m.admin_users_role_admin()}</option>
        </select>
      </div>

      <div className='flex flex-col gap-1'>
        <span className='text-xs font-medium text-text-muted'>{m.admin_users_status_filter()}</span>
        <div
          className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
          role='tablist'
        >
          {(['all', 'active', 'banned'] as const).map((statusTab) => {
            const isSelected = status === statusTab
            return (
              <button
                key={statusTab}
                type='button'
                role='tab'
                aria-selected={isSelected}
                onClick={() => onStatusChange(statusTab)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-surface-default text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {statusTab === 'all'
                  ? m.admin_users_status_all()
                  : statusTab === 'active'
                    ? m.admin_users_status_active()
                    : m.admin_users_status_banned()}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
