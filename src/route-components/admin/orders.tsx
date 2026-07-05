import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Card, CardContent } from '#/components/ui/card'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { m } from '#/paraglide/messages'
import { OrdersFilters } from './orders/OrdersFilters'
import { OrdersPagination } from './orders/OrdersPagination'
import { OrdersTable } from './orders/OrdersTable'

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminOrdersPage() {
  const orders = useLoaderData({ from: '/admin/orders/' })
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/orders/' })

  // --- Search state ---
  const [searchValue, setSearchValue] = useState(search.query ?? '')

  const searchInputRef = useRef<HTMLInputElement>(null)

  // --- Pagination helpers ---
  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | string[]>) => {
      navigate({
        to: '/admin/orders',
        search: { ...search, ...overrides },
        replace: true,
      })
    },
    [navigate, search],
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
    (column: 'createdAt' | 'totalCents') => {
      if (search.sortBy === column) {
        navigateWithParams({ sortDir: search.sortDir === 'asc' ? 'desc' : 'asc', page: 1 })
      } else {
        navigateWithParams({ sortBy: column, sortDir: 'desc', page: 1 })
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

  const toggleStatus = useCallback(
    (status: string) => {
      const current = search.statuses ?? []
      const next = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status]
      navigateWithParams({ statuses: next, page: 1 })
    },
    [navigateWithParams, search.statuses],
  )

  const handleDateChange = useCallback(
    (field: 'from' | 'to', value: string) => {
      navigateWithParams({ [field]: value, page: 1 })
    },
    [navigateWithParams],
  )

  const clearFilters = useCallback(() => {
    setSearchValue('')
    navigateWithParams({
      query: '',
      from: '',
      to: '',
      statuses: [],
      page: 1,
    })
  }, [navigateWithParams])

  const hasFilters =
    !!search.query || !!search.from || !!search.to || (search.statuses?.length ?? 0) > 0

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(orders.orders, [
      { key: 'orderNumber', label: 'Order Number' },
      { key: 'buyerName', label: 'Buyer' },
      { key: 'buyerEmail', label: 'Buyer Email' },
      { key: 'status', label: 'Status' },
      { key: 'totalCents', label: 'Total (cents)' },
      { key: 'shopCount', label: 'Shops' },
      { key: 'createdAt', label: 'Created At' },
    ])
    downloadCSV(csv, `orders-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [orders.orders])

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_orders_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_orders_description()}</p>
      </div>

      <OrdersFilters
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        onSearchSubmit={handleSearch}
        onClearSearch={handleClearSearch}
        searchRef={searchInputRef}
        dateFrom={search.from}
        dateTo={search.to}
        onDateChange={handleDateChange}
        statuses={search.statuses}
        onToggleStatus={toggleStatus}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        onExportCSV={handleExportCSV}
      />

      {/* Results */}
      {orders.orders.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>
              {search.query ? m.admin_orders_empty_search() : m.admin_orders_empty()}
            </p>
          </CardContent>
        </Card>
      ) : (
        <OrdersTable
          orders={orders.orders}
          sortBy={search.sortBy}
          sortDir={search.sortDir}
          onSort={handleSort}
        />
      )}

      {orders.orders.length > 0 && (
        <OrdersPagination
          page={orders.page}
          pageSize={orders.pageSize}
          total={orders.total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
