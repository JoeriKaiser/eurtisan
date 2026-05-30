import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '#/hooks/useFocusTrap'
import { useRecentSearches } from '#/hooks/useRecentSearches'
import { useSearchCategories } from '#/hooks/useSearchCategories'
import { useSearchResults } from '#/hooks/useSearchResults'
import type { SearchSuggestion } from '#/hooks/useSearchSuggestions'
import { useSearchSuggestions } from '#/hooks/useSearchSuggestions'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'
import SearchCategoriesPanel from './SearchCategoriesPanel'
import SearchEmptyState from './SearchEmptyState'
import SearchInput from './SearchInput'
import SearchResultsPanel from './SearchResultsPanel'
import SearchSuggestions from './SearchSuggestions'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useFocusTrap(isOpen)
  const { addSearch } = useRecentSearches()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const { data: suggestions = [], isLoading: suggestionsLoading } = useSearchSuggestions(
    query,
    isOpen,
  )
  const {
    data: resultsData,
    isLoading: resultsLoading,
    isError: resultsError,
  } = useSearchResults(query, isOpen)
  const { categories, isLoading: categoriesLoading } = useSearchCategories(query, isOpen)

  // Focus input when overlay opens
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [isOpen])

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (query.length > 0) {
          setQuery('')
          setActiveIndex(-1)
          inputRef.current?.focus()
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => {
          const next = prev + 1
          return next >= suggestions.length ? 0 : next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => {
          const next = prev - 1
          return next < 0 ? suggestions.length - 1 : next
        })
      }
    },
    [query, onClose, suggestions.length],
  )

  const executeSearch = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim()
      if (!trimmed) return

      addSearch(trimmed)
      onClose()

      navigate({
        to: '/search',
        search: { q: trimmed },
      })
    },
    [addSearch, navigate, onClose],
  )

  const handleSelectSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.type === 'query') {
        executeSearch(suggestion.label)
      } else if (suggestion.href) {
        addSearch(suggestion.label)
        onClose()
        navigate({ to: suggestion.href })
      }
    },
    [executeSearch, addSearch, navigate, onClose],
  )

  const handleSubmit = useCallback(() => {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      handleSelectSuggestion(suggestions[activeIndex])
    } else {
      executeSearch(query)
    }
  }, [activeIndex, suggestions, handleSelectSuggestion, executeSearch, query])

  const handleClear = useCallback(() => {
    setQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }, [])

  const hasQuery = query.trim().length > 0

  if (!isOpen) return null

  return createPortal(
    <dialog
      className='fixed inset-0 z-modal m-0 flex max-h-none max-w-none flex-col items-start justify-start bg-transparent p-0 sm:items-center sm:justify-start sm:pt-[10vh] open:flex'
      aria-label={m.search_overlay_title()}
      onKeyDown={handleContainerKeyDown}
      open
    >
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-bg-overlay backdrop-blur-sm transition-opacity duration-fast ease-out'
        aria-hidden='true'
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClose()
          }
        }}
        tabIndex={-1}
      />

      {/* Panel */}
      <div
        ref={containerRef}
        className={cn(
          'relative z-modal w-full sm:w-[640px] sm:max-w-[90vw]',
          'flex flex-col overflow-hidden rounded-b-2xl border border-border-default bg-surface-default shadow-xl',
          'sm:rounded-2xl',
          'transition-all duration-fast ease-out',
          'animate-in fade-in slide-in-from-top-2',
        )}
      >
        {/* Input area */}
        <div className='border-b border-border-default p-3 sm:p-4'>
          <SearchInput
            inputRef={inputRef}
            value={query}
            onChange={(value) => {
              setQuery(value)
              setActiveIndex(-1)
            }}
            onSubmit={handleSubmit}
            onClear={handleClear}
          />
        </div>

        {/* Results area */}
        <div className='max-h-[60vh] overflow-y-auto'>
          {hasQuery ? (
            <>
              <SearchSuggestions
                suggestions={suggestions}
                query={query}
                isLoading={suggestionsLoading}
                activeIndex={activeIndex}
                onSelect={handleSelectSuggestion}
                onHover={setActiveIndex}
              />
              <div className='border-t border-border-default'>
                <SearchCategoriesPanel
                  categories={categories}
                  isLoading={categoriesLoading}
                  query={query}
                />
              </div>
              <div className='border-t border-border-default'>
                <SearchResultsPanel
                  products={resultsData?.products ?? []}
                  total={resultsData?.total ?? 0}
                  query={query}
                  isLoading={resultsLoading}
                  isError={resultsError}
                />
              </div>
            </>
          ) : (
            <>
              <SearchCategoriesPanel
                categories={categories}
                isLoading={categoriesLoading}
                query={query}
              />
              <div className='border-t border-border-default'>
                <SearchEmptyState onSelectQuery={(q) => executeSearch(q)} />
              </div>
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className='flex items-center justify-between border-t border-border-default bg-surface-inset px-4 py-2 text-xs text-text-muted'>
          <div className='flex items-center gap-3'>
            <span className='flex items-center gap-1'>
              <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
                ↑
              </kbd>
              <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
                ↓
              </kbd>
              <span>to navigate</span>
            </span>
            <span className='flex items-center gap-1'>
              <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
                ↵
              </kbd>
              <span>to select</span>
            </span>
          </div>
          <span className='flex items-center gap-1'>
            <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
              Esc
            </kbd>
            <span>to close</span>
          </span>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
