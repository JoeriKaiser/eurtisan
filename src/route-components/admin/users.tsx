import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Card, CardContent } from '#/components/ui/card'
import type { AdminUserListItem, PaginatedUsers } from '#/lib/admin-users'
import { banUser, unbanUser, updateUserRole } from '#/lib/admin-users'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { m } from '#/paraglide/messages'
import { BanDialog } from './users/BanDialog'
import { RoleDialog } from './users/RoleDialog'
import { UsersFilters } from './users/UsersFilters'
import { UsersPagination } from './users/UsersPagination'
import { UsersSearchBar } from './users/UsersSearchBar'
import { UsersStatusAlerts } from './users/UsersStatusAlerts'
import { UsersTable } from './users/UsersTable'

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminUsersPage() {
  const loaderData = useLoaderData({ from: '/admin/users' }) as PaginatedUsers
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/users' })

  const [users, setUsers] = useState(loaderData)
  const [status, setStatus] = useState({
    actionError: null as string | null,
    successMessage: null as string | null,
    isSubmitting: false,
  })
  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [dialogs, setDialogs] = useState({
    roleDialogUser: null as AdminUserListItem | null,
    selectedRole: 'customer',
    banDialogUser: null as AdminUserListItem | null,
    banReason: '',
  })

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      const cleaned: Record<string, string | number> = {}
      for (const [key, value] of Object.entries(overrides)) {
        if (value !== undefined) cleaned[key] = value
      }
      navigate({ to: '/admin/users', search: { ...search, ...cleaned }, replace: true })
    },
    [navigate, search],
  )

  const handleSearch = useCallback(() => {
    navigateWithParams({ query: searchValue.trim(), page: 1 })
  }, [searchValue, navigateWithParams])

  const handleClearSearch = useCallback(() => {
    setSearchValue('')
    navigateWithParams({ query: '', page: 1 })
    searchInputRef.current?.focus()
  }, [navigateWithParams])

  const handlePageChange = useCallback(
    (page: number) => navigateWithParams({ page }),
    [navigateWithParams],
  )
  const handlePageSizeChange = useCallback(
    (pageSize: number) => navigateWithParams({ pageSize, page: 1 }),
    [navigateWithParams],
  )

  const showSuccess = useCallback((message: string) => {
    setStatus((prev) => ({ ...prev, successMessage: message }))
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(
      () => setStatus((prev) => ({ ...prev, successMessage: null })),
      3000,
    )
  }, [])

  const handleRoleChange = useCallback(async () => {
    if (!dialogs.roleDialogUser) return
    setStatus((prev) => ({ ...prev, isSubmitting: true, actionError: null }))
    try {
      await updateUserRole({
        data: {
          userId: dialogs.roleDialogUser.id,
          role: dialogs.selectedRole as 'customer' | 'creator' | 'admin',
        },
      })
      setUsers((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === dialogs.roleDialogUser?.id ? { ...u, role: dialogs.selectedRole } : u,
        ),
      }))
      showSuccess(m.admin_users_role_changed_success({ name: dialogs.roleDialogUser.name }))
      setDialogs((prev) => ({ ...prev, roleDialogUser: null }))
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        actionError: err instanceof Error ? err.message : m.admin_users_action_error(),
      }))
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }))
    }
  }, [dialogs.roleDialogUser, dialogs.selectedRole, showSuccess])

  const handleBan = useCallback(async () => {
    if (!dialogs.banDialogUser) return
    setStatus((prev) => ({ ...prev, isSubmitting: true, actionError: null }))
    try {
      await banUser({
        data: { userId: dialogs.banDialogUser.id, reason: dialogs.banReason || undefined },
      })
      setUsers((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === dialogs.banDialogUser?.id
            ? { ...u, bannedAt: new Date(), banReason: dialogs.banReason || null }
            : u,
        ),
      }))
      showSuccess(m.admin_users_banned_success({ name: dialogs.banDialogUser.name }))
      setDialogs((prev) => ({ ...prev, banDialogUser: null, banReason: '' }))
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        actionError: err instanceof Error ? err.message : m.admin_users_action_error(),
      }))
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }))
    }
  }, [dialogs.banDialogUser, dialogs.banReason, showSuccess])

  const handleUnban = useCallback(
    async (userId: string, name: string) => {
      setStatus((prev) => ({ ...prev, actionError: null }))
      try {
        await unbanUser({ data: { userId } })
        setUsers((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, bannedAt: null, banReason: null } : u,
          ),
        }))
        showSuccess(m.admin_users_unbanned_success({ name }))
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          actionError: err instanceof Error ? err.message : m.admin_users_action_error(),
        }))
      }
    },
    [showSuccess],
  )

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(users.users, [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'shopCount', label: 'Shops' },
      { key: 'bannedAt', label: 'Banned' },
      { key: 'createdAt', label: 'Created At' },
    ])
    downloadCSV(csv, `users-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [users.users])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_users_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_users_description()}</p>
      </div>

      <UsersStatusAlerts
        successMessage={status.successMessage}
        actionError={status.actionError}
        onDismissError={() => setStatus((prev) => ({ ...prev, actionError: null }))}
      />

      <UsersSearchBar
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        searchInputRef={searchInputRef}
        onExportCSV={handleExportCSV}
      />

      <UsersFilters
        role={search.role}
        status={search.status}
        onRoleChange={(role) => navigateWithParams({ role: role || undefined, page: 1 })}
        onStatusChange={(statusTab) => navigateWithParams({ status: statusTab, page: 1 })}
      />

      {users.users.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>{m.admin_users_empty()}</p>
          </CardContent>
        </Card>
      ) : (
        <UsersTable
          users={users.users}
          onChangeRole={(u) =>
            setDialogs((prev) => ({ ...prev, roleDialogUser: u, selectedRole: u.role }))
          }
          onBan={(u) => setDialogs((prev) => ({ ...prev, banDialogUser: u, banReason: '' }))}
          onUnban={handleUnban}
        />
      )}

      {users.users.length > 0 && (
        <UsersPagination
          page={users.page}
          pageSize={users.pageSize}
          total={users.total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <RoleDialog
        user={dialogs.roleDialogUser}
        selectedRole={dialogs.selectedRole}
        onSelectedRoleChange={(role) => setDialogs((prev) => ({ ...prev, selectedRole: role }))}
        onClose={() => setDialogs((prev) => ({ ...prev, roleDialogUser: null }))}
        onConfirm={handleRoleChange}
        isSubmitting={status.isSubmitting}
      />

      <BanDialog
        user={dialogs.banDialogUser}
        banReason={dialogs.banReason}
        onBanReasonChange={(reason) => setDialogs((prev) => ({ ...prev, banReason: reason }))}
        onClose={() => setDialogs((prev) => ({ ...prev, banDialogUser: null }))}
        onConfirm={handleBan}
        isSubmitting={status.isSubmitting}
      />
    </div>
  )
}
