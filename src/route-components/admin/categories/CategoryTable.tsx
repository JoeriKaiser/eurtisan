import { ArrowDown, ArrowUp, Folder, Pencil, Trash2 } from 'lucide-react'
import type { AdminCategoryItem } from '#/lib/admin-categories'
import { m } from '#/paraglide/messages'

interface CategoryTableProps {
  categories: AdminCategoryItem[]
  onMove: (categoryId: string, direction: 'up' | 'down') => void
  onEdit: (cat: AdminCategoryItem) => void
  onDelete: (cat: AdminCategoryItem) => void
}

export function CategoryTable({ categories, onMove, onEdit, onDelete }: CategoryTableProps) {
  return (
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
                  <Folder size={16} className='text-text-muted flex-shrink-0' aria-hidden='true' />
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
                    onClick={() => onMove(cat.id, 'up')}
                    className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                    aria-label={m.admin_categories_move_up({ name: cat.name })}
                    title={m.admin_categories_move_up({ name: cat.name })}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type='button'
                    onClick={() => onMove(cat.id, 'down')}
                    className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                    aria-label={m.admin_categories_move_down({ name: cat.name })}
                    title={m.admin_categories_move_down({ name: cat.name })}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type='button'
                    onClick={() => onEdit(cat)}
                    className='rounded p-1.5 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
                    aria-label={m.admin_categories_edit({ name: cat.name })}
                    title={m.admin_categories_edit({ name: cat.name })}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type='button'
                    onClick={() => onDelete(cat)}
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
  )
}
