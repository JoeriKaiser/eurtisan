import { useRouter } from '@tanstack/react-router'
import { Package, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import {
  bulkDeleteProducts,
  bulkToggleProductActive,
  toggleProductActive,
} from '#/lib/creator-products'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { CreatorProductsError } from './CreatorProductsError'
import { CreatorProductsFilterBar } from './CreatorProductsFilterBar'
import { CreatorProductsLoading } from './CreatorProductsLoading'
import { CreatorProductsPagination } from './CreatorProductsPagination'
import { DeleteConfirmationDialog } from './product/DeleteConfirmationDialog'
import { type CreatorProduct, ProductTableRow } from './product/ProductTableRow'

export { CreatorProductsError, CreatorProductsLoading }

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

interface CreatorShop {
  id: string
  name: string
  slug: string
}

interface PaginatedProducts {
  products: CreatorProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreatorProductsPageProps {
  shops: CreatorShop[]
  products: PaginatedProducts
  currentShopId: string | null
  initialSearch: {
    shopId?: string
    page: number
    pageSize: number
    active: 'true' | 'false' | 'all'
    status: 'all' | 'draft' | 'published' | 'archived'
    search?: string
  }
}

export function CreatorProductsPage({
  shops,
  products: initialProducts,
  currentShopId,
  initialSearch,
}: CreatorProductsPageProps) {
  const router = useRouter()

  /* ---- Local state for optimistic toggles ---- */
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({})
  const [togglingProducts, setTogglingProducts] = useState<Record<string, boolean>>({})

  /* ---- Bulk selection state ---- */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)

  /* ---- Local filter states (mirrored to search params) ---- */
  const [localSearch, setLocalSearch] = useState(initialSearch.search ?? '')
  const localSearchRef = useRef(localSearch)
  localSearchRef.current = localSearch
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      setToggleStates({})
      setSelectedIds(new Set())
      const params: Record<string, string | number> = {
        page: initialSearch.page,
        pageSize: initialSearch.pageSize,
        active: initialSearch.active,
        status: initialSearch.status,
        ...overrides,
      }

      // Include shopId only when it exists
      if (currentShopId) {
        params.shopId = currentShopId
      }

      // Only include search if non-empty
      const searchValue =
        overrides.search !== undefined ? String(overrides.search) : localSearchRef.current
      if (searchValue?.trim()) {
        params.search = searchValue
      } else {
        delete params.search
      }

      router.navigate({
        to: '/creator/products',
        search: params,
        replace: true,
      })
    },
    [
      currentShopId,
      initialSearch.pageSize,
      initialSearch.active,
      initialSearch.status,
      initialSearch.page,
      router,
    ],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        navigateWithParams({ search: value || undefined, page: 1 })
      }, 300)
    },
    [navigateWithParams],
  )

  const handleActiveFilter = useCallback(
    (active: 'true' | 'false' | 'all') => {
      navigateWithParams({ active, page: 1 })
    },
    [navigateWithParams],
  )

  const handleStatusFilter = useCallback(
    (status: 'all' | 'draft' | 'published' | 'archived') => {
      navigateWithParams({ status, page: 1 })
    },
    [navigateWithParams],
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigateWithParams({ page: newPage })
    },
    [navigateWithParams],
  )

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      navigateWithParams({ pageSize: newSize, page: 1 })
    },
    [navigateWithParams],
  )

  const handleShopChange = useCallback(
    (newShopId: string) => {
      setToggleStates({})
      setSelectedIds(new Set())
      setLocalSearch('')
      router.navigate({
        to: '/creator/products',
        search: {
          shopId: newShopId,
          page: 1,
          pageSize: initialSearch.pageSize,
          active: 'all',
          status: 'all',
        },
        replace: true,
      })
    },
    [initialSearch.pageSize, router],
  )

  /* ---- Toggle handler ---- */
  const handleToggle = useCallback(
    async (productId: string, shopId: string, currentActive: boolean) => {
      if (!shopId) return
      const newActive = !currentActive

      // Optimistic update
      setToggleStates((prev) => ({ ...prev, [productId]: newActive }))
      setTogglingProducts((prev) => ({ ...prev, [productId]: true }))

      try {
        await toggleProductActive({ data: { productId, shopId } })
      } catch {
        // Rollback
        setToggleStates((prev) => ({ ...prev, [productId]: currentActive }))
      } finally {
        setTogglingProducts((prev) => ({ ...prev, [productId]: false }))
      }
    },
    [],
  )

  /* ---- Derived state ---- */
  const products = initialProducts.products
  const isActive = (p: CreatorProduct): boolean => {
    return toggleStates[p.id] !== undefined ? toggleStates[p.id] : p.isActive
  }
  const isToggling = (p: CreatorProduct): boolean => {
    return togglingProducts[p.id] ?? false
  }

  /* ---- Selection handlers ---- */
  const handleSelect = useCallback((productId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(productId)
      } else {
        next.delete(productId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      setSelectedIds(selected ? new Set(products.map((p) => p.id)) : new Set())
    },
    [products],
  )

  const showBulkFeedback = (type: 'success' | 'error', message: string) => {
    setBulkFeedback({ type, message })
    window.setTimeout(() => setBulkFeedback(null), 4000)
  }

  const runBulkAction = async (action: () => Promise<unknown>) => {
    if (!currentShopId || selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      await action()
      setSelectedIds(new Set())
      await router.invalidate()
      showBulkFeedback('success', m.creator_products_bulk_action_success())
    } catch {
      showBulkFeedback('error', m.creator_products_bulk_action_error())
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkActivate = () => {
    if (!currentShopId) return
    runBulkAction(() =>
      bulkToggleProductActive({
        data: { shopId: currentShopId, productIds: Array.from(selectedIds), isActive: true },
      }),
    )
  }

  const handleBulkDeactivate = () => {
    if (!currentShopId) return
    runBulkAction(() =>
      bulkToggleProductActive({
        data: { shopId: currentShopId, productIds: Array.from(selectedIds), isActive: false },
      }),
    )
  }

  const handleBulkDelete = () => {
    if (!currentShopId) return
    runBulkAction(() =>
      bulkDeleteProducts({
        data: { shopId: currentShopId, productIds: Array.from(selectedIds), hard: false },
      }),
    )
  }

  /* ---- No shops ---- */
  if (shops.length === 0) {
    return (
      <main className='page-wrap px-4 py-12'>
        <section className='island-shell rounded-2xl p-6 sm:p-8'>
          <div className='py-12 text-center'>
            <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-xl font-semibold text-text-primary'>
              {m.creator_no_shops_title()}
            </h2>
            <p className='mx-auto max-w-md text-text-secondary'>
              {m.creator_no_shops_description()}
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        {/* Header */}
        <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
          {m.creator_products_title()}
        </h1>
        <p className='mb-6 text-text-secondary'>{m.creator_products_description()}</p>

        {/* Shop selector */}
        <div className='mb-6'>
          <label
            htmlFor='creator-products-shop'
            className='mb-1.5 block text-sm font-medium text-text-secondary'
          >
            {m.creator_shop_select_label()}
          </label>
          <select
            id='creator-products-shop'
            value={currentShopId ?? ''}
            onChange={(e) => handleShopChange(e.target.value)}
            className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 sm:max-w-xs'
          >
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
        </div>

        <CreatorProductsFilterBar
          searchValue={localSearch}
          onSearchChange={handleSearchChange}
          active={initialSearch.active}
          onActiveChange={handleActiveFilter}
          status={initialSearch.status}
          onStatusChange={handleStatusFilter}
        />

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className='mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface-inset p-3'>
            <span className='text-sm font-medium text-text-primary'>
              {m.creator_products_bulk_selected({ count: String(selectedIds.size) })}
            </span>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={handleBulkActivate}
                isLoading={bulkLoading}
                disabled={bulkLoading}
              >
                {m.creator_products_bulk_activate()}
              </Button>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={handleBulkDeactivate}
                isLoading={bulkLoading}
                disabled={bulkLoading}
              >
                {m.creator_products_bulk_deactivate()}
              </Button>
              <Button
                type='button'
                variant='danger'
                size='sm'
                onClick={() => setShowBulkDeleteDialog(true)}
                isLoading={bulkLoading}
                disabled={bulkLoading}
              >
                <Trash2 size={16} aria-hidden='true' />
                {m.creator_products_bulk_delete()}
              </Button>
            </div>
          </div>
        )}

        {bulkFeedback && <FeedbackBanner type={bulkFeedback.type} message={bulkFeedback.message} />}

        {/* Table */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <caption className='sr-only'>{m.creator_products_title()}</caption>
            <thead>
              <tr className='border-b border-border-default'>
                <th className='pb-3 pr-3'>
                  <input
                    type='checkbox'
                    checked={products.length > 0 && products.every((p) => selectedIds.has(p.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className='size-4 rounded border-border-default text-accent-primary focus:ring-accent-secondary'
                    aria-label={m.creator_products_select_all()}
                  />
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.creator_products_col_product()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary hidden sm:table-cell'>
                  {m.creator_products_col_price()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary hidden md:table-cell'>
                  {m.creator_products_col_stock()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.creator_products_col_status()}
                </th>
                <th className='pb-3 font-medium text-text-secondary text-right'>
                  <span className='sr-only'>{m.creator_products_col_actions()}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  currentShopId={currentShopId}
                  active={isActive(product)}
                  toggling={isToggling(product)}
                  selected={selectedIds.has(product.id)}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {products.length === 0 && (
          <div className='py-12 text-center'>
            <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-lg font-semibold text-text-primary'>
              {initialSearch.search ||
              initialSearch.active !== 'all' ||
              initialSearch.status !== 'all'
                ? m.creator_products_no_results()
                : m.creator_products_empty_title()}
            </h2>
            <p className='text-text-secondary'>
              {initialSearch.search ||
              initialSearch.active !== 'all' ||
              initialSearch.status !== 'all'
                ? m.creator_products_no_results_description()
                : m.creator_products_empty_description()}
            </p>
          </div>
        )}

        {initialProducts.totalPages > 1 && (
          <CreatorProductsPagination
            page={initialProducts.page}
            pageSize={initialProducts.pageSize}
            totalPages={initialProducts.totalPages}
            total={initialProducts.total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
        <DeleteConfirmationDialog
          open={showBulkDeleteDialog}
          title={m.creator_products_bulk_delete()}
          description={m.creator_products_bulk_delete_confirm({
            count: String(selectedIds.size),
          })}
          cancelLabel={m.creator_product_new_cancel()}
          confirmLabel={m.creator_products_bulk_delete()}
          deleting={bulkLoading}
          onCancel={() => setShowBulkDeleteDialog(false)}
          onConfirm={() => {
            setShowBulkDeleteDialog(false)
            handleBulkDelete()
          }}
        />
      </section>
    </main>
  )
}
