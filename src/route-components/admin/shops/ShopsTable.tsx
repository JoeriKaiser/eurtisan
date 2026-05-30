import { Ban, CheckCircle, Store } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import type { PaginatedShops, ShopListItem } from '#/lib/shop-moderation'
import { m } from '#/paraglide/messages'
import { SortHeader } from './SortHeader'

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(date: Date | string): string {
  return DATE_FORMATTER.format(new Date(date))
}

interface ShopsTableProps {
  shops: PaginatedShops
  selectedShopIds: Set<string>
  actionShopId: string | null
  sortBy: string | undefined
  sortDir: string | undefined
  onToggleSelection: (shopId: string) => void
  onToggleAll: () => void
  onSort: (column: string) => void
  onUnsuspend: (shopId: string) => void
  onSuspend: (shop: ShopListItem) => void
}

export function ShopsTable({
  shops,
  selectedShopIds,
  actionShopId,
  sortBy,
  sortDir,
  onToggleSelection,
  onToggleAll,
  onSort,
  onUnsuspend,
  onSuspend,
}: ShopsTableProps) {
  if (shops.shops.length === 0) {
    return (
      <div className='py-16 text-center'>
        <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
        <p className='text-text-secondary'>{m.admin_shops_empty()}</p>
      </div>
    )
  }

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-2'>
              <input
                type='checkbox'
                checked={selectedShopIds.size > 0 && selectedShopIds.size === shops.shops.length}
                onChange={onToggleAll}
                className='size-4 rounded border-border-default'
                aria-label={m.data_table_select_all()}
              />
            </th>
            <th scope='col' className='pb-3 pr-4'>
              <SortHeader
                column='name'
                sortBy={sortBy}
                sortDir={sortDir as 'asc' | 'desc' | undefined}
                onSort={onSort}
              >
                {m.admin_shops_col_name()}
              </SortHeader>
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_shops_col_owner()}
            </th>
            <th scope='col' className='pb-3 pr-4'>
              <SortHeader
                column='status'
                sortBy={sortBy}
                sortDir={sortDir as 'asc' | 'desc' | undefined}
                onSort={onSort}
              >
                {m.admin_shops_col_status()}
              </SortHeader>
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_shops_col_note()}
            </th>
            <th scope='col' className='pb-3 pr-4'>
              <SortHeader
                column='createdAt'
                sortBy={sortBy}
                sortDir={sortDir as 'asc' | 'desc' | undefined}
                onSort={onSort}
              >
                {m.admin_shops_col_created()}
              </SortHeader>
            </th>
            <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
              {m.admin_shops_col_actions()}
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {shops.shops.map((shop) => {
            const isProcessing = actionShopId === shop.id
            return (
              <tr key={shop.id} className='group hover:bg-bg-inset/40 transition-colors'>
                {/* Checkbox */}
                <td className='py-3 pr-2'>
                  <input
                    type='checkbox'
                    checked={selectedShopIds.has(shop.id)}
                    onChange={() => onToggleSelection(shop.id)}
                    className='size-4 rounded border-border-default'
                    aria-label={m.data_table_select_row()}
                  />
                </td>
                {/* Name */}
                <td className='py-3 pr-4 font-medium text-text-primary'>
                  <div className='flex items-center gap-3'>
                    <div className='size-6 rounded-full bg-surface-inset border border-border-subtle flex items-center justify-center text-text-muted flex-shrink-0'>
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
                    <span className='truncate text-xs text-text-muted'>{shop.ownerEmail}</span>
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
                  {shop.moderationNote || <span className='text-text-muted'>(none)</span>}
                </td>

                {/* Created At */}
                <td className='py-3 pr-4 text-text-secondary font-mono text-xs'>
                  {formatDate(shop.createdAt)}
                </td>

                {/* Actions */}
                <td className='py-3 text-right whitespace-nowrap'>
                  {shop.isSuspended ? (
                    <Button
                      variant='primary'
                      size='sm'
                      onClick={() => onUnsuspend(shop.id)}
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
                      onClick={() => onSuspend(shop)}
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
}
