import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { useRecentSearches } from '#/hooks/useRecentSearches'
import { useSearchCategories } from '#/hooks/useSearchCategories'
import { useSearchClickTracking } from '#/hooks/useSearchClickTracking'
import type { OverlayProduct } from '#/hooks/useSearchOverlayResults'
import { useSearchOverlayResults } from '#/hooks/useSearchOverlayResults'
import { cn } from '#/lib/cn'
import type { SearchSuggestion } from '#/lib/search/suggestions'
import { buildSuggestions } from '#/lib/search/suggestions'
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

const LISTBOX_ID = 'search-suggestions'
const optionId = (index: number) => `search-suggestion-${index}`

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { addSearch } = useRecentSearches()
  const trackClick = useSearchClickTracking()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  // One request covers products, category facets, and highlighting.
  const {
    data: results,
    isLoading: resultsLoading,
    isError: resultsError,
  } = useSearchOverlayResults(debouncedQuery, isOpen)

  // Browsing state (no query) still lists the full category tree.
  const { categories: browseCategories, isLoading: browseCategoriesLoading } = useSearchCategories(
    query,
    isOpen,
  )

  const suggestions = useMemo(
    () => buildSuggestions(debouncedQuery, results?.products ?? [], results?.categories ?? []),
    [debouncedQuery, results],
  )

  const resultCategories = useMemo(
    () =>
      (results?.categories ?? []).map((category) => ({
        id: category.slug,
        name: category.name,
        slug: category.slug,
        count: category.count,
      })),
    [results],
  )

  const popupOwnerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    return () => {
      if (debounceTimerRef.current !== undefined) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setActiveIndex(-1)
    if (debounceTimerRef.current !== undefined) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => setDebouncedQuery(value), 150)
  }, [])

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
        return
      }
      if (!suggestion.href) return

      // A product suggestion is a search result being opened; record its rank.
      if (suggestion.type === 'product') {
        const position = (results?.products ?? []).findIndex((p) => p.slug === suggestion.slug)
        const product = position >= 0 ? results?.products[position] : undefined
        if (product) trackClick(debouncedQuery, product.id, position + 1)
      }

      addSearch(suggestion.label)
      onClose()
      navigate({ to: suggestion.href })
    },
    [executeSearch, addSearch, navigate, onClose, results, trackClick, debouncedQuery],
  )

  const handleSelectResult = useCallback(
    (product: OverlayProduct, position: number) => {
      trackClick(debouncedQuery, product.id, position)
      onClose()
    },
    [trackClick, debouncedQuery, onClose],
  )

  const handleSubmit = useCallback(() => {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      handleSelectSuggestion(suggestions[activeIndex])
    } else {
      executeSearch(query)
    }
  }, [activeIndex, suggestions, handleSelectSuggestion, executeSearch, query])

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (query.length > 0) {
          setQuery('')
          setDebouncedQuery('')
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

  const handleClear = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }, [])

  const hasQuery = query.trim().length > 0
  const products = results?.products ?? []
  const hasNoResults = hasQuery && !resultsLoading && !resultsError && products.length === 0

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup
          ref={popupOwnerRef}
          placement='top'
          onKeyDown={handleContainerKeyDown}
          className={cn(
            'max-h-[100dvh] w-full max-w-none sm:max-h-[80dvh] sm:w-[640px] sm:max-w-[90vw]',
            'flex flex-col overflow-hidden rounded-b-2xl p-0 sm:rounded-2xl',
          )}
        >
          <DialogTitle className='sr-only'>{m.search_overlay_title()}</DialogTitle>
          {/* Input area */}
          <div className='border-b border-border-default p-3 sm:p-4'>
            <SearchInput
              inputRef={inputRef}
              value={query}
              onChange={handleQueryChange}
              autoFocus
              onSubmit={handleSubmit}
              onClear={handleClear}
              listboxId={LISTBOX_ID}
              isExpanded={hasQuery && suggestions.length > 0}
              activeOptionId={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            />
          </div>

          {/* Results area */}
          <div className='min-h-0 flex-1 overflow-y-auto'>
            {hasQuery ? (
              <>
                <SearchSuggestions
                  suggestions={suggestions}
                  isLoading={resultsLoading}
                  activeIndex={activeIndex}
                  listboxId={LISTBOX_ID}
                  optionId={optionId}
                  onSelect={handleSelectSuggestion}
                  onHover={setActiveIndex}
                />
                {resultCategories.length > 0 ? (
                  <div className='border-t border-border-default'>
                    <SearchCategoriesPanel
                      categories={resultCategories}
                      isLoading={false}
                      query={query}
                    />
                  </div>
                ) : null}
                <div className='border-t border-border-default'>
                  {hasNoResults ? (
                    <SearchNoResults query={query} onSelectQuery={executeSearch} />
                  ) : (
                    <SearchResultsPanel
                      products={products}
                      total={results?.total ?? 0}
                      query={query}
                      isLoading={resultsLoading}
                      isError={resultsError}
                      onSelectResult={handleSelectResult}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <SearchCategoriesPanel
                  categories={browseCategories}
                  isLoading={browseCategoriesLoading}
                  query={query}
                />
                <div className='border-t border-border-default'>
                  <SearchEmptyState onSelectQuery={(q) => executeSearch(q)} />
                </div>
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className='hidden items-center justify-between border-t border-border-default bg-surface-inset px-4 py-2 text-xs text-text-muted sm:flex'>
            <div className='flex items-center gap-3'>
              <span className='flex items-center gap-1'>
                <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
                  ↑
                </kbd>
                <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
                  ↓
                </kbd>
                <span>{m.search_hint_navigate()}</span>
              </span>
              <span className='flex items-center gap-1'>
                <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
                  ↵
                </kbd>
                <span>{m.search_hint_select()}</span>
              </span>
            </div>
            <span className='flex items-center gap-1'>
              <kbd className='rounded border border-border-default bg-surface-default px-1 py-0.5 text-[10px]'>
                Esc
              </kbd>
              <span>{m.search_hint_close()}</span>
            </span>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

/**
 * Zero-result recovery. A dead end is the worst outcome of a search, so offer
 * concrete next steps rather than only reporting the absence of matches.
 */
function SearchNoResults({
  query,
  onSelectQuery,
}: {
  query: string
  onSelectQuery: (query: string) => void
}) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  // Fewer words match more broadly: dropping the last one is the cheapest
  // useful relaxation of an over-specific query.
  const broaderQuery = words.length > 1 ? words.slice(0, -1).join(' ') : null

  return (
    <div className='p-4 sm:p-6' aria-live='polite'>
      <p className='text-sm font-medium text-text-primary'>
        {m.search_no_products_found({ query })}
      </p>
      <ul className='mt-3 space-y-1.5 text-sm text-text-secondary'>
        <li>{m.search_no_results_tip_spelling()}</li>
        <li>{m.search_no_results_tip_general()}</li>
      </ul>
      {broaderQuery ? (
        <button
          type='button'
          onClick={() => onSelectQuery(broaderQuery)}
          className='mt-4 inline-flex min-h-11 items-center rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-surface-inset'
        >
          {m.search_no_results_try_broader({ query: broaderQuery })}
        </button>
      ) : null}
    </div>
  )
}
