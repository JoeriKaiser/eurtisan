// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'

interface Item {
  id: string
  name: string
  age: number
}

const columns = [
  { key: 'name', header: 'Name', cell: (row: Item) => row.name, sortable: true },
  { key: 'age', header: 'Age', cell: (row: Item) => row.age, sortable: true },
]

const data: Item[] = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
]

describe('DataTable', () => {
  it('renders column headers', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.id}
        aria-label='Test table'
      />,
    )

    expect(screen.getByText('Name')).toBeDefined()
    expect(screen.getByText('Age')).toBeDefined()
  })

  it('renders row data', () => {
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} />)

    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('30')).toBeDefined()
    expect(screen.getByText('25')).toBeDefined()
  })

  it('calls onSortChange when sortable header is clicked', () => {
    const onSortChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.id}
        sorting={{ column: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    )

    const nameHeader = screen.getByRole('button', { name: /Name/ })
    fireEvent.click(nameHeader)
    expect(onSortChange).toHaveBeenCalledWith({ column: 'name', direction: 'desc' })
  })

  it('supports row selection', () => {
    const onSelectionChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.id}
        rowSelection
        selectedRows={['1']}
        onSelectionChange={onSelectionChange}
      />,
    )

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(3) // select all + 2 rows

    fireEvent.click(checkboxes[2] as HTMLElement)
    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2'])
  })

  it('renders empty state when no data', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        getRowId={(row) => row.id}
        emptyState={<div>No data</div>}
      />,
    )

    expect(screen.getByText('No data')).toBeDefined()
  })
})
