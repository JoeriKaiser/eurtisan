import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { markPayoutSent } from '#/lib/admin-payouts'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { m } from '#/paraglide/messages'
import { HistoryFilters } from './payouts/HistoryFilters'
import { HistoryTab } from './payouts/HistoryTab'
import { PayoutTabs } from './payouts/PayoutTabs'
import { PendingTab } from './payouts/PendingTab'

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

type Tab = 'pending' | 'history'

export function AdminPayoutsPage() {
  const initialData = useLoaderData({ from: '/admin/payouts' })
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/payouts' })

  // Derive history data fresh on every render so pagination works.
  const historyData = initialData.tab === 'history' ? initialData.history : null

  const payoutsData = initialData.tab === 'pending' ? initialData.payouts : null
  const payouts = payoutsData?.payouts ?? []

  const [status, setStatus] = useState({
    actionPayoutId: null as string | null,
    actionError: null as string | null,
    successMessage: null as string | null,
  })

  // Search state
  const [searchValue, setSearchValue] = useState(search.query ?? '')

  // --- Refs for stale-closure safety ---
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  /* ---- Navigation helpers ---- */
  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number>) => {
      navigate({
        to: '/admin/payouts',
        search: { ...search, ...overrides },
        replace: true,
      })
    },
    [navigate, search],
  )

  const handleTabChange = useCallback(
    (tab: Tab) => {
      navigate({ to: '/admin/payouts', search: { tab, page: 1, pageSize: 20 }, replace: true })
    },
    [navigate],
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

  const handleSearch = useCallback(() => {
    const trimmed = searchValue.trim()
    navigateWithParams({ query: trimmed, page: 1 })
  }, [searchValue, navigateWithParams])

  const handleClearSearch = useCallback(() => {
    setSearchValue('')
    navigateWithParams({ query: '', page: 1 })
  }, [navigateWithParams])

  const handleDateChange = useCallback(
    (field: 'from' | 'to', value: string) => {
      navigateWithParams({ [field]: value, page: 1 })
    },
    [navigateWithParams],
  )

  const clearFilters = useCallback(() => {
    setSearchValue('')
    navigateWithParams({ query: '', from: '', to: '', page: 1 })
  }, [navigateWithParams])

  /* ---- Mark as sent ---- */
  const handleMarkSent = useCallback(async (payoutId: string) => {
    setStatus({ actionPayoutId: payoutId, actionError: null, successMessage: null })

    try {
      await markPayoutSent({ data: { payoutId } })

      setStatus((prev) => ({
        ...prev,
        successMessage: m.admin_payouts_marked_sent_success(),
      }))

      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(
        () => setStatus((prev) => ({ ...prev, successMessage: null })),
        3000,
      )
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        actionError: err instanceof Error ? err.message : m.admin_payouts_action_error(),
      }))
    } finally {
      setStatus((prev) => ({ ...prev, actionPayoutId: null }))
    }
  }, [])

  /* ---- Derived data ---- */
  const currentTab = search.tab as Tab
  const isPendingTab = currentTab === 'pending'
  const hasFilters = !!search.query || !!search.from || !!search.to

  const handleExportCSV = useCallback(() => {
    if (!historyData) return
    const csv = generateCSV(historyData.payouts, [
      { key: 'creatorName', label: 'Creator' },
      { key: 'shopName', label: 'Shop' },
      { key: 'amountCents', label: 'Amount (cents)' },
      { key: 'status', label: 'Status' },
      { key: 'sentAt', label: 'Sent At' },
      { key: 'createdAt', label: 'Created At' },
    ])
    downloadCSV(csv, `payouts-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [historyData])

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_payouts_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_payouts_description()}</p>
      </div>

      {/* Success / Error feedback */}
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
            className='ml-2 underline hover:no-underline'
          >
            {m.admin_payouts_dismiss()}
          </button>
        </div>
      )}

      <PayoutTabs currentTab={currentTab} onTabChange={handleTabChange} />

      {!isPendingTab && (
        <HistoryFilters
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearchSubmit={handleSearch}
          onClearSearch={handleClearSearch}
          dateFrom={search.from}
          dateTo={search.to}
          onDateChange={handleDateChange}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          canExport={!!historyData && historyData.payouts.length > 0}
          onExportCSV={handleExportCSV}
        />
      )}

      {isPendingTab ? (
        <PendingTab
          payouts={payouts}
          page={payoutsData?.page ?? 1}
          pageSize={payoutsData?.pageSize ?? 20}
          total={payoutsData?.total ?? 0}
          totalPages={payoutsData?.totalPages ?? 0}
          actionPayoutId={status.actionPayoutId}
          onMarkSent={handleMarkSent}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : (
        <HistoryTab
          historyData={historyData}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
