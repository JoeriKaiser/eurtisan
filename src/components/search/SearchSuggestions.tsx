import { Link } from '@tanstack/react-router'
import { ArrowRight, Package, Search } from 'lucide-react'
import { cn } from '#/lib/cn'
import type { SearchSuggestion } from '#/lib/search/suggestions'
import { m } from '#/paraglide/messages'

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[]
  isLoading: boolean
  activeIndex: number
  listboxId: string
  optionId: (index: number) => string
  onSelect: (suggestion: SearchSuggestion) => void
  onHover: (index: number) => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  query: <Search size={14} aria-hidden='true' />,
  product: <Package size={14} aria-hidden='true' />,
  category: <ArrowRight size={14} aria-hidden='true' />,
}

function typeLabel(type: SearchSuggestion['type']): string {
  if (type === 'product') return m.search_suggestions_products()
  if (type === 'category') return m.search_suggestions_categories()
  return m.search_suggestion_type_query()
}

export default function SearchSuggestions({
  suggestions,
  isLoading,
  activeIndex,
  listboxId,
  optionId,
  onSelect,
  onHover,
}: SearchSuggestionsProps) {
  if (isLoading) {
    return (
      <div className='p-4'>
        <div className='space-y-2'>
          {[1, 2, 3].map((i) => (
            <div
              key={`skeleton-${i}`}
              className='h-9 animate-pulse rounded-lg bg-surface-inset'
              aria-hidden='true'
            />
          ))}
        </div>
        <span className='sr-only'>{m.search_loading_suggestions()}</span>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return <div className='p-4 text-sm text-text-secondary'>{m.search_press_enter()}</div>
  }

  return (
    <ul
      id={listboxId}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: pairs with the input's role="combobox"
      role='listbox'
      aria-label={m.search_suggestions_label()}
      className='max-h-80 overflow-y-auto py-2'
    >
      {suggestions.map((suggestion, index) => {
        const isActive = index === activeIndex
        const icon = TYPE_ICONS[suggestion.type]
        const itemId = optionId(index)

        const body = (
          <>
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-md',
                isActive
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'bg-surface-inset text-text-muted',
              )}
              aria-hidden='true'
            >
              {icon}
            </span>
            <span className='flex-1'>
              <span className='font-medium'>{suggestion.label}</span>
              <span className='ml-2 text-xs text-text-muted'>{typeLabel(suggestion.type)}</span>
            </span>
          </>
        )

        const className = cn(
          'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
          isActive
            ? 'bg-accent-primary-subtle text-text-primary'
            : 'text-text-secondary hover:bg-bg-inset hover:text-text-primary',
        )

        return (
          // `role="none"` on the wrapper keeps the option role on the
          // interactive element, so the anchor stays a real link (middle-click,
          // open-in-new-tab) while remaining a valid listbox child.
          <li
            key={itemId}
            role='none'
            ref={
              isActive
                ? (node) => node?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
                : undefined
            }
            onMouseEnter={() => onHover(index)}
          >
            {suggestion.href ? (
              <Link
                to={suggestion.href}
                id={itemId}
                role='option'
                aria-selected={isActive}
                // Focus stays on the input; aria-activedescendant conveys position.
                tabIndex={-1}
                className={className}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(suggestion)
                }}
              >
                {body}
                {suggestion.type === 'category' && (
                  <span className='text-xs text-text-muted'>
                    {m.search_view_all_in({ category: suggestion.label })}
                  </span>
                )}
              </Link>
            ) : (
              <button
                type='button'
                id={itemId}
                role='option'
                aria-selected={isActive}
                tabIndex={-1}
                className={className}
                onClick={() => onSelect(suggestion)}
              >
                {body}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
