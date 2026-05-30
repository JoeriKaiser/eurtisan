import type * as React from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import type { AdminCategoryItem } from '#/lib/admin-categories'
import { m } from '#/paraglide/messages'

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  form: {
    name: string
    slug: string
    description: string
    parentId: string
  }
  onFormChange: (form: {
    name: string
    slug: string
    description: string
    parentId: string
  }) => void
  onSubmit: () => void
  isSubmitting: boolean
  actionError: string | null
  treeCategories: AdminCategoryItem[]
}

const maxDepth = 3

export function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  onFormChange,
  onSubmit,
  isSubmitting,
  actionError,
  treeCategories,
}: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md'>
          <DialogTitle>
            {mode === 'create'
              ? m.admin_categories_create_title()
              : m.admin_categories_edit_title()}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? m.admin_categories_create_description()
              : m.admin_categories_edit_description()}
          </DialogDescription>

          {actionError && (
            <div className='mt-4 rounded-lg border border-error/30 bg-error-subtle p-3 text-sm text-error'>
              {actionError}
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
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
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
                onChange={(e) => onFormChange({ ...form, slug: e.target.value })}
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
                onChange={(e) => onFormChange({ ...form, parentId: e.target.value })}
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
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                rows={3}
                className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                placeholder={m.admin_categories_description_placeholder()}
              />
            </div>
          </div>

          <div className='mt-6 flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => onOpenChange(false)}>
              {m.admin_common_cancel()}
            </Button>
            <Button onClick={onSubmit} isLoading={isSubmitting}>
              {mode === 'create' ? m.admin_categories_create() : m.admin_common_confirm()}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
