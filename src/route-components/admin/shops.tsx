import { useLoaderData, useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { moderateShop as moderateShopApplication } from '#/lib/sell-onboarding'
import type { PaginatedShops, ShopListItem, SuspensionFilter } from '#/lib/shop-moderation'
import { moderateShop as moderateShopStatus } from '#/lib/shop-moderation'
import { MAX_BULK_SELECTION } from '#/lib/admin-constants'
import { m } from '#/paraglide/messages'
import { ApplicationReviewDialog } from './shops/ApplicationReviewDialog'
import { ApplicationsTable } from './shops/ApplicationsTable'
import { BulkActionBar } from './shops/BulkActionBar'
import { FilterPanel } from './shops/FilterPanel'
import { PaginationControls } from './shops/PaginationControls'
import { ShopsSearchBar } from './shops/ShopsSearchBar'
import { ShopsTable } from './shops/ShopsTable'
import { StatusAlerts } from './shops/StatusAlerts'
import { SuspendDialog } from './shops/SuspendDialog'
import { ViewTabs } from './shops/ViewTabs'

interface ApplicationListItem {
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

/* -------------------------------------------------------------------------- */
type LoaderResult =
  | { view: 'moderation'; shops: PaginatedShops }
  | { view: 'applications'; applications: ApplicationListItem[] }

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

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
  const loaderData = useLoaderData({ from: '/admin/shops' }) as LoaderResult
  const search = useSearch({ from: '/admin/shops' })
  const rows =
    loaderData.view === 'moderation'
      ? loaderData.shops.shops.map((shop) => `${shop.id}:${shop.isSuspended}`)
      : loaderData.applications.map((application) => `${application.id}:${application.status}`)
  return <AdminShopsContent key={`${JSON.stringify(search)}:${rows.join(',')}`} />
}

function AdminShopsContent() {
  const loaderData = useLoaderData({ from: '/admin/shops' }) as LoaderResult
  const navigate = useNavigate()
  const router = useRouter()
  const search = useSearch({ from: '/admin/shops' })

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

  // --- Application Review State ---
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [isProcessingApplication, setIsProcessingApplication] = useState(false)
  const [applicationActionType, setApplicationActionType] = useState<
    'approve' | 'request_changes' | 'reject' | null
  >(null)

  // --- Search state ---
  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // --- Bulk action state ---
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<{
    current: number
    total: number
    action: string
  } | null>(null)

  // --- Refs for stale-closure safety ---
  const searchRef = useRef(search)
  searchRef.current = search

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

  const handleViewChange = useCallback(
    (view: 'moderation' | 'applications') => {
      navigate({
        to: '/admin/shops',
        search: { ...search, view, page: 1 },
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

  /* ---- Bulk actions ---- */
  const toggleShopSelection = useCallback((shopId: string) => {
    setSelectedShopIds((prev) => {
      const next = new Set(prev)
      if (next.has(shopId)) next.delete(shopId)
      else if (next.size < MAX_BULK_SELECTION) next.add(shopId)
      return next
    })
  }, [])

  const toggleAllShops = useCallback(() => {
    setSelectedShopIds((prev) => {
      if (prev.size === shops.shops.length) return new Set()
      return new Set(shops.shops.slice(0, MAX_BULK_SELECTION).map((s) => s.id))
    })
  }, [shops.shops])

  const handleBulkSuspend = useCallback(async () => {
    const ids = Array.from(selectedShopIds).slice(0, MAX_BULK_SELECTION)
    if (ids.length === 0) return
    setBulkProgress({ current: 0, total: ids.length, action: 'suspend' })
    setActionError(null)
    let processed = 0
    const updateProgress = () => {
      processed++
      setBulkProgress({ current: processed, total: ids.length, action: 'suspend' })
    }
    await Promise.all(
      ids.map(async (shopId) => {
        try {
          await moderateShopStatus({ data: { shopId, action: 'suspend' } })
        } catch {
          // Continue with remaining items
        } finally {
          updateProgress()
        }
      }),
    )
    setSelectedShopIds(new Set())
    setBulkProgress(null)
    navigateWithParams({ page: 1 })
  }, [selectedShopIds, navigateWithParams])

  const handleBulkUnsuspend = useCallback(async () => {
    const ids = Array.from(selectedShopIds).slice(0, MAX_BULK_SELECTION)
    if (ids.length === 0) return
    setBulkProgress({ current: 0, total: ids.length, action: 'unsuspend' })
    setActionError(null)
    let processed = 0
    const updateProgress = () => {
      processed++
      setBulkProgress({ current: processed, total: ids.length, action: 'unsuspend' })
    }
    await Promise.all(
      ids.map(async (shopId) => {
        try {
          await moderateShopStatus({ data: { shopId, action: 'unsuspend' } })
        } catch {
          // Continue with remaining items
        } finally {
          updateProgress()
        }
      }),
    )
    setSelectedShopIds(new Set())
    setBulkProgress(null)
    navigateWithParams({ page: 1 })
  }, [selectedShopIds, navigateWithParams])

  /* ---- Suspend dialog ---- */
  const openSuspendDialog = useCallback((shop: ShopListItem) => {
    setSuspendTarget(shop)
    setActionError(null)
  }, [])

  const closeSuspendDialog = useCallback(() => {
    setSuspendTarget(null)
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
      } catch (err) {
        setActionError(err instanceof Error ? err.message : m.admin_shops_action_error())
      } finally {
        setActionShopId(null)
      }
    },
    [],
  )

  const handleSuspendConfirm = useCallback(
    async (note: string) => {
      if (!suspendTarget) return
      await performSuspensionAction(suspendTarget.id, 'suspend', note || undefined)
      closeSuspendDialog()
    },
    [suspendTarget, performSuspensionAction, closeSuspendDialog],
  )

  const handleUnsuspend = useCallback(
    (shopId: string) => {
      performSuspensionAction(shopId, 'unsuspend')
    },
    [performSuspensionAction],
  )

  /* ---- Perform onboarding review action ---- */
  const handleReviewAction = async (
    action: 'approve' | 'request_changes' | 'reject',
    note: string,
    stage: number,
  ) => {
    if (!selectedAppId) return

    if ((action === 'request_changes' || action === 'reject') && !note) {
      setActionError(m.admin_shops_review_note_required())
      return
    }

    setIsProcessingApplication(true)
    setApplicationActionType(action)
    setActionError(null)

    try {
      const result = await moderateShopApplication({
        data: {
          shopId: selectedAppId,
          action,
          note: note || undefined,
          stage: action === 'request_changes' ? stage : undefined,
        },
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
      await router.invalidate()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : m.admin_shops_action_error())
    } finally {
      setIsProcessingApplication(false)
      setApplicationActionType(null)
    }
  }

  /* ---- Compute pagination ---- */
  const isModerationView = search.view !== 'applications'

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(shops.shops, [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'ownerName', label: 'Owner' },
      { key: 'ownerEmail', label: 'Owner Email' },
      { key: 'status', label: 'Status' },
      { key: 'isSuspended', label: 'Suspended' },
      { key: 'createdAt', label: 'Created At' },
    ])
    downloadCSV(csv, `shops-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [shops.shops])

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_shops_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_shops_description()}</p>
      </div>

      <ViewTabs isModerationView={isModerationView} onViewChange={handleViewChange} />

      <StatusAlerts
        successMessage={successMessage}
        actionError={actionError}
        onDismissError={() => setActionError(null)}
      />

      {isModerationView && (
        <ShopsSearchBar
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          searchInputRef={searchInputRef}
          onExportCSV={handleExportCSV}
        />
      )}

      <FilterPanel
        isModerationView={isModerationView}
        filter={search.filter}
        status={search.status}
        onFilterChange={handleFilterChange}
        onStatusChange={handleStatusFilterChange}
      />

      {isModerationView && (
        <BulkActionBar
          selectedCount={selectedShopIds.size}
          bulkProgress={bulkProgress}
          onBulkSuspend={handleBulkSuspend}
          onBulkUnsuspend={handleBulkUnsuspend}
        />
      )}

      {isModerationView ? (
        <ShopsTable
          shops={shops}
          selectedShopIds={selectedShopIds}
          actionShopId={actionShopId}
          sortBy={search.sortBy}
          sortDir={search.sortDir}
          onToggleSelection={toggleShopSelection}
          onToggleAll={toggleAllShops}
          onSort={handleSort}
          onUnsuspend={handleUnsuspend}
          onSuspend={openSuspendDialog}
        />
      ) : (
        <ApplicationsTable
          applications={applications}
          onReview={(app) => {
            setSelectedAppId(app.id)
            setActionError(null)
          }}
        />
      )}

      {isModerationView && shops.shops.length > 0 && (
        <PaginationControls
          page={shops.page}
          pageSize={shops.pageSize}
          total={shops.total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <SuspendDialog
        shop={suspendTarget}
        onClose={closeSuspendDialog}
        onConfirm={handleSuspendConfirm}
        isProcessing={!!suspendTarget && actionShopId === suspendTarget.id}
      />

      <ApplicationReviewDialog
        key={selectedAppId ?? 'none'}
        appId={selectedAppId}
        onClose={() => setSelectedAppId(null)}
        onReviewAction={handleReviewAction}
        isProcessing={isProcessingApplication}
        actionType={applicationActionType}
      />
    </div>
  )
}
