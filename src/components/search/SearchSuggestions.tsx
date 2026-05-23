import { Link } from '@tanstack/react-router'
import { ArrowRight, Package, Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { SearchSuggestion } from '#/hooks/useSearchSuggestions'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[]
  query: string
  isLoading: boolean
  activeIndex: number
  onSelect: (suggestion: SearchSuggestion) => void
  onHover: (index: number) => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  query: <Search size={14} aria-hidden='true' />,
  product: <Package size={14} aria-hidden='true' />,
  category: <ArrowRight size={14} aria-hidden='true' />,
}

const TYPE_LABELS: Record<string, string> = {
  query: 'Search',
  product: m.search_suggestions_products(),
  category: m.search_suggestions_categories(),
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const escapedTerms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (escapedTerms.length === 0) return <>{text}</>

  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi')
  const elements: React.ReactNode[] = []
  let match: RegExpExecArray | null
  let lastIndex = 0

  for (;;) {
    match = pattern.exec(text)
    if (match === null) break
    if (match.index > lastIndex) {
      elements.push(<span key={`pre-${match.index}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    elements.push(
      <mark key={match.index} className='bg-transparent font-semibold text-text-primary'>
        {match[0]}
      </mark>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    elements.push(<span key={`post-${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return <>{elements}</>
}

export default function SearchSuggestions({
  suggestions,
  query,
  isLoading,
  activeIndex,
  onSelect,
  onHover,
}: SearchSuggestionsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const item = itemRefs.current[activeIndex]
    if (item && listRef.current) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex])

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
        <span className='sr-only'>Loading suggestions</span>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return <div className='p-4 text-sm text-text-secondary'>{m.search_press_enter()}</div>
  }

  return (
    <div
      ref={listRef}
      role='listbox'
      aria-label='Search suggestions'
      className='max-h-80 overflow-y-auto py-2'
    >
      {suggestions.map((suggestion, index) => {
        const isActive = index === activeIndex
        const icon = TYPE_ICONS[suggestion.type]
        const typeLabel = TYPE_LABELS[suggestion.type]
        const itemId = `suggestion-${suggestion.type}-${suggestion.label}-${index}`

        return (
          <div
            key={itemId}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            role='option'
            aria-selected={isActive}
            onMouseEnter={() => onHover(index)}
            tabIndex={-1}
          >
            {suggestion.href ? (
              <Link
                to={suggestion.href}
                id={itemId}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-accent-primary-subtle text-text-primary'
                    : 'text-text-secondary hover:bg-bg-inset hover:text-text-primary',
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(suggestion)
                }}
              >
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
                  <span className='font-medium'>
                    <HighlightText text={suggestion.label} query={query} />
                  </span>
                  <span className='ml-2 text-xs text-text-muted'>{typeLabel}</span>
                </span>
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
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-accent-primary-subtle text-text-primary'
                    : 'text-text-secondary hover:bg-bg-inset hover:text-text-primary',
                )}
                onClick={() => onSelect(suggestion)}
              >
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
                  <span className='font-medium'>
                    <HighlightText text={suggestion.label} query={query} />
                  </span>
                  <span className='ml-2 text-xs text-text-muted'>{typeLabel}</span>
                </span>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
