import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Ban, CheckCircle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import z from 'zod'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/cn'
import { guardRole } from '#/lib/route-guards'
import type { PaginatedShops, ShopListItem, SuspensionFilter } from '#/lib/shop-moderation'
import { listAllShops, moderateShop } from '#/lib/shop-moderation'
import { m } from '#/paraglide/messages'

/* -------------------------------------------------------------------------- */
/*                              Route Definition                              */
/* -------------------------------------------------------------------------- */

const shopsSearchSchema = z.object({
  filter: z.enum(['all', 'active', 'suspended']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

export const Route = createFileRoute('/admin/shops')({
  beforeLoad: async () => guardRole('admin'),
  validateSearch: shopsSearchSchema,
  loaderDeps: ({ search: { filter, page, pageSize } }) => ({
    filter: filter as SuspensionFilter,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    return listAllShops({
      data: {
        filter: deps.filter,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
  },
  head: () => ({
    meta: [{ title: 'Shops | Admin | Eurtisan' }],
  }),
  component: AdminShopsPage,
  pendingComponent: AdminShopsPending,
  errorComponent: AdminShopsError,
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZES = [10, 20, 50] as const

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

const FILTER_LABELS: Record<SuspensionFilter, string> = {
  all: m.admin_shops_filter_all(),
  active: m.admin_shops_filter_active(),
  suspended: m.admin_shops_filter_suspended(),
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminShopsPage() {
  const initialData = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  const [shops, setShops] = useState<PaginatedShops>(initialData)

  // --- Action state ---
  const [actionShopId, setActionShopId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<ShopListItem | null>(null)
  const [moderationNote, setModerationNote] = useState('')
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)

  // --- Refs for stale-closure safety ---
  const searchRef = useRef(search)
  searchRef.current = search
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Cleanup success message timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  /* ---- Navigation helpers ---- */
  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number>) => {
      navigate({
        to: '/admin/shops',
        search: { ...search, ...overrides },
        replace: true,
      })
    },
    [navigate, search],
  )

  const handleFilterChange = useCallback(
    (filter: SuspensionFilter) => {
      navigateWithParams({ filter, page: 1 })
    },
    [navigateWithParams],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      navigateWithParams({ page })
    },
    [navigateWithParams],
  )

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      navigateWithParams({ pageSize, page: 1 })
    },
    [navigateWithParams],
  )

  /* ---- Suspend dialog ---- */
  const openSuspendDialog = useCallback((shop: ShopListItem) => {
    setSuspendTarget(shop)
    setModerationNote('')
    setActionError(null)
    setNoteDialogOpen(true)
  }, [])

  const closeSuspendDialog = useCallback(() => {
    setNoteDialogOpen(false)
    setSuspendTarget(null)
    setModerationNote('')
  }, [])

  /* ---- Perform action ---- */
  const performAction = useCallback(
    async (shopId: string, action: 'suspend' | 'unsuspend', note?: string) => {
      setActionShopId(shopId)
      setActionError(null)
      setSuccessMessage(null)

      try {
        const result = await moderateShop({
          data: { shopId, action, note },
        })

        const currentFilter = searchRef.current.filter

        // If the new status no longer matches the active filter, remove it
        // from the local list instead of just updating it in place.
        if (currentFilter !== 'all') {
          const matchesFilter =
            (currentFilter === 'active' && !result.isSuspended) ||
            (currentFilter === 'suspended' && result.isSuspended)

          if (!matchesFilter) {
            setShops((prev) => ({
              ...prev,
              total: prev.total - 1,
              shops: prev.shops.filter((s) => s.id !== shopId),
            }))
            // do NOT call setShops for the normal update below
          } else {
            // Status still matches — update in place
            setShops((prev) => ({
              ...prev,
              shops: prev.shops.map((s) =>
                s.id === shopId
                  ? {
                      ...s,
                      isSuspended: result.isSuspended,
                      moderationNote: result.moderationNote,
                    }
                  : s,
              ),
            }))
          }
        } else {
          // "all" filter — always update in place
          setShops((prev) => ({
            ...prev,
            shops: prev.shops.map((s) =>
              s.id === shopId
                ? {
                    ...s,
                    isSuspended: result.isSuspended,
                    moderationNote: result.moderationNote,
                  }
                : s,
            ),
          }))
        }

        setSuccessMessage(
          result.isSuspended
            ? m.admin_shops_suspended_success({ name: result.name })
            : m.admin_shops_unsuspended_success({ name: result.name }),
        )

        // Clear previous timer and schedule new dismissal
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : m.admin_shops_action_error())
      } finally {
        setActionShopId(null)
      }
    },
    [], // stable — uses refs for mutable data (search, timer)
  )

  const handleSuspendConfirm = useCallback(async () => {
    if (!suspendTarget) return
    const note = moderationNote.trim() || undefined
    await performAction(suspendTarget.id, 'suspend', note)
    closeSuspendDialog()
  }, [suspendTarget, moderationNote, performAction, closeSuspendDialog])

  const handleUnsuspend = useCallback(
    (shopId: string) => {
      performAction(shopId, 'unsuspend')
    },
    [performAction],
  )

  /* ---- Compute pagination ---- */
  const totalPages = Math.max(1, Math.ceil(shops.total / shops.pageSize))

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl space-y-6'>
        {/* Header */}
        <div>
          <h1 className='display-title text-3xl font-bold text-text-primary'>
            {m.admin_shops_title()}
          </h1>
          <p className='mt-1 text-text-secondary'>{m.admin_shops_description()}</p>
        </div>

        {/* Success / Error feedback */}
        {successMessage && (
          <div
            role='status'
            className='island-shell rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success'
          >
            <CheckCircle size={16} className='mr-2 inline-block' aria-hidden='true' />
            {successMessage}
          </div>
        )}

        {actionError && (
          <div
            role='alert'
            className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
          >
            <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
            {actionError}
            <button
              type='button'
              onClick={() => setActionError(null)}
              className='ml-2 underline hover:no-underline'
            >
              {m.admin_shops_dismiss()}
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div
          className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
          role='tablist'
          aria-label={m.admin_shops_filter_label()}
        >
          {(['all', 'active', 'suspended'] as SuspensionFilter[]).map((filter) => {
            const isSelected = search.filter === filter
            return (
              <button
                key={filter}
                type='button'
                role='tab'
                aria-selected={isSelected}
                onClick={() => handleFilterChange(filter)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-surface-default text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {FILTER_LABELS[filter]}
              </button>
            )
          })}
        </div>

        {/* Table */}
        {shops.shops.length === 0 ? (
          <Card variant='elevated'>
            <CardContent className='p-8 text-center'>
              <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
              <p className='text-text-secondary'>{m.admin_shops_empty()}</p>
            </CardContent>
          </Card>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-border-default'>
                  <th className='pb-3 pr-4 font-medium text-text-secondary'>
                    {m.admin_shops_col_name()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary hidden sm:table-cell'>
                    {m.admin_shops_col_owner()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary'>
                    {m.admin_shops_col_status()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary hidden lg:table-cell'>
                    {m.admin_shops_col_note()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary hidden md:table-cell'>
                    {m.admin_shops_col_created()}
                  </th>
                  <th className='pb-3 font-medium text-text-secondary text-right'>
                    <span className='sr-only'>{m.admin_shops_col_actions()}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shops.shops.map((shop) => {
                  const isProcessing = actionShopId === shop.id

                  return (
                    <tr
                      key={shop.id}
                      className='border-b border-border-subtle transition-colors hover:bg-bg-inset'
                    >
                      {/* Shop name */}
                      <td className='py-3 pr-4'>
                        <div>
                          <p className='font-medium text-text-primary'>{shop.name}</p>
                          <p className='text-xs text-text-muted sm:hidden'>{shop.ownerName}</p>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className='py-3 pr-4 hidden sm:table-cell'>
                        <div>
                          <p className='text-text-primary'>{shop.ownerName}</p>
                          <p className='text-xs text-text-muted'>{shop.ownerEmail}</p>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className='py-3 pr-4'>
                        <div className='flex flex-col gap-1'>
                          <Badge variant={shop.isSuspended ? 'error' : 'success'}>
                            {shop.isSuspended
                              ? m.admin_shops_status_suspended()
                              : m.admin_shops_status_active()}
                          </Badge>
                          <span className='text-xs text-text-muted'>{shop.status}</span>
                        </div>
                      </td>

                      {/* Moderation note */}
                      <td className='py-3 pr-4 hidden lg:table-cell'>
                        <span className='text-text-secondary line-clamp-2 max-w-xs'>
                          {shop.moderationNote ?? '—'}
                        </span>
                      </td>

                      {/* Creation date */}
                      <td className='py-3 pr-4 hidden md:table-cell'>
                        <span className='text-text-secondary'>{formatDate(shop.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className='py-3 text-right'>
                        {shop.isSuspended ? (
                          <Button
                            variant='secondary'
                            size='sm'
                            onClick={() => handleUnsuspend(shop.id)}
                            disabled={isProcessing}
                            isLoading={isProcessing}
                            aria-label={m.admin_shops_unsuspend_aria({ name: shop.name })}
                          >
                            <CheckCircle size={14} aria-hidden='true' />
                            {m.admin_shops_unsuspend()}
                          </Button>
                        ) : (
                          <Button
                            variant='danger'
                            size='sm'
                            onClick={() => openSuspendDialog(shop)}
                            disabled={isProcessing}
                            aria-label={m.admin_shops_suspend_aria({ name: shop.name })}
                          >
                            <Ban size={14} aria-hidden='true' />
                            {m.admin_shops_suspend()}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {shops.shops.length > 0 && (
          <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
            <div className='flex items-center gap-3'>
              <p className='text-sm text-text-secondary'>
                {m.admin_shops_showing({
                  from: (shops.page - 1) * shops.pageSize + 1,
                  to: Math.min(shops.page * shops.pageSize, shops.total),
                  total: shops.total,
                })}
              </p>
              <select
                value={shops.pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className='h-8 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary'
                aria-label={m.admin_shops_page_size_label()}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {totalPages > 1 && (
              <nav className='flex items-center gap-4' aria-label={m.admin_shops_pagination()}>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={shops.page <= 1}
                  onClick={() => handlePageChange(shops.page - 1)}
                  aria-label={m.pagination_previous()}
                >
                  <ChevronLeft size={16} aria-hidden='true' />
                  {m.pagination_previous()}
                </Button>
                <span className='text-sm text-text-secondary'>
                  {m.pagination_page_of({ page: shops.page, totalPages })}
                </span>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={shops.page >= totalPages}
                  onClick={() => handlePageChange(shops.page + 1)}
                  aria-label={m.pagination_next()}
                >
                  {m.pagination_next()}
                  <ChevronRight size={16} aria-hidden='true' />
                </Button>
              </nav>
            )}
          </div>
        )}

        {/* Suspend confirmation dialog */}
        {noteDialogOpen && suspendTarget && (
          <div
            className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
            role='dialog'
            aria-modal='true'
            aria-labelledby='suspend-dialog-title'
            onClick={closeSuspendDialog}
          >
            <div
              className='island-shell mx-4 w-full max-w-md rounded-2xl p-6 shadow-xl'
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id='suspend-dialog-title'
                className='mb-2 text-lg font-semibold text-text-primary'
              >
                {m.admin_shops_suspend_dialog_title({ name: suspendTarget.name })}
              </h2>
              <p className='mb-4 text-sm text-text-secondary'>
                {m.admin_shops_suspend_dialog_description()}
              </p>

              <label
                htmlFor='moderation-note'
                className='mb-1.5 block text-sm font-medium text-text-secondary'
              >
                {m.admin_shops_suspend_note_label()}
              </label>
              <textarea
                id='moderation-note'
                value={moderationNote}
                onChange={(e) => setModerationNote(e.target.value)}
                rows={3}
                maxLength={2000}
                className='mb-4 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                placeholder={m.admin_shops_suspend_note_placeholder()}
              />
              <p className='-mt-3 mb-4 text-xs text-text-muted'>
                {m.admin_shops_suspend_note_optional()}
              </p>

              <div className='flex justify-end gap-3'>
                <Button variant='secondary' onClick={closeSuspendDialog}>
                  {m.admin_shops_cancel()}
                </Button>
                <Button
                  variant='danger'
                  onClick={handleSuspendConfirm}
                  isLoading={actionShopId === suspendTarget.id}
                >
                  {m.admin_shops_confirm_suspend()}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

function AdminShopsPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl space-y-6'>
        <div>
          <Skeleton className='mb-2 h-9 w-64' />
          <Skeleton className='h-5 w-80' />
        </div>

        {/* Filter tabs skeleton */}
        <Skeleton className='h-10 w-72 rounded-lg' />

        {/* Table skeleton */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-border-default'>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <th key={n} className='pb-3 pr-4'>
                    <Skeleton className='h-4 w-20' />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row} className='border-b border-border-subtle'>
                  {[1, 2, 3, 4, 5, 6].map((col) => (
                    <td key={col} className='py-3 pr-4'>
                      <Skeleton className='h-5 w-24' />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Error State                                 */
/* -------------------------------------------------------------------------- */

function AdminShopsError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl text-center'>
        <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
        <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
          {m.admin_shops_error_load()}
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
        {reset && (
          <Button variant='secondary' onClick={reset}>
            {m.admin_shops_error_retry()}
          </Button>
        )}
      </div>
    </main>
  )
}
