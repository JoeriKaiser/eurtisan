// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTablePagination } from './DataTablePagination'

describe('DataTablePagination', () => {
  it('renders showing text', () => {
    render(
      <DataTablePagination
        page={1}
        pageSize={20}
        total={50}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Showing 1–20 of 50')).toBeDefined()
  })

  it('calls onPageChange when next is clicked', () => {
    const onPageChange = vi.fn()
    render(
      <DataTablePagination
        page={1}
        pageSize={20}
        total={50}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )

    const nextButton = screen.getByLabelText('Next')
    fireEvent.click(nextButton)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('disables previous on first page', () => {
    render(
      <DataTablePagination
        page={1}
        pageSize={20}
        total={50}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    )

    const prevButton = screen.getByLabelText('Previous')
    expect(prevButton.hasAttribute('disabled')).toBe(true)
  })

  it('calls onPageSizeChange when page size is changed', () => {
    const onPageSizeChange = vi.fn()
    render(
      <DataTablePagination
        page={1}
        pageSize={20}
        total={50}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    )

    const select = screen.getByLabelText('Shops per page')
    fireEvent.change(select, { target: { value: '50' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('returns null when total is 0', () => {
    const { container } = render(
      <DataTablePagination
        page={1}
        pageSize={20}
        total={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })
})
