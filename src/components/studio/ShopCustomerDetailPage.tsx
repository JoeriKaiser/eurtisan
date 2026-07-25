import { useRouter } from '@tanstack/react-router'
import { getOrderStatusLabel } from '#/lib/orders-ui'
import { Download, Mail, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/cn'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import {
  addCustomerNote,
  addCustomerTag,
  deleteCustomerNote,
  exportCustomerData,
  removeCustomerTag,
  updateCustomerNote,
  type ShopCustomerDetail,
} from '#/lib/customers'
import { formatPriceEUR } from '#/lib/pricing'
import { formatDateShort } from '#/lib/format-date'

interface ShopCustomerDetailPageProps {
  shopId: string
  customer: ShopCustomerDetail
}

export function ShopCustomerDetailPage({ shopId, customer }: ShopCustomerDetailPageProps) {
  const router = useRouter()
  const [localCustomer, setLocalCustomer] = useState(customer)
  const [loading, setLoading] = useState({
    addNote: false,
    updateNote: false,
    deleteNote: false,
    addTag: false,
    removeTag: false,
    exportData: false,
  })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  const [newNote, setNewNote] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')

  const [newTag, setNewTag] = useState('')

  const averageOrderCents =
    localCustomer.orderCount > 0
      ? Math.round(localCustomer.totalSpentCents / localCustomer.orderCount)
      : 0

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
  }

  const refresh = async () => {
    await router.invalidate()
  }

  const handleAddNote = async () => {
    const content = newNote.trim()
    if (!content) return
    setLoading((prev) => ({ ...prev, addNote: true }))
    try {
      const note = await addCustomerNote({
        data: { shopId, customerEmailHash: localCustomer.emailHash, content },
      })
      setLocalCustomer((prev) => ({ ...prev, notes: [note, ...prev.notes] }))
      setNewNote('')
      showFeedback('success', m.studio_customer_note_added())
      void refresh()
    } catch {
      showFeedback('error', m.studio_customer_note_error())
    } finally {
      setLoading((prev) => ({ ...prev, addNote: false }))
    }
  }

  const startEditNote = (id: string, content: string) => {
    setEditingNoteId(id)
    setEditNoteContent(content)
  }

  const handleUpdateNote = async () => {
    if (!editingNoteId) return
    const content = editNoteContent.trim()
    if (!content) return
    setLoading((prev) => ({ ...prev, updateNote: true }))
    try {
      const updated = await updateCustomerNote({ data: { noteId: editingNoteId, content } })
      setLocalCustomer((prev) => ({
        ...prev,
        notes: prev.notes.map((note) => (note.id === editingNoteId ? updated : note)),
      }))
      setEditingNoteId(null)
      setEditNoteContent('')
      showFeedback('success', m.studio_customer_note_updated())
      void refresh()
    } catch {
      showFeedback('error', m.studio_customer_note_error())
    } finally {
      setLoading((prev) => ({ ...prev, updateNote: false }))
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm(m.studio_customer_note_delete_confirm())) return
    setLoading((prev) => ({ ...prev, deleteNote: true }))
    try {
      await deleteCustomerNote({ data: { noteId } })
      setLocalCustomer((prev) => ({
        ...prev,
        notes: prev.notes.filter((note) => note.id !== noteId),
      }))
      showFeedback('success', m.studio_customer_note_deleted())
      void refresh()
    } catch {
      showFeedback('error', m.studio_customer_note_error())
    } finally {
      setLoading((prev) => ({ ...prev, deleteNote: false }))
    }
  }

  const handleAddTag = async () => {
    const tag = newTag.trim()
    if (!tag) return
    setLoading((prev) => ({ ...prev, addTag: true }))
    try {
      const addedTag = await addCustomerTag({
        data: { shopId, customerEmailHash: localCustomer.emailHash, tag },
      })
      setLocalCustomer((prev) => ({
        ...prev,
        tags: prev.tags.includes(addedTag) ? prev.tags : [...prev.tags, addedTag].sort(),
      }))
      setNewTag('')
      showFeedback('success', m.studio_customer_tag_added())
      void refresh()
    } catch {
      showFeedback('error', m.studio_customer_tag_error())
    } finally {
      setLoading((prev) => ({ ...prev, addTag: false }))
    }
  }

  const handleRemoveTag = async (tag: string) => {
    setLoading((prev) => ({ ...prev, removeTag: true }))
    try {
      await removeCustomerTag({ data: { shopId, customerEmailHash: localCustomer.emailHash, tag } })
      setLocalCustomer((prev) => ({
        ...prev,
        tags: prev.tags.filter((t) => t !== tag),
      }))
      showFeedback('success', m.studio_customer_tag_removed())
      void refresh()
    } catch {
      showFeedback('error', m.studio_customer_tag_error())
    } finally {
      setLoading((prev) => ({ ...prev, removeTag: false }))
    }
  }

  const handleExportData = async () => {
    setLoading((prev) => ({ ...prev, exportData: true }))
    try {
      const data = await exportCustomerData({
        data: { shopId, customerEmailHash: localCustomer.emailHash },
      })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `customer-export-${localCustomer.emailHash}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      showFeedback('success', m.studio_customer_export_success())
    } catch {
      showFeedback('error', m.studio_customer_export_error())
    } finally {
      setLoading((prev) => ({ ...prev, exportData: false }))
    }
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        {/* Header */}
        <div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
              {localCustomer.name}
            </h1>
            <p className='text-text-secondary'>{localCustomer.email}</p>
          </div>
          <div className='flex items-center gap-2'>
            <a
              href={`mailto:${localCustomer.email}`}
              className={cn(
                'inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border-default',
                'bg-surface-default px-3.5 text-xs font-semibold text-text-primary',
                'shadow-sm transition-all hover:bg-bg-inset hover:border-border-strong',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2',
              )}
            >
              <Mail size={16} aria-hidden='true' />
              {m.studio_customer_contact()}
            </a>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={handleExportData}
              isLoading={loading.exportData}
              disabled={loading.exportData}
            >
              <Download size={16} aria-hidden='true' />
              {m.studio_customer_export_data()}
            </Button>
          </div>
        </div>

        {feedback && <FeedbackBanner type={feedback.type} message={feedback.message} />}

        {/* Analytics */}
        <div className='mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard
            label={m.studio_customer_metric_orders()}
            value={String(localCustomer.orderCount)}
          />
          <MetricCard
            label={m.studio_customer_metric_total_spent()}
            value={formatPriceEUR(localCustomer.totalSpentCents)}
          />
          <MetricCard
            label={m.studio_customer_metric_average_order()}
            value={formatPriceEUR(averageOrderCents)}
          />
          <MetricCard
            label={m.studio_customer_metric_first_order()}
            value={formatDateShort(localCustomer.firstOrderAt)}
          />
        </div>

        {/* Tags */}
        <div className='mb-8 rounded-xl border border-border-subtle bg-surface-default p-4'>
          <h2 className='mb-3 text-lg font-semibold text-text-primary'>
            {m.studio_customer_tags_title()}
          </h2>
          <div className='mb-3 flex flex-wrap items-center gap-2'>
            {localCustomer.tags.length === 0 && (
              <span className='text-sm text-text-secondary'>{m.studio_customer_tags_empty()}</span>
            )}
            {localCustomer.tags.map((tag) => (
              <Badge key={tag} variant='secondary' className='gap-1 pr-1'>
                {tag}
                <button
                  type='button'
                  onClick={() => handleRemoveTag(tag)}
                  disabled={loading.removeTag}
                  className='rounded-full p-0.5 hover:bg-surface-inset'
                  aria-label={m.studio_customer_tag_remove({ tag })}
                >
                  <X size={12} aria-hidden='true' />
                </button>
              </Badge>
            ))}
          </div>
          <div className='flex items-center gap-2'>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={m.studio_customer_tag_placeholder()}
              className='max-w-xs'
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
            />
            <Button
              type='button'
              variant='primary'
              size='md'
              onClick={handleAddTag}
              isLoading={loading.addTag}
              disabled={loading.addTag || !newTag.trim()}
            >
              <Plus size={16} aria-hidden='true' />
              {m.studio_customer_tag_add()}
            </Button>
          </div>
        </div>

        <div className='grid gap-8 lg:grid-cols-2'>
          {/* Notes */}
          <div className='rounded-xl border border-border-subtle bg-surface-default p-4'>
            <h2 className='mb-3 text-lg font-semibold text-text-primary'>
              {m.studio_customer_notes_title()}
            </h2>

            <div className='mb-4'>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={m.studio_customer_note_placeholder()}
                rows={3}
              />
              <div className='mt-2 flex justify-end'>
                <Button
                  type='button'
                  variant='primary'
                  size='md'
                  onClick={handleAddNote}
                  isLoading={loading.addNote}
                  disabled={loading.addNote || !newNote.trim()}
                >
                  {m.studio_customer_note_add()}
                </Button>
              </div>
            </div>

            {localCustomer.notes.length === 0 ? (
              <p className='text-sm text-text-secondary'>{m.studio_customer_notes_empty()}</p>
            ) : (
              <ul className='space-y-3'>
                {localCustomer.notes.map((note) => (
                  <li
                    key={note.id}
                    className='rounded-lg border border-border-subtle bg-surface-inset p-3'
                  >
                    {editingNoteId === note.id ? (
                      <div>
                        <Textarea
                          value={editNoteContent}
                          onChange={(e) => setEditNoteContent(e.target.value)}
                          rows={3}
                        />
                        <div className='mt-2 flex justify-end gap-2'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => {
                              setEditingNoteId(null)
                              setEditNoteContent('')
                            }}
                          >
                            {m.studio_customer_note_cancel()}
                          </Button>
                          <Button
                            type='button'
                            variant='primary'
                            size='sm'
                            onClick={handleUpdateNote}
                            isLoading={loading.updateNote}
                            disabled={loading.updateNote || !editNoteContent.trim()}
                          >
                            {m.studio_customer_note_save()}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className='whitespace-pre-wrap text-sm text-text-primary'>
                          {note.content}
                        </p>
                        <div className='mt-2 flex items-center justify-between text-xs text-text-secondary'>
                          <span>
                            {m.studio_customer_note_meta({
                              author: note.createdByName,
                              date: formatDateShort(note.createdAt),
                            })}
                          </span>
                          <div className='flex items-center gap-2'>
                            <button
                              type='button'
                              onClick={() => startEditNote(note.id, note.content)}
                              className='hover:text-text-primary'
                            >
                              {m.studio_customer_note_edit()}
                            </button>
                            <button
                              type='button'
                              onClick={() => handleDeleteNote(note.id)}
                              className='text-error hover:text-error-hover'
                            >
                              <Trash2 size={14} aria-hidden='true' />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Order history */}
          <div className='rounded-xl border border-border-subtle bg-surface-default p-4'>
            <h2 className='mb-3 text-lg font-semibold text-text-primary'>
              {m.studio_customer_orders_title()}
            </h2>
            {localCustomer.orders.length === 0 ? (
              <p className='text-sm text-text-secondary'>{m.studio_customer_orders_empty()}</p>
            ) : (
              <div className='overflow-x-auto rounded-lg border border-border-subtle'>
                <table className='w-full text-left text-sm'>
                  <thead className='bg-surface-inset text-text-secondary'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>
                        {m.studio_customer_orders_col_date()}
                      </th>
                      <th className='px-3 py-2 font-medium'>
                        {m.studio_customer_orders_col_items()}
                      </th>
                      <th className='px-3 py-2 font-medium'>
                        {m.studio_customer_orders_col_total()}
                      </th>
                      <th className='px-3 py-2 font-medium'>
                        {m.studio_customer_orders_col_status()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border-subtle'>
                    {localCustomer.orders.map((order) => (
                      <tr key={order.shopOrderId} className='bg-surface-default'>
                        <td className='px-3 py-2 text-text-secondary'>
                          {formatDateShort(order.createdAt)}
                        </td>
                        <td className='px-3 py-2 text-text-secondary'>{order.itemCount}</td>
                        <td className='px-3 py-2 text-text-secondary'>
                          {formatPriceEUR(order.subtotalCents)}
                        </td>
                        <td className='px-3 py-2'>
                          <Badge variant='secondary'>{getOrderStatusLabel(order.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='island-shell rounded-xl p-4'>
      <p className='mb-1 text-sm text-text-secondary'>{label}</p>
      <p className='text-2xl font-semibold text-text-primary'>{value}</p>
    </div>
  )
}
