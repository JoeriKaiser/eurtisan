// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ShopCustomerDetail } from '#/lib/customers'
import { addCustomerNote, addCustomerTag } from '#/lib/customers'
import { ShopCustomerDetailPage } from './ShopCustomerDetailPage'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    studio_customer_contact: () => 'Contact',
    studio_customer_note_delete_title: () => 'Delete this note?',
    studio_customer_note_delete: () => 'Delete note',
    confirm_dialog_cancel: () => 'Cancel',
    confirm_dialog_confirm: () => 'Confirm',
    studio_customer_export_data: () => 'Export data',
    studio_customer_export_success: () => 'Export started',
    studio_customer_export_error: () => 'Export failed',
    studio_customer_metric_orders: () => 'Orders',
    studio_customer_metric_total_spent: () => 'Total spent',
    studio_customer_metric_average_order: () => 'Average order',
    studio_customer_metric_first_order: () => 'First order',
    studio_customer_tags_title: () => 'Tags',
    studio_customer_tags_empty: () => 'No tags yet.',
    studio_customer_tag_placeholder: () => 'Add a tag...',
    studio_customer_tag_add: () => 'Add tag',
    studio_customer_tag_remove: ({ tag }: { tag: string }) => `Remove ${tag}`,
    studio_customer_tag_added: () => 'Tag added',
    studio_customer_tag_removed: () => 'Tag removed',
    studio_customer_tag_error: () => 'Tag error',
    studio_customer_notes_title: () => 'Notes',
    studio_customer_notes_empty: () => 'No notes yet.',
    studio_customer_note_placeholder: () => 'Write a note...',
    studio_customer_note_add: () => 'Add note',
    studio_customer_note_added: () => 'Note added',
    studio_customer_note_updated: () => 'Note updated',
    studio_customer_note_deleted: () => 'Note deleted',
    studio_customer_note_error: () => 'Note error',
    studio_customer_note_edit: () => 'Edit',
    studio_customer_note_save: () => 'Save',
    studio_customer_note_cancel: () => 'Cancel',
    studio_customer_note_delete_confirm: () => 'Delete note?',
    studio_customer_note_meta: ({ author, date }: { author: string; date: string }) =>
      `${author} · ${date}`,
    studio_customer_orders_title: () => 'Orders',
    studio_customer_orders_empty: () => 'No orders yet.',
    studio_customer_orders_col_date: () => 'Date',
    studio_customer_orders_col_items: () => 'Items',
    studio_customer_orders_col_total: () => 'Total',
    studio_customer_orders_col_status: () => 'Status',
  },
}))

vi.mock('#/lib/customers', async () => {
  const actual = await vi.importActual<typeof import('#/lib/customers')>('#/lib/customers')
  return {
    ...actual,
    addCustomerNote: vi.fn(),
    addCustomerTag: vi.fn(),
    updateCustomerNote: vi.fn(),
    deleteCustomerNote: vi.fn(),
    removeCustomerTag: vi.fn(),
    exportCustomerData: vi.fn(),
  }
})

function makeCustomerDetail(overrides?: Partial<ShopCustomerDetail>): ShopCustomerDetail {
  return {
    emailHash: 'a'.repeat(64),
    email: 'customer@example.com',
    name: 'Test Customer',
    userId: 'user-1',
    orderCount: 0,
    totalSpentCents: 0,
    firstOrderAt: new Date('2026-05-01T12:00:00Z'),
    lastOrderAt: new Date('2026-05-01T12:00:00Z'),
    tags: [],
    notes: [],
    orders: [],
    ...overrides,
  }
}

describe('ShopCustomerDetailPage', () => {
  it('renders customer details', () => {
    const customer = makeCustomerDetail()
    render(<ShopCustomerDetailPage shopId='shop-1' customer={customer} />)
    expect(screen.getByRole('heading', { name: 'Test Customer' })).toBeDefined()
    expect(screen.getByText('customer@example.com')).toBeDefined()
  })

  it('adds a tag to the local tag list immediately', async () => {
    const customer = makeCustomerDetail({ tags: [] })
    vi.mocked(addCustomerTag).mockResolvedValueOnce('premium-buyer')

    render(<ShopCustomerDetailPage shopId='shop-1' customer={customer} />)

    fireEvent.change(screen.getByPlaceholderText('Add a tag...'), {
      target: { value: 'premium-buyer' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))

    expect(await screen.findByText('premium-buyer')).toBeDefined()
  })

  it('adds a note to the local notes list immediately', async () => {
    const customer = makeCustomerDetail({ notes: [] })
    vi.mocked(addCustomerNote).mockResolvedValueOnce({
      id: 'note-new',
      content: 'Customer prefers gift wrapping.',
      createdByName: 'Creator',
      createdAt: new Date('2026-05-01T12:00:00Z'),
      updatedAt: new Date('2026-05-01T12:00:00Z'),
    })

    render(<ShopCustomerDetailPage shopId='shop-1' customer={customer} />)

    fireEvent.change(screen.getByPlaceholderText('Write a note...'), {
      target: { value: 'Customer prefers gift wrapping.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))

    expect(await screen.findByText('Customer prefers gift wrapping.')).toBeDefined()
  })
})
