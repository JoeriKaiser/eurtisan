import { User, UserCheck, UserX } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { AdminUserListItem, PaginatedUsers } from '#/lib/admin-users'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'
import { formatDateMedium } from '#/lib/format-date'

function formatDate(date: Date | string): string {
  return formatDateMedium(new Date(date))
}

interface UsersTableProps {
  users: PaginatedUsers['users']
  onChangeRole: (user: AdminUserListItem) => void
  onBan: (user: AdminUserListItem) => void
  onUnban: (userId: string, name: string) => void
}

export function UsersTable({ users, onChangeRole, onBan, onUnban }: UsersTableProps) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_users_col_name()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_users_col_email()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_users_col_role()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_users_col_shops()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_users_col_created()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_users_col_status()}
            </th>
            <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
              {m.admin_common_actions()}
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {users.map((u) => (
            <tr key={u.id} className='group hover:bg-bg-inset/40 transition-colors'>
              <td className='py-3 pr-4'>
                <div className='flex items-center gap-3'>
                  <div className='flex size-6 items-center justify-center rounded-full bg-surface-inset border border-border-subtle flex-shrink-0'>
                    {u.bannedAt ? (
                      <UserX size={14} className='text-error' aria-hidden='true' />
                    ) : (
                      <User size={14} className='text-text-muted' aria-hidden='true' />
                    )}
                  </div>
                  <span className='font-medium text-text-primary'>{u.name}</span>
                </div>
              </td>
              <td className='py-3 pr-4 text-text-primary'>{u.email}</td>
              <td className='py-3 pr-4'>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                    u.role === 'admin'
                      ? 'bg-accent-primary/10 text-accent-primary border-accent-primary/20'
                      : u.role === 'creator'
                        ? 'bg-accent-secondary/10 text-accent-secondary border-accent-secondary/20'
                        : 'bg-surface-inset text-text-secondary border-border-default',
                  )}
                >
                  {u.role}
                </span>
              </td>
              <td className='py-3 pr-4 text-text-secondary'>{u.shopCount}</td>
              <td className='py-3 pr-4 text-text-secondary font-mono text-xs'>
                {formatDate(u.createdAt)}
              </td>
              <td className='py-3 pr-4'>
                {u.bannedAt ? (
                  <span className='inline-flex items-center gap-1 text-xs font-medium text-error'>
                    <UserCheck size={12} aria-hidden='true' />
                    {m.admin_users_status_banned()}
                  </span>
                ) : (
                  <span className='inline-flex items-center gap-1 text-xs font-medium text-success'>
                    <UserCheck size={12} aria-hidden='true' />
                    {m.admin_users_status_active()}
                  </span>
                )}
              </td>
              <td className='py-3 text-right whitespace-nowrap'>
                <div className='flex items-center justify-end gap-2'>
                  <Button variant='secondary' size='sm' onClick={() => onChangeRole(u)}>
                    {m.admin_users_change_role()}
                  </Button>
                  {u.bannedAt ? (
                    <Button variant='primary' size='sm' onClick={() => onUnban(u.id, u.name)}>
                      {m.admin_users_unban()}
                    </Button>
                  ) : (
                    <Button variant='danger' size='sm' onClick={() => onBan(u)}>
                      {m.admin_users_ban()}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
