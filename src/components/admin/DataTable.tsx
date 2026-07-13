import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'

export interface ColumnDef<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  getRowId: (row: T) => string
  sorting?: { column: string; direction: 'asc' | 'desc' } | null
  onSortChange?: (sort: { column: string; direction: 'asc' | 'desc' } | null) => void
  rowSelection?: boolean
  selectedRows?: string[]
  onSelectionChange?: (ids: string[]) => void
  emptyState?: React.ReactNode
  'aria-label'?: string
}

const EMPTY_SELECTED_ROWS: string[] = []

export function DataTable<T>({
  columns,
  data,
  getRowId,
  sorting,
  onSortChange,
  rowSelection,
  selectedRows = EMPTY_SELECTED_ROWS,
  onSelectionChange,
  emptyState,
  'aria-label': ariaLabel,
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && data.every((row) => selectedRows.includes(getRowId(row)))
  const someSelected = data.some((row) => selectedRows.includes(getRowId(row))) && !allSelected

  const handleSelectAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(selectedRows.filter((id) => !data.some((row) => getRowId(row) === id)))
    } else {
      const newIds = data.map((row) => getRowId(row))
      onSelectionChange(Array.from(new Set([...selectedRows, ...newIds])))
    }
  }

  const handleSelectRow = (id: string) => {
    if (!onSelectionChange) return
    if (selectedRows.includes(id)) {
      onSelectionChange(selectedRows.filter((r) => r !== id))
    } else {
      onSelectionChange([...selectedRows, id])
    }
  }

  const handleSort = (column: ColumnDef<T>) => {
    if (!column.sortable || !onSortChange) return
    if (sorting?.column === column.key) {
      if (sorting.direction === 'asc') {
        onSortChange({ column: column.key, direction: 'desc' })
      } else {
        onSortChange(null)
      }
    } else {
      onSortChange({ column: column.key, direction: 'asc' })
    }
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left text-sm' aria-label={ariaLabel}>
        <thead>
          <tr className='border-b border-border-default'>
            {rowSelection && (
              <th scope='col' className='pb-3 pr-4 w-10'>
                <input
                  type='checkbox'
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={handleSelectAll}
                  aria-label={m.data_table_select_all()}
                  className='size-4 rounded border-border-default text-accent-primary focus:ring-accent-primary'
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope='col'
                className={cn('pb-3 pr-4 font-semibold text-text-secondary', col.headerClassName)}
                aria-sort={
                  sorting?.column === col.key
                    ? sorting.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : col.sortable
                      ? 'none'
                      : undefined
                }
              >
                {col.sortable ? (
                  <button
                    type='button'
                    className='flex min-h-8 items-center gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                    onClick={() => handleSort(col)}
                  >
                    {col.header}
                    {sorting?.column === col.key && (
                      <span className='text-text-muted'>
                        {sorting.direction === 'asc' ? (
                          <ArrowUp size={14} aria-hidden='true' />
                        ) : (
                          <ArrowDown size={14} aria-hidden='true' />
                        )}
                      </span>
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {data.map((row) => {
            const id = getRowId(row)
            const isSelected = selectedRows.includes(id)
            return (
              <tr
                key={id}
                className={cn(
                  'group transition-colors hover:bg-bg-inset/40',
                  isSelected && 'bg-accent-primary/5',
                )}
              >
                {rowSelection && (
                  <td className='py-3 pr-4'>
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => handleSelectRow(id)}
                      aria-label={m.data_table_select_row()}
                      className='size-4 rounded border-border-default text-accent-primary focus:ring-accent-primary'
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={cn('py-3 pr-4', col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
