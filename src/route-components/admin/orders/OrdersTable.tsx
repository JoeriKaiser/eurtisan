import { Link } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'
import type { PaginatedAdminOrders } from '#/lib/admin-orders'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { SortHeader } from './SortHeader'
import { formatDateMediumTime } from '#/lib/format-date'

function formatDate(date: Date | string): string {
  return formatDateMediumTime(new Date(date))
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

interface OrdersTableProps {
  orders: PaginatedAdminOrders['orders']
  sortBy: string | undefined
  sortDir: string | undefined
  onSort: (column: 'createdAt' | 'totalCents') => void
}

export function OrdersTable({ orders, sortBy, sortDir, onSort }: OrdersTableProps) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-4 font-medium text-text-secondary'>
              {m.admin_orders_col_order()}
            </th>
            <th
              scope='col'
              className='pb-3 pr-4 font-medium text-text-secondary hidden sm:table-cell'
            >
              {m.admin_orders_col_buyer()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-medium text-text-secondary'>
              {m.admin_orders_col_status()}
            </th>
            <th
              scope='col'
              className='pb-3 pr-4 font-medium text-text-secondary hidden md:table-cell'
            >
              {m.admin_orders_col_shops()}
            </th>
            <th scope='col' className='pb-3 pr-4'>
              <SortHeader
                column='totalCents'
                sortBy={sortBy}
                sortDir={sortDir as 'asc' | 'desc' | undefined}
                onSort={onSort}
              >
                {m.admin_orders_col_total()}
              </SortHeader>
            </th>
            <th scope='col' className='pb-3 pr-4'>
              <SortHeader
                column='createdAt'
                sortBy={sortBy}
                sortDir={sortDir as 'asc' | 'desc' | undefined}
                onSort={onSort}
              >
                {m.admin_orders_col_date()}
              </SortHeader>
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {orders.map((order) => (
            <tr key={order.id} className='group transition-colors hover:bg-bg-inset/40'>
              <td className='py-3 pr-4'>
                <Link
                  to='/admin/orders/$platformOrderId'
                  params={{ platformOrderId: order.id }}
                  className='font-mono text-sm font-medium text-accent-primary hover:underline no-underline'
                >
                  {order.id.slice(0, 8)}…
                </Link>
              </td>
              <td className='py-3 pr-4 hidden sm:table-cell'>
                <div>
                  <p className='font-medium text-text-primary'>{order.buyerName}</p>
                  <p className='text-xs text-text-muted'>{order.buyerEmail}</p>
                </div>
              </td>
              <td className='py-3 pr-4'>
                <Badge variant={statusBadgeVariant(order.status)}>
                  {statusLabel(order.status)}
                </Badge>
              </td>
              <td className='py-3 pr-4 hidden md:table-cell'>
                <span className='text-text-secondary'>{order.shopCount}</span>
              </td>
              <td className='py-3 pr-4'>
                <span className='font-medium text-text-primary tabular-nums'>
                  {formatPriceEUR(order.totalCents)}
                </span>
              </td>
              <td className='py-3 pr-4'>
                <span className='text-text-secondary'>{formatDate(order.createdAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
