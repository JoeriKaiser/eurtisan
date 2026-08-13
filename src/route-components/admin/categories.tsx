import { useLoaderData } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle, Inbox, Plus } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import type { AdminCategoryItem } from '#/lib/admin-categories'
import { listCategoriesAdmin, moveCategory } from '#/lib/admin-categories'
import { createCategory, deleteCategory, updateCategory } from '#/lib/categories'
import { m } from '#/paraglide/messages'
import { CategoryFormDialog } from './categories/CategoryFormDialog'
import { CategoryTable } from './categories/CategoryTable'
import { DeleteDialog } from './categories/DeleteDialog'
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
        <CategoryTable
          categories={categories}
          onMove={handleMove}
          onEdit={openEditDialog}
          onDelete={(cat) => setUi((prev) => ({ ...prev, deleteTarget: cat }))}
        />
      )}

      <CategoryFormDialog
        open={ui.dialogOpen}
        onOpenChange={(open) => setUi((prev) => ({ ...prev, dialogOpen: open }))}
        mode={ui.dialogMode}
        form={form}
        onFormChange={setForm}
        onSubmit={handleSubmit}
        isSubmitting={ui.isSubmitting}
        actionError={ui.actionError}
        treeCategories={treeCategories}
      />

      <DeleteDialog
        target={ui.deleteTarget}
        onClose={() => setUi((prev) => ({ ...prev, deleteTarget: null }))}
        onConfirm={handleDelete}
        isDeleting={ui.isDeleting}
      />
    </div>
  )
}
