import { useLoaderData } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Folder,
  Inbox,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { createCategory, deleteCategory, updateCategory } from '#/lib/categories'
import { moveCategory, listCategoriesAdmin } from '#/lib/admin-categories'
import type { AdminCategoryItem } from '#/lib/admin-categories'
import { m } from '#/paraglide/messages'
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminCategoriesPage() {
  const loaderData = useLoaderData({ from: '/admin/categories' })
  const [categories, setCategories] = useState<AdminCategoryItem[]>(loaderData.flat)
  const [ui, setUi] = useState({
    actionError: null as string | null,
    successMessage: null as string | null,
    dialogOpen: false,
    dialogMode: 'create' as 'create' | 'edit',
    editCategoryId: null as string | null,
    isSubmitting: false,
    deleteTarget: null as AdminCategoryItem | null,
    isDeleting: false,
  })
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: '',
  })
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const treeCategories = useMemo(() => {
    return categories.filter((c) => c.id !== ui.editCategoryId)
  }, [categories, ui.editCategoryId])

  const showSuccess = useCallback((message: string) => {
    setUi((prev) => ({ ...prev, successMessage: message }))
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(
      () => setUi((prev) => ({ ...prev, successMessage: null })),
      3000,
    )
  }, [])

  const openCreateDialog = useCallback(() => {
    setForm({ name: '', slug: '', description: '', parentId: '' })
    setUi((prev) => ({
      ...prev,
      dialogMode: 'create',
      editCategoryId: null,
      actionError: null,
      dialogOpen: true,
    }))
  }, [])

  const openEditDialog = useCallback((cat: AdminCategoryItem) => {
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      parentId: cat.parentId ?? '',
    })
    setUi((prev) => ({
      ...prev,
      dialogMode: 'edit',
      editCategoryId: cat.id,
      actionError: null,
      dialogOpen: true,
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    setUi((prev) => ({ ...prev, isSubmitting: true, actionError: null }))
    try {
      if (ui.dialogMode === 'create') {
        const result = await createCategory({
          data: {
            name: form.name.trim(),
            slug: form.slug.trim() || undefined,
            description: form.description.trim() || undefined,
            parentId: form.parentId || undefined,
          },
        })
        setCategories((prev) => [
          ...prev,
          {
            id: result.id,
            name: result.name,
            slug: result.slug,
            description: result.description,
            parentId: result.parentId,
            sortOrder: result.sortOrder ?? 0,
            createdAt: result.createdAt,
            depth: result.parentId
              ? (prev.find((p) => p.id === result.parentId)?.depth ?? -1) + 1
              : 0,
          },
        ])
        showSuccess(m.admin_categories_created_success({ name: result.name }))
      } else if (ui.editCategoryId) {
        const result = await updateCategory({
          data: {
            id: ui.editCategoryId,
            name: form.name.trim() || undefined,
            slug: form.slug.trim() || undefined,
            description: form.description.trim() || undefined,
            parentId: form.parentId || null,
          },
        })
        setCategories((prev) =>
          prev.map((c) =>
            c.id === ui.editCategoryId
              ? {
                  ...c,
                  name: result.name,
                  slug: result.slug,
                  description: result.description,
                  parentId: result.parentId,
                  depth: result.parentId
                    ? (prev.find((p) => p.id === result.parentId)?.depth ?? -1) + 1
                    : 0,
                }
              : c,
          ),
        )
        showSuccess(m.admin_categories_updated_success({ name: result.name }))
      }
      setUi((prev) => ({ ...prev, dialogOpen: false }))
    } catch (err) {
      setUi((prev) => ({
        ...prev,
        actionError: err instanceof Error ? err.message : m.admin_categories_action_error(),
      }))
    } finally {
      setUi((prev) => ({ ...prev, isSubmitting: false }))
    }
  }, [ui.dialogMode, ui.editCategoryId, form, showSuccess])

  const handleDelete = useCallback(async () => {
    if (!ui.deleteTarget) return
    setUi((prev) => ({ ...prev, isDeleting: true, actionError: null }))
    try {
      await deleteCategory({ data: { id: ui.deleteTarget.id } })
      setCategories((prev) => prev.filter((c) => c.id !== ui.deleteTarget?.id))
      showSuccess(m.admin_categories_deleted_success({ name: ui.deleteTarget.name }))
      setUi((prev) => ({ ...prev, deleteTarget: null }))
    } catch (err) {
      setUi((prev) => ({
        ...prev,
        actionError: err instanceof Error ? err.message : m.admin_categories_action_error(),
      }))
    } finally {
      setUi((prev) => ({ ...prev, isDeleting: false }))
    }
  }, [ui.deleteTarget, showSuccess])

  const handleMove = useCallback(async (categoryId: string, direction: 'up' | 'down') => {
    setUi((prev) => ({ ...prev, actionError: null }))
    try {
      await moveCategory({ data: { categoryId, direction } })
      const fresh = await listCategoriesAdmin({ data: undefined })
      setCategories(fresh)
    } catch (err) {
      setUi((prev) => ({
        ...prev,
        actionError: err instanceof Error ? err.message : m.admin_categories_action_error(),
      }))
    }
  }, [])

  const maxDepth = 3

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='display-title text-3xl font-semibold text-text-primary'>
            {m.admin_categories_title()}
          </h1>
          <p className='mt-1 text-text-secondary'>{m.admin_categories_description()}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus size={16} aria-hidden='true' />
          {m.admin_categories_create()}
        </Button>
      </div>

      {ui.successMessage && (
        <div className='island-shell rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success'>
          <CheckCircle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {ui.successMessage}
        </div>
      )}

      {ui.actionError && (
        <div
          role='alert'
          className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
        >
          <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {ui.actionError}
          <button
            type='button'
            onClick={() => setUi((prev) => ({ ...prev, actionError: null }))}
            className='ml-2 underline hover:no-underline cursor-pointer'
          >
            {m.admin_shops_dismiss()}
          </button>
        </div>
      )}

      {categories.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>{m.admin_categories_empty()}</p>
          </CardContent>
        </Card>
      ) : (
        <div className='rounded-xl border border-border-default bg-surface-elevated shadow-md overflow-hidden'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-border-default bg-surface-inset'>
                <th className='py-3 px-4 font-semibold text-text-secondary'>
                  {m.admin_categories_col_name()}
                </th>
                <th className='py-3 px-4 font-semibold text-text-secondary hidden sm:table-cell'>
                  {m.admin_categories_col_slug()}
                </th>
                <th className='py-3 px-4 font-semibold text-text-secondary hidden md:table-cell'>
                  {m.admin_categories_col_description()}
                </th>
                <th className='py-3 px-4 text-right font-semibold text-text-secondary'>
                  {m.admin_common_actions()}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border-subtle'>
              {categories.map((cat) => (
                <tr key={cat.id} className='group hover:bg-bg-inset/40 transition-colors'>
                  <td className='py-3 px-4'>
                    <div
                      className='flex items-center gap-2'
                      style={{ paddingLeft: `${cat.depth * 24}px` }}
                    >
                      <Folder
                        size={16}
                        className='text-text-muted flex-shrink-0'
                        aria-hidden='true'
                      />
                      <span className='font-medium text-text-primary'>{cat.name}</span>
                    </div>
                  </td>
                  <td className='py-3 px-4 font-mono text-xs text-text-secondary hidden sm:table-cell'>
                    {cat.slug}
                  </td>
                  <td className='py-3 px-4 text-text-secondary hidden md:table-cell max-w-xs truncate'>
                    {cat.description || <span className='text-text-muted'>(none)</span>}
                  </td>
                  <td className='py-3 px-4 text-right whitespace-nowrap'>
                    <div className='flex items-center justify-end gap-1'>
                      <button
                        type='button'
                        onClick={() => handleMove(cat.id, 'up')}
                        className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                        aria-label={m.admin_categories_move_up({ name: cat.name })}
                        title={m.admin_categories_move_up({ name: cat.name })}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type='button'
                        onClick={() => handleMove(cat.id, 'down')}
                        className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                        aria-label={m.admin_categories_move_down({ name: cat.name })}
                        title={m.admin_categories_move_down({ name: cat.name })}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type='button'
                        onClick={() => openEditDialog(cat)}
                        className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                        aria-label={m.admin_categories_edit({ name: cat.name })}
                        title={m.admin_categories_edit({ name: cat.name })}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type='button'
                        onClick={() => setUi((prev) => ({ ...prev, deleteTarget: cat }))}
                        className='rounded p-1.5 text-text-muted hover:bg-error-subtle hover:text-error transition-colors'
                        aria-label={m.admin_categories_delete({ name: cat.name })}
                        title={m.admin_categories_delete({ name: cat.name })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={ui.dialogOpen}
        onOpenChange={(open) => setUi((prev) => ({ ...prev, dialogOpen: open }))}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='max-w-md'>
            <DialogTitle>
              {ui.dialogMode === 'create'
                ? m.admin_categories_create_title()
                : m.admin_categories_edit_title()}
            </DialogTitle>
            <DialogDescription>
              {ui.dialogMode === 'create'
                ? m.admin_categories_create_description()
                : m.admin_categories_edit_description()}
            </DialogDescription>

            {ui.actionError && (
              <div className='mt-4 rounded-lg border border-error/30 bg-error-subtle p-3 text-sm text-error'>
                {ui.actionError}
              </div>
            )}

            <div className='mt-4 space-y-4'>
              <div>
                <label
                  htmlFor='cat-name'
                  className='mb-1.5 block text-sm font-semibold text-text-secondary'
                >
                  {m.admin_categories_name_label()}
                </label>
                <input
                  id='cat-name'
                  type='text'
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                  placeholder={m.admin_categories_name_placeholder()}
                />
              </div>

              <div>
                <label
                  htmlFor='cat-slug'
                  className='mb-1.5 block text-sm font-semibold text-text-secondary'
                >
                  {m.admin_categories_slug_label()}
                </label>
                <input
                  id='cat-slug'
                  type='text'
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                  placeholder={m.admin_categories_slug_placeholder()}
                />
                <p className='mt-1 text-xs text-text-muted'>{m.admin_categories_slug_hint()}</p>
              </div>

              <div>
                <label
                  htmlFor='cat-parent'
                  className='mb-1.5 block text-sm font-semibold text-text-secondary'
                >
                  {m.admin_categories_parent_label()}
                </label>
                <select
                  id='cat-parent'
                  value={form.parentId}
                  onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}
                  className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 text-sm text-text-primary focus-visible:outline-none'
                >
                  <option value=''>{m.admin_categories_parent_none()}</option>
                  {treeCategories.reduce<React.ReactElement[]>((acc, c) => {
                    if (c.depth < maxDepth - 1) {
                      acc.push(
                        <option key={c.id} value={c.id}>
                          {'\u00A0\u00A0'.repeat(c.depth) + c.name}
                        </option>,
                      )
                    }
                    return acc
                  }, [])}
                </select>
              </div>

              <div>
                <label
                  htmlFor='cat-desc'
                  className='mb-1.5 block text-sm font-semibold text-text-secondary'
                >
                  {m.admin_categories_description_label()}
                </label>
                <textarea
                  id='cat-desc'
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                  placeholder={m.admin_categories_description_placeholder()}
                />
              </div>
            </div>

            <div className='mt-6 flex justify-end gap-3'>
              <Button
                variant='secondary'
                onClick={() => setUi((prev) => ({ ...prev, dialogOpen: false }))}
              >
                {m.admin_common_cancel()}
              </Button>
              <Button onClick={handleSubmit} isLoading={ui.isSubmitting}>
                {ui.dialogMode === 'create'
                  ? m.admin_categories_create()
                  : m.admin_common_confirm()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={!!ui.deleteTarget}
        onOpenChange={(open) => !open && setUi((prev) => ({ ...prev, deleteTarget: null }))}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='max-w-md'>
            <DialogTitle>
              {m.admin_categories_delete_title({ name: ui.deleteTarget?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{m.admin_categories_delete_description()}</DialogDescription>

            <div className='mt-6 flex justify-end gap-3'>
              <Button
                variant='secondary'
                onClick={() => setUi((prev) => ({ ...prev, deleteTarget: null }))}
              >
                {m.admin_common_cancel()}
              </Button>
              <Button variant='danger' onClick={handleDelete} isLoading={ui.isDeleting}>
                {m.admin_categories_delete_confirm()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Pending / Error                             */
/* -------------------------------------------------------------------------- */

export function AdminCategoriesPending() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <Skeleton className='size-10' />
          <Skeleton className='mt-2 size-5' />
        </div>
        <Skeleton className='size-10' />
      </div>
      <Skeleton className='h-64 w-full' />
    </div>
  )
}

export function AdminCategoriesError({ error }: { error: Error }) {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_categories_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_categories_description()}</p>
      </div>
      <div
        role='alert'
        className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
      >
        <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
        {error.message}
      </div>
    </div>
  )
}
