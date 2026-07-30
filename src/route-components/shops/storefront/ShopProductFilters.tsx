import { X } from 'lucide-react'
import type { ShopProductCategory, SortOption } from '#/lib/products'
import { m } from '#/paraglide/messages'

export interface ShopProductFiltersProps {
  categories: ShopProductCategory[]
  categorySlug: string | undefined
  inStockOnly: boolean
  sort: SortOption
  hasActiveFilters: boolean
  onChange: (overrides: {
    category?: string | undefined
    inStock?: true | undefined
    sort?: SortOption | undefined
  }) => void
  onClear: () => void
}

/**
 * Browsing controls for one shop's catalogue.
 *
 * Wording is shared with `/search` (`search_sort_*`, `search_filter_*`) rather
 * than duplicated: the same control should read the same way wherever a buyer
 * meets it, and a reworded translation should not drift between the two.
 *
 * The category list is the shop's own — see `getShopProductCategoriesQuery` —
 * and is hidden entirely for a shop whose products all sit in one category or
 * none, where the control would offer no choice.
 */
export function ShopProductFilters({
  categories,
  categorySlug,
  inStockOnly,
  sort,
  hasActiveFilters,
  onChange,
  onClear,
}: ShopProductFiltersProps) {
  const showCategory = categories.length > 1

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: m.search_sort_newest() },
    { value: 'price_asc', label: m.search_sort_price_asc() },
    { value: 'price_desc', label: m.search_sort_price_desc() },
  ]

  return (
    <div className='mb-6 flex flex-wrap items-end gap-x-6 gap-y-4'>
      {showCategory && (
        <div>
          <label
            htmlFor='shop-filter-category'
            className='mb-1.5 block text-xs font-medium text-text-secondary'
          >
            {m.search_filter_category()}
          </label>
          <select
            id='shop-filter-category'
            value={categorySlug ?? ''}
            onChange={(event) => onChange({ category: event.target.value || undefined })}
            className='h-10 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:border-accent-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
          >
            <option value=''>{m.search_filter_category_all()}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* A fieldset rather than role='group': the sort buttons are one choice
          made of several controls, and the legend names it for screen readers
          without a second label element. */}
      <fieldset className='m-0 border-0 p-0'>
        <legend className='mb-1.5 block text-xs font-medium text-text-secondary'>
          {m.search_sort_label()}
        </legend>
        <div className='flex flex-wrap gap-2'>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() =>
                onChange({ sort: option.value === 'newest' ? undefined : option.value })
              }
              aria-pressed={sort === option.value}
              className={`min-h-10 rounded-lg px-3 py-2 text-sm transition-colors ${
                sort === option.value
                  ? 'bg-accent-primary text-text-on-primary'
                  : 'bg-surface-inset text-text-secondary hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className='flex min-h-10 cursor-pointer items-center gap-2 text-sm text-text-primary'>
        <input
          type='checkbox'
          checked={inStockOnly}
          onChange={(event) => onChange({ inStock: event.target.checked || undefined })}
          className='size-4 rounded border-border-default text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
        />
        <span>{m.search_filter_in_stock_only()}</span>
      </label>

      {hasActiveFilters && (
        <button
          type='button'
          onClick={onClear}
          className='inline-flex min-h-10 items-center gap-1.5 py-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary'
        >
          <X size={15} aria-hidden='true' />
          {m.search_clear_filters()}
        </button>
      )}
    </div>
  )
}
