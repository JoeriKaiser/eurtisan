import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  Inbox,
  Search,
  Store,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import z from 'zod'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { cn } from '#/lib/cn'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import type { PaginatedShops, ShopListItem, SuspensionFilter } from '#/lib/shop-moderation'
import { listAllShops, moderateShop as moderateShopStatus } from '#/lib/shop-moderation'
import {
  getShopDraft,
  getShopDraftListings,
  getShopsForModeration,
  moderateShop as moderateShopApplication,
  type ShopDraft,
} from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

export interface ApplicationListItem {
  id: string
  name: string
  slug: string
  image: string | null
  status:
    | 'draft'
    | 'pending_review'
    | 'changes_requested'
    | 'approved'
    | 'active'
    | 'rejected'
    | 'suspended'
  ownerId: string
  ownerName: string | null
  ownerEmail: string | null
  submittedAt: Date | null
  resubmissionCount: number | null
  paymentConnected: boolean | null
  createdAt: Date
}

export interface AppListing {
  id: string
  name: string
  description: string | null
  priceCents: number
  stockCount: number
  imageCount: number
  thumbnailUrl: string | null
}

/* -------------------------------------------------------------------------- */
/*                              Route Definition                              */
/* -------------------------------------------------------------------------- */

const shopsSearchSchema = z.object({
  view: z.enum(['moderation', 'applications']).optional().default('moderation'),
  filter: z.enum(['all', 'active', 'suspended']).optional().default('all'),
  status: z
    .enum(['all', 'pending_review', 'changes_requested', 'approved', 'rejected'])
    .optional()
    .default('all'),
  query: z.string().optional().default(''),
  sortBy: z.enum(['name', 'createdAt', 'status']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

type LoaderResult =
  | { view: 'moderation'; shops: PaginatedShops }
  | { view: 'applications'; applications: ApplicationListItem[] }

export const Route = createFileRoute('/admin/shops')({
  validateSearch: shopsSearchSchema,
  loaderDeps: ({ search: { view, filter, status, query, sortBy, sortDir, page, pageSize } }) => ({
    view,
    filter,
    status,
    query,
    sortBy,
    sortDir,
    page,
    pageSize,
  }),
  loader: async ({ deps }): Promise<LoaderResult> => {
    if (deps.view === 'applications') {
      const applications = await getShopsForModeration({
        data: { status: deps.status },
      })
      return { view: 'applications', applications }
    }
    const shops = await listAllShops({
      data: {
        filter: deps.filter,
        query: deps.query || undefined,
        sortBy: deps.sortBy,
        sortDir: deps.sortDir,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
    return { view: 'moderation', shops }
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

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

const FILTER_LABELS: Record<SuspensionFilter, string> = {
  all: m.admin_shops_filter_all(),
  active: m.admin_shops_filter_active(),
  suspended: m.admin_shops_filter_suspended(),
}

const STATUS_LABELS: Record<string, string> = {
  all: m.admin_shops_filter_all(),
  pending_review: m.admin_shops_filter_pending(),
  changes_requested: m.admin_shops_filter_changes(),
  approved: m.admin_shops_filter_approved(),
  rejected: m.admin_shops_filter_rejected(),
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminShopsPage() {
  const loaderData = Route.useLoaderData() as LoaderResult
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  // --- List States ---
  const [shops, setShops] = useState<PaginatedShops>(() => {
    return loaderData.view === 'moderation'
      ? loaderData.shops
      : { shops: [], total: 0, page: 1, pageSize: 20 }
  })
  const [applications, setApplications] = useState<ApplicationListItem[]>(() => {
    return loaderData.view === 'applications' ? loaderData.applications : []
  })

  // --- Action state ---
  const [actionShopId, setActionShopId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<ShopListItem | null>(null)
  const [moderationNote, setModerationNote] = useState('')
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)

  // --- Detailed Application Review State ---
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [appDetails, setAppDetails] = useState<ShopDraft | null>(null)
  const [appListings, setAppListings] = useState<AppListing[] | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isProcessingApplication, setIsProcessingApplication] = useState(false)
  const [applicationActionType, setApplicationActionType] = useState<
    'approve' | 'request_changes' | 'reject' | null
  >(null)

  // --- Search state ---
  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Sync state with loader data changes
  useEffect(() => {
    if (loaderData.view === 'moderation') {
      setShops(loaderData.shops)
    } else {
      setApplications(loaderData.applications)
    }
  }, [loaderData])

  // Load detailed application data when opened
  useEffect(() => {
    if (!selectedAppId) {
      setAppDetails(null)
      setAppListings(null)
      return
    }

    setIsLoadingDetails(true)
    setActionError(null)

    Promise.all([
      getShopDraft({ data: { draftId: selectedAppId } }),
      getShopDraftListings({ data: { shopId: selectedAppId } }),
    ])
      .then(([details, listings]) => {
        setAppDetails(details)
        setAppListings(listings.products || [])
      })
      .catch((err) => {
        setActionError(err instanceof Error ? err.message : 'Failed to load details')
        setSelectedAppId(null)
      })
      .finally(() => {
        setIsLoadingDetails(false)
      })
  }, [selectedAppId])

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

  const handleStatusFilterChange = useCallback(
    (status: string) => {
      navigateWithParams({ status, page: 1 })
    },
    [navigateWithParams],
  )

  const handleSearch = useCallback(() => {
    const trimmed = searchValue.trim()
    navigateWithParams({ query: trimmed, page: 1 })
  }, [searchValue, navigateWithParams])

  const handleClearSearch = useCallback(() => {
    setSearchValue('')
    navigateWithParams({ query: '', page: 1 })
    searchInputRef.current?.focus()
  }, [navigateWithParams])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch],
  )

  const handleSort = useCallback(
    (column: string) => {
      const currentSortBy = search.sortBy ?? 'createdAt'
      const currentSortDir = search.sortDir ?? 'desc'
      if (currentSortBy === column) {
        navigateWithParams({ sortDir: currentSortDir === 'asc' ? 'desc' : 'asc', page: 1 })
      } else {
        navigateWithParams({ sortBy: column, sortDir: 'asc', page: 1 })
      }
    },
    [navigateWithParams, search.sortBy, search.sortDir],
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

  /* ---- Perform suspension status action ---- */
  const performSuspensionAction = useCallback(
    async (shopId: string, action: 'suspend' | 'unsuspend', note?: string) => {
      setActionShopId(shopId)
      setActionError(null)
      setSuccessMessage(null)

      try {
        const result = await moderateShopStatus({
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
          } else {
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
    [],
  )

  const handleSuspendConfirm = useCallback(async () => {
    if (!suspendTarget) return
    const note = moderationNote.trim() || undefined
    await performSuspensionAction(suspendTarget.id, 'suspend', note)
    closeSuspendDialog()
  }, [suspendTarget, moderationNote, performSuspensionAction, closeSuspendDialog])

  const handleUnsuspend = useCallback(
    (shopId: string) => {
      performSuspensionAction(shopId, 'unsuspend')
    },
    [performSuspensionAction],
  )

  /* ---- Perform onboarding review action ---- */
  const handleReviewAction = async (action: 'approve' | 'request_changes' | 'reject') => {
    if (!selectedAppId) return
    const note = moderationNote.trim()

    if ((action === 'request_changes' || action === 'reject') && !note) {
      setActionError(m.admin_shops_review_note_required())
      return
    }

    setIsProcessingApplication(true)
    setApplicationActionType(action)
    setActionError(null)

    try {
      const result = await moderateShopApplication({
        data: { shopId: selectedAppId, action, note: note || undefined },
      })

      const currentStatusFilter = searchRef.current.status

      if (currentStatusFilter !== 'all' && currentStatusFilter !== result.status) {
        setApplications((prev) => prev.filter((app) => app.id !== selectedAppId))
      } else {
        setApplications((prev) =>
          prev.map((app) =>
            app.id === selectedAppId
              ? { ...app, status: result.status as ApplicationListItem['status'] }
              : app,
          ),
        )
      }

      setSuccessMessage(m.admin_shops_review_success({ status: STATUS_LABELS[result.status] }))
      setSelectedAppId(null)

      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : m.admin_shops_action_error())
    } finally {
      setIsProcessingApplication(false)
      setApplicationActionType(null)
    }
  }

  /* ---- Compute pagination ---- */
  const isModerationView = search.view !== 'applications'
  const totalPages = isModerationView ? Math.max(1, Math.ceil(shops.total / shops.pageSize)) : 1

  const SortHeader = ({ column, children }: { column: string; children: React.ReactNode }) => {
    const isSorted = search.sortBy === column
    const dir = search.sortDir ?? 'desc'
    return (
      <button
        type='button'
        onClick={() => handleSort(column)}
        className='flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer'
      >
        {children}
        {isSorted && (
          <span className='text-text-muted'>
            {dir === 'asc' ? (
              <ChevronLeft size={14} className='rotate-90' />
            ) : (
              <ChevronLeft size={14} className='-rotate-90' />
            )}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-bold text-text-primary'>
          {m.admin_shops_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_shops_description()}</p>
      </div>

      {/* View Toggle Tabs */}
      <div className='border-b border-border-default pb-px flex gap-6' role='tablist'>
        <button
          type='button'
          role='tab'
          aria-selected={isModerationView}
          onClick={() => {
            navigate({
              to: '/admin/shops',
              search: { ...search, view: 'moderation', page: 1 },
              replace: true,
            })
          }}
          className={cn(
            'border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none cursor-pointer',
            isModerationView
              ? 'border-accent-primary text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary',
          )}
        >
          {m.admin_shops_view_moderation()}
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={!isModerationView}
          onClick={() => {
            navigate({
              to: '/admin/shops',
              search: { ...search, view: 'applications', page: 1 },
              replace: true,
            })
          }}
          className={cn(
            'border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none cursor-pointer',
            !isModerationView
              ? 'border-accent-primary text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary',
          )}
        >
          {m.admin_shops_view_applications()}
        </button>
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
            className='ml-2 underline hover:no-underline cursor-pointer'
          >
            {m.admin_shops_dismiss()}
          </button>
        </div>
      )}

      {/* Search bar (moderation view only) */}
      {isModerationView && (
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
              placeholder={m.admin_shops_search_placeholder()}
              className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
              aria-label={m.admin_shops_search_placeholder()}
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
        </div>
      )}

      {/* Filters Panel */}
      {isModerationView ? (
        /* Moderation filters */
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
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
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
      ) : (
        /* Application filters */
        <div
          className='flex flex-wrap gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
          role='tablist'
          aria-label={m.admin_shops_filter_label()}
        >
          {['all', 'pending_review', 'changes_requested', 'approved', 'rejected'].map((status) => {
            const isSelected = search.status === status
            return (
              <button
                key={status}
                type='button'
                role='tab'
                aria-selected={isSelected}
                onClick={() => handleStatusFilterChange(status)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-surface-default text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {STATUS_LABELS[status]}
              </button>
            )
          })}
        </div>
      )}

      {/* Content Table / Card */}
      {isModerationView ? (
        /* Registered Shops Table */
        shops.shops.length === 0 ? (
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
                  <th className='pb-3 pr-4'>
                    <SortHeader column='name'>{m.admin_shops_col_name()}</SortHeader>
                  </th>
                  <th className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_shops_col_owner()}
                  </th>
                  <th className='pb-3 pr-4'>
                    <SortHeader column='status'>{m.admin_shops_col_status()}</SortHeader>
                  </th>
                  <th className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_shops_col_note()}
                  </th>
                  <th className='pb-3 pr-4'>
                    <SortHeader column='createdAt'>{m.admin_shops_col_created()}</SortHeader>
                  </th>
                  <th className='pb-3 text-right font-semibold text-text-secondary'>
                    {m.admin_shops_col_actions()}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border-subtle'>
                {shops.shops.map((shop) => {
                  const isProcessing = actionShopId === shop.id
                  return (
                    <tr key={shop.id} className='group hover:bg-bg-inset/40 transition-colors'>
                      {/* Name */}
                      <td className='py-3 pr-4 font-medium text-text-primary'>
                        <div className='flex items-center gap-3'>
                          <div className='h-8 w-8 rounded-full bg-surface-inset border border-border-subtle flex items-center justify-center text-text-muted flex-shrink-0'>
                            <Store size={14} aria-hidden='true' />
                          </div>
                          <div className='flex flex-col min-w-0'>
                            <span className='truncate font-semibold'>{shop.name}</span>
                            <span className='font-mono text-xs text-text-muted truncate'>
                              /{shop.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner info */}
                      <td className='py-3 pr-4 text-text-primary'>
                        <div className='flex flex-col min-w-0 max-w-[200px]'>
                          <span className='truncate font-medium'>{shop.ownerName}</span>
                          <span className='truncate text-xs text-text-muted'>
                            {shop.ownerEmail}
                          </span>
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
                          <span className='text-xs text-text-muted font-mono'>{shop.status}</span>
                        </div>
                      </td>

                      {/* Moderation note */}
                      <td className='py-3 pr-4 text-text-secondary max-w-xs truncate'>
                        {shop.moderationNote || <span className='text-text-muted'>—</span>}
                      </td>

                      {/* Created At */}
                      <td className='py-3 pr-4 text-text-secondary font-mono text-xs'>
                        {formatDate(shop.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className='py-3 text-right whitespace-nowrap'>
                        {shop.isSuspended ? (
                          <Button
                            variant='secondary'
                            size='sm'
                            onClick={() => handleUnsuspend(shop.id)}
                            disabled={isProcessing}
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
        )
      ) : /* Onboarding Applications Table */
      applications.length === 0 ? (
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
                <th className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_shops_col_name()}
                </th>
                <th className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_shops_col_owner()}
                </th>
                <th className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_shops_col_status()}
                </th>
                <th className='pb-3 pr-4 font-semibold text-text-secondary'>Resubmissions</th>
                <th className='pb-3 pr-4 font-semibold text-text-secondary'>Submitted At</th>
                <th className='pb-3 text-right font-semibold text-text-secondary'>
                  {m.admin_shops_col_actions()}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border-subtle'>
              {applications.map((app) => (
                <tr key={app.id} className='group hover:bg-bg-inset/40 transition-colors'>
                  {/* Name */}
                  <td className='py-3 pr-4 font-medium text-text-primary'>
                    <div className='flex items-center gap-3'>
                      {app.image ? (
                        <div className='h-8 w-8 rounded-full overflow-hidden border border-border-default bg-surface-default flex-shrink-0'>
                          <img src={app.image} alt='' className='h-full w-full object-cover' />
                        </div>
                      ) : (
                        <div className='h-8 w-8 rounded-full bg-surface-inset border border-border-subtle flex items-center justify-center text-text-muted flex-shrink-0'>
                          <Store size={14} aria-hidden='true' />
                        </div>
                      )}
                      <div className='flex flex-col min-w-0'>
                        <span className='truncate font-semibold'>{app.name}</span>
                        <span className='font-mono text-xs text-text-muted truncate'>
                          /{app.slug}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Creator Owner */}
                  <td className='py-3 pr-4 text-text-primary'>
                    <div className='flex flex-col min-w-0 max-w-[200px]'>
                      <span className='truncate font-medium'>{app.ownerName}</span>
                      <span className='truncate text-xs text-text-muted'>{app.ownerEmail}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className='py-3 pr-4'>
                    <Badge
                      variant={
                        app.status === 'approved'
                          ? 'success'
                          : app.status === 'pending_review'
                            ? 'warning'
                            : app.status === 'changes_requested'
                              ? 'outline'
                              : 'error'
                      }
                    >
                      {STATUS_LABELS[app.status]}
                    </Badge>
                  </td>

                  {/* Resubmissions */}
                  <td className='py-3 pr-4 text-text-secondary font-mono'>
                    {app.resubmissionCount || 0}
                  </td>

                  {/* Submitted At */}
                  <td className='py-3 pr-4 text-text-secondary font-mono text-xs'>
                    {app.submittedAt ? formatDate(app.submittedAt) : '—'}
                  </td>

                  {/* Actions */}
                  <td className='py-3 text-right whitespace-nowrap'>
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => {
                        setSelectedAppId(app.id)
                        setModerationNote('')
                      }}
                      aria-label={m.admin_shops_review_details()}
                    >
                      {m.admin_shops_review_details()}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination (Moderation view only) */}
      {isModerationView && shops.shops.length > 0 && (
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
              className='h-8 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none cursor-pointer'
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
              <span className='text-sm text-text-secondary font-mono'>
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

      {/* Suspend Confirmation Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='max-w-md'>
            <DialogTitle>
              {suspendTarget
                ? m.admin_shops_suspend_dialog_title({ name: suspendTarget.name })
                : ''}
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
              value={moderationNote}
              onChange={(e) => setModerationNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className='mb-2 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
              placeholder={m.admin_shops_suspend_note_placeholder()}
            />
            <p className='mb-4 text-xs text-text-muted'>{m.admin_shops_suspend_note_optional()}</p>

            <div className='flex justify-end gap-3'>
              <Button variant='secondary' onClick={closeSuspendDialog}>
                {m.admin_shops_cancel()}
              </Button>
              <Button
                variant='danger'
                onClick={handleSuspendConfirm}
                isLoading={!!suspendTarget && actionShopId === suspendTarget.id}
              >
                {m.admin_shops_confirm_suspend()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>

      {/* Detailed Application Review Dialog */}
      <Dialog open={!!selectedAppId} onOpenChange={(open) => !open && setSelectedAppId(null)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0'>
            <div className='flex items-center justify-between border-b border-border-subtle px-6 py-4 flex-shrink-0'>
              <DialogTitle className='text-xl'>
                {isLoadingDetails || !appDetails
                  ? m.admin_shops_review_details()
                  : m.admin_shops_application_details_title({ name: appDetails.name })}
              </DialogTitle>
              <button
                type='button'
                onClick={() => setSelectedAppId(null)}
                className='rounded p-1 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                aria-label={m.admin_shops_cancel()}
              >
                <X size={18} />
              </button>
            </div>

            <div className='overflow-y-auto flex-1 min-h-0 px-6 py-4'>
              {isLoadingDetails || !appDetails ? (
                <div className='space-y-6 py-4'>
                  <Skeleton className='h-8 w-2/3' />
                  <Skeleton className='h-32 w-full rounded-xl' />
                  <Skeleton className='h-32 w-full rounded-xl' />
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-6 py-2'>
                  {/* Shop details columns */}
                  <div className='md:col-span-2 space-y-6'>
                    {/* Identity */}
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-text-muted'>
                        {m.admin_shops_application_section_identity()}
                      </h3>
                      <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
                        <div>
                          <p className='text-xs text-text-muted'>{m.admin_shops_col_name()}</p>
                          <p className='text-sm font-semibold text-text-primary'>
                            {appDetails.name}
                          </p>
                        </div>
                        <div>
                          <p className='text-xs text-text-muted'>Slug</p>
                          <p className='text-sm font-mono text-text-primary'>
                            /shops/{appDetails.slug}
                          </p>
                        </div>
                        {appDetails.tagline && (
                          <div>
                            <p className='text-xs text-text-muted'>
                              {m.admin_shops_application_field_tagline()}
                            </p>
                            <p className='text-sm text-text-primary'>{appDetails.tagline}</p>
                          </div>
                        )}
                        {appDetails.category && (
                          <div>
                            <p className='text-xs text-text-muted'>
                              {m.admin_shops_application_field_category()}
                            </p>
                            <Badge variant='secondary' className='mt-0.5'>
                              {appDetails.category}
                            </Badge>
                          </div>
                        )}
                        {appDetails.tags.length > 0 && (
                          <div>
                            <p className='text-xs text-text-muted'>
                              {m.admin_shops_application_field_tags()}
                            </p>
                            <div className='flex flex-wrap gap-1 mt-1'>
                              {appDetails.tags.map((t: string) => (
                                <Badge key={t} variant='outline'>
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Story */}
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-text-muted'>
                        {m.admin_shops_application_section_story()}
                      </h3>
                      <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
                        <div>
                          <p className='text-xs text-text-muted'>
                            {m.admin_shops_application_field_desc()}
                          </p>
                          <p className='text-sm text-text-primary whitespace-pre-wrap leading-relaxed max-w-[65ch] mt-0.5'>
                            {appDetails.description || '—'}
                          </p>
                        </div>
                        {appDetails.languages.length > 0 && (
                          <div>
                            <p className='text-xs text-text-muted'>Languages</p>
                            <p className='text-sm text-text-primary mt-0.5'>
                              {appDetails.languages.join(', ')}
                            </p>
                          </div>
                        )}
                        {appDetails.socials && appDetails.socials.length > 0 && (
                          <div>
                            <p className='text-xs text-text-muted'>
                              {m.admin_shops_application_field_socials()}
                            </p>
                            <div className='flex flex-col gap-1.5 mt-1'>
                              {appDetails.socials.map(
                                (s: { id: string; platform: string; url: string }) => (
                                  <a
                                    key={s.id}
                                    href={s.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-xs text-accent-primary hover:underline flex items-center gap-1 w-fit'
                                  >
                                    <Globe size={12} className='text-text-muted' />
                                    <span className='font-mono'>
                                      {s.platform}: {s.url}
                                    </span>
                                    <ExternalLink size={10} />
                                  </a>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Visuals */}
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-text-muted'>
                        {m.admin_shops_application_section_visuals()}
                      </h3>
                      <div className='bg-surface-inset rounded-xl p-4 space-y-4 border border-border-subtle'>
                        <div className='flex gap-4 items-center'>
                          {appDetails.image ? (
                            <div className='w-16 h-16 rounded-full overflow-hidden border border-border-default bg-surface-default flex-shrink-0 shadow-sm'>
                              <img
                                src={appDetails.image}
                                alt='Logo'
                                className='w-full h-full object-cover'
                              />
                            </div>
                          ) : (
                            <div className='w-16 h-16 rounded-full bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-xs flex-shrink-0'>
                              No Logo
                            </div>
                          )}
                          <div>
                            <p className='text-xs text-text-muted'>Shop Logo / Avatar</p>
                            <p className='text-xs text-text-secondary'>
                              Displayed on public profiles.
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className='text-xs text-text-muted mb-1.5'>Banner Image</p>
                          {appDetails.bannerImage ? (
                            <div className='h-32 w-full rounded-lg overflow-hidden border border-border-default bg-surface-default shadow-sm'>
                              <img
                                src={appDetails.bannerImage}
                                alt='Banner'
                                className='w-full h-full object-cover'
                              />
                            </div>
                          ) : (
                            <div className='h-20 w-full rounded-lg bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-sm shadow-inner'>
                              No Banner Image
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Policies */}
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-text-muted'>
                        {m.admin_shops_application_section_policies()}
                      </h3>
                      <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
                        {appDetails.shippingOrigin && (
                          <div>
                            <p className='text-xs text-text-muted'>
                              {m.admin_shops_application_field_shipping()}
                            </p>
                            <p className='text-sm font-semibold text-text-primary mt-0.5'>
                              {[
                                appDetails.shippingOrigin.city,
                                appDetails.shippingOrigin.state,
                                appDetails.shippingOrigin.country,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                              {appDetails.shippingOrigin.postalCode &&
                                ` (${appDetails.shippingOrigin.postalCode})`}
                            </p>
                            <p className='text-xs text-text-secondary mt-1'>
                              Processing time:{' '}
                              <span className='font-mono'>
                                {appDetails.shippingOrigin.processingTimeDays?.min}–
                                {appDetails.shippingOrigin.processingTimeDays?.max}
                              </span>{' '}
                              days
                              {appDetails.shippingOrigin.shipsInternational
                                ? ' (Ships Internationally)'
                                : ' (Domestic shipping only)'}
                            </p>
                          </div>
                        )}
                        {appDetails.policies && (
                          <div className='pt-2 border-t border-border-subtle/50 space-y-2'>
                            <p className='text-xs text-text-muted'>
                              {m.admin_shops_application_field_policies()}
                            </p>
                            <div className='text-sm text-text-primary space-y-2'>
                              <div>
                                <span className='font-semibold text-text-secondary text-xs block'>
                                  Returns
                                </span>
                                {appDetails.policies.returns?.accepted
                                  ? `Accepted within ${appDetails.policies.returns.windowDays} days`
                                  : 'Not accepted'}
                                {appDetails.policies.returns?.conditions && (
                                  <p className='text-xs text-text-secondary bg-surface-default p-2 rounded border border-border-subtle mt-1 italic'>
                                    "{appDetails.policies.returns.conditions}"
                                  </p>
                                )}
                              </div>
                              <div>
                                <span className='font-semibold text-text-secondary text-xs block'>
                                  Exchanges
                                </span>
                                {appDetails.policies.exchanges?.accepted
                                  ? 'Accepted'
                                  : 'Not accepted'}
                                {appDetails.policies.exchanges?.conditions && (
                                  <p className='text-xs text-text-secondary bg-surface-default p-2 rounded border border-border-subtle mt-1 italic'>
                                    "{appDetails.policies.exchanges.conditions}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Product Listing */}
                    <div className='space-y-2'>
                      <h3 className='text-xs font-bold uppercase tracking-wider text-text-muted'>
                        {m.admin_shops_application_section_product()}
                      </h3>
                      <div className='bg-surface-inset rounded-xl p-4 border border-border-subtle'>
                        {appListings && appListings.length > 0 ? (
                          appListings.map((listing) => (
                            <div key={listing.id} className='space-y-3'>
                              <div className='flex gap-4 items-start'>
                                {listing.imageCount > 0 ? (
                                  <div className='w-20 h-20 rounded-lg overflow-hidden border border-border-default bg-surface-default flex-shrink-0 shadow-sm'>
                                    <img
                                      src={listing.thumbnailUrl || '/placeholder.png'}
                                      alt={listing.name}
                                      className='w-full h-full object-cover'
                                    />
                                  </div>
                                ) : (
                                  <div className='w-20 h-20 rounded-lg bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-xs flex-shrink-0'>
                                    No Image
                                  </div>
                                )}
                                <div className='flex-1 min-w-0'>
                                  <p className='font-semibold text-text-primary'>{listing.name}</p>
                                  <p className='text-xs text-text-secondary mt-1 line-clamp-2'>
                                    {listing.description || 'No description'}
                                  </p>
                                  <div className='flex gap-4 mt-2 text-xs'>
                                    <span className='text-text-muted'>
                                      {m.admin_shops_application_field_price()}:{' '}
                                      <span className='font-mono font-semibold text-text-primary'>
                                        {formatPrice(listing.priceCents)}
                                      </span>
                                    </span>
                                    <span className='text-text-muted'>
                                      {m.admin_shops_application_field_stock()}:{' '}
                                      <span className='font-mono font-semibold text-text-primary'>
                                        {listing.stockCount}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className='text-sm text-text-muted'>
                            {m.admin_shops_application_no_listings()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions sidebar */}
                  <div className='md:col-span-1'>
                    <div className='sticky top-4 space-y-4'>
                      <div className='bg-surface-inset rounded-xl p-4 border border-border-subtle space-y-3'>
                        <h3 className='text-xs font-bold uppercase tracking-wider text-text-muted'>
                          Review Decision
                        </h3>
                        <Button
                          variant='primary'
                          className='w-full'
                          onClick={() => handleReviewAction('approve')}
                          isLoading={isProcessingApplication && applicationActionType === 'approve'}
                          disabled={isProcessingApplication}
                        >
                          <CheckCircle size={16} className='mr-1.5' />
                          {m.admin_shops_review_approve()}
                        </Button>
                        <Button
                          variant='secondary'
                          className='w-full'
                          onClick={() => handleReviewAction('request_changes')}
                          isLoading={
                            isProcessingApplication && applicationActionType === 'request_changes'
                          }
                          disabled={isProcessingApplication}
                        >
                          {m.admin_shops_review_request_changes()}
                        </Button>
                        <Button
                          variant='danger'
                          className='w-full'
                          onClick={() => handleReviewAction('reject')}
                          isLoading={isProcessingApplication && applicationActionType === 'reject'}
                          disabled={isProcessingApplication}
                        >
                          {m.admin_shops_review_reject()}
                        </Button>
                      </div>

                      <div>
                        <label
                          htmlFor='review-note'
                          className='mb-1.5 block text-xs font-semibold text-text-secondary'
                        >
                          {m.admin_shops_review_note_label()}
                        </label>
                        <textarea
                          id='review-note'
                          value={moderationNote}
                          onChange={(e) => setModerationNote(e.target.value)}
                          rows={4}
                          maxLength={2000}
                          className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                          placeholder={m.admin_shops_review_note_placeholder()}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

function AdminShopsPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='mb-2 h-9 w-64' />
        <Skeleton className='h-5 w-80' />
      </div>

      <Skeleton className='h-10 w-48 rounded-lg' />
      <Skeleton className='h-10 w-full rounded-lg' />

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
  )
}

/* -------------------------------------------------------------------------- */
/*                                Error State                                 */
/* -------------------------------------------------------------------------- */

function AdminShopsError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className='text-center py-12'>
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
  )
}
