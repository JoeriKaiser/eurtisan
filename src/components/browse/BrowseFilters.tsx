import { X } from 'lucide-react'
import { Input } from '#/components/ui/input'
import type { SortOption } from '#/lib/products'
import { m } from '#/paraglide/messages'

export interface BrowseFilterChange {
  category?: string | undefined
  inStock?: true | undefined
  sort?: SortOption | undefined
  minPrice?: string | undefined
  maxPrice?: string | undefined
}

export interface BrowseFiltersProps {
  /** Omit to hide the category control entirely — see `showCategory` below. */
  categories?: { id: string; name: string; slug: string }[]
  categorySlug?: string
  /** Facet counts by slug. Absent when the backing query cannot produce them. */
  categoryCounts?: Record<string, number>
  /** Omit to hide the price controls. Values are the raw input strings. */
  price?: { min: string; max: string }
  inStockOnly: boolean
  /** Facet count for the in-stock filter, when available. */
  inStockCount?: number
  sort: SortOption
  hasActiveFilters: boolean
  onChange: (overrides: BrowseFilterChange) => void
  onClear: () => void
}

/**
 * Browsing controls shared by the surfaces that list products.
 *
 * Wording comes from the `search_*` message keys rather than being duplicated
 * per surface: the same control should read the same way wherever a buyer meets
 * it, and a reworded translation should not drift between them.
 *
 * Every group is optional so a surface shows only what it can actually filter —
 * a shop storefront has no price facet, and a category page has no in-shop
 * category list. Controls are omitted rather than disabled, because a control
 * that cannot do anything is worse than no control.
 *
 * NOTE: `/search` deliberately does not use this component. Its sort is a set of
 * `<Link aria-current>` inside a `<nav>` and its filters live in a collapsible
 * `<details>` aside with string-typed state; reconciling those is a navigation
 * semantics decision, not a refactor. Tracked in the category plan §3.
 */
export function BrowseFilters({
  categories,
  categorySlug,
  categoryCounts,
  price,
  inStockOnly,
  inStockCount,
  sort,
  hasActiveFilters,
  onChange,
  onClear,
}: BrowseFiltersProps) {
  // One entry is no choice at all, so the control is dropped rather than shown
  // with a single option beside "All".
  const showCategory = (categories?.length ?? 0) > 1

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: m.search_sort_newest() },
    { value: 'price_asc', label: m.search_sort_price_asc() },
    { value: 'price_desc', label: m.search_sort_price_desc() },
  ]

  const categoryLabel = (name: string, slug: string): string => {
    const count = categoryCounts?.[slug]
    return count === undefined ? name : `${name} (${count})`
  }

  return (
    <div className='mb-6 flex flex-wrap items-end gap-x-6 gap-y-4'>
      {showCategory && (
        <div>
          <label
            htmlFor='browse-filter-category'
            className='mb-1.5 block text-xs font-medium text-text-secondary'
          >
            {m.search_filter_category()}
          </label>
          <select
            id='browse-filter-category'
            value={categorySlug ?? ''}
            onChange={(event) => onChange({ category: event.target.value || undefined })}
            className='h-10 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:border-accent-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
          >
            <option value=''>{m.search_filter_category_all()}</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.slug}>
                {categoryLabel(category.name, category.slug)}
              </option>
            ))}
          </select>
        </div>
      )}

      {price && (
        <div>
          <span className='mb-1.5 block text-xs font-medium text-text-secondary'>
            {m.search_filter_price_eur()}
          </span>
          <div className='flex items-center gap-2'>
            <Input
              type='number'
              min={0}
              step='0.01'
              placeholder={m.search_filter_min_price()}
              defaultValue={price.min}
              // Committed on blur and Enter rather than on every keystroke: a
              // navigation per digit would make the field unusable.
              onBlur={(event) => onChange({ minPrice: event.target.value || undefined })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onChange({ minPrice: event.currentTarget.value || undefined })
                }
              }}
              className='h-10 w-28 text-sm'
              aria-label={m.search_filter_min_price()}
            />
            <span className='text-text-muted' aria-hidden='true'>
              -
            </span>
            <Input
              type='number'
              min={0}
              step='0.01'
              placeholder={m.search_filter_max_price()}
              defaultValue={price.max}
              onBlur={(event) => onChange({ maxPrice: event.target.value || undefined })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onChange({ maxPrice: event.currentTarget.value || undefined })
                }
              }}
              className='h-10 w-28 text-sm'
              aria-label={m.search_filter_max_price()}
            />
          </div>
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
        <span>
          {m.search_filter_in_stock_only()}
          {inStockCount === undefined ? null : (
            <span className='text-text-muted'> ({inStockCount})</span>
          )}
        </span>
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
