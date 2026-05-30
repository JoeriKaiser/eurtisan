import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle, Download, Inbox, Search, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import type { AdminUserListItem, PaginatedUsers } from '#/lib/admin-users'
import { banUser, unbanUser, updateUserRole } from '#/lib/admin-users'
import { cn } from '#/lib/cn'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { m } from '#/paraglide/messages'
import { BanDialog } from './users/BanDialog'
import { RoleDialog } from './users/RoleDialog'
import { UsersPagination } from './users/UsersPagination'
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

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSearch()
    },
    [handleSearch],
  )

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

      {status.successMessage && (
        <div className='island-shell rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success'>
          <CheckCircle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {status.successMessage}
        </div>
      )}

      {status.actionError && (
        <div
          role='alert'
          className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
        >
          <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {status.actionError}
          <button
            type='button'
            onClick={() => setStatus((prev) => ({ ...prev, actionError: null }))}
            className='ml-2 underline hover:no-underline cursor-pointer'
          >
            {m.admin_shops_dismiss()}
          </button>
        </div>
      )}

      {/* Search */}
      <div className='flex gap-2'>
        <div className='relative flex-1'>
          <Search
            size={18}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'
            aria-hidden='true'
          />
          <input
            ref={searchInputRef}
            type='text'
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={m.admin_users_search_placeholder()}
            className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            aria-label={m.admin_users_search_placeholder()}
          />
          {searchValue && (
            <button
              type='button'
              onClick={handleClearSearch}
              className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary transition-colors'
              aria-label={m.admin_orders_clear_search()}
            >
              <X size={16} aria-hidden='true' />
            </button>
          )}
        </div>
        <Button onClick={handleSearch} aria-label={m.admin_orders_search_button()}>
          {m.admin_orders_search_button()}
        </Button>
        <Button
          variant='secondary'
          onClick={handleExportCSV}
          aria-label={m.admin_common_export_csv()}
        >
          <Download size={16} aria-hidden='true' />
          {m.admin_common_export_csv()}
        </Button>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>{m.admin_users_role_filter()}</span>
          <select
            value={search.role ?? ''}
            onChange={(e) => navigateWithParams({ role: e.target.value || undefined, page: 1 })}
            className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          >
            <option value=''>{m.admin_users_role_all()}</option>
            <option value='customer'>{m.admin_users_role_customer()}</option>
            <option value='creator'>{m.admin_users_role_creator()}</option>
            <option value='admin'>{m.admin_users_role_admin()}</option>
          </select>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_users_status_filter()}
          </span>
          <div
            className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
            role='tablist'
          >
            {(['all', 'active', 'banned'] as const).map((statusTab) => {
              const isSelected = search.status === statusTab
              return (
                <button
                  key={statusTab}
                  type='button'
                  role='tab'
                  aria-selected={isSelected}
                  onClick={() => navigateWithParams({ status: statusTab, page: 1 })}
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

      {/* Table */}
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
