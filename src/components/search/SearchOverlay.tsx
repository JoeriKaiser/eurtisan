import { useNavigate, useRouter } from '@tanstack/react-router'
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

interface SearchOverlayCategory {
  id: string
  name: string
  slug: string
}

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  /** Preloaded root categories from the root route loader to avoid a redundant fetch on open. */
  initialCategories?: readonly SearchOverlayCategory[]
}

const LISTBOX_ID = 'search-suggestions'
const optionId = (index: number) => `search-suggestion-${index}`
const DEBOUNCE_MS = 150
const MAX_BROWSE_CATEGORIES = 8

export default function SearchOverlay({ isOpen, onClose, initialCategories }: SearchOverlayProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const { addSearch } = useRecentSearches()
  const trackClick = useSearchClickTracking()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmedQuery = query.trim()
  const trimmedDebouncedQuery = debouncedQuery.trim()
  const hasQuery = trimmedQuery.length > 0
  const isDebouncing = hasQuery && trimmedQuery !== trimmedDebouncedQuery

  // One request covers products, category facets, and highlighting.
  const {
    data: results,
    isLoading: resultsLoading,
    isFetching: resultsFetching,
    isPlaceholderData,
    isError: resultsError,
  } = useSearchOverlayResults(debouncedQuery, isOpen)

  // Only fetch root categories when the caller did not pass preloaded ones and
  // the overlay is in browse mode (empty query).
  const hasPreloadedCategories = initialCategories !== undefined && initialCategories.length > 0
  const { categories: fetchedBrowseCategories, isLoading: fetchedCategoriesLoading } =
    useSearchCategories('', isOpen && !hasQuery && !hasPreloadedCategories)

  const browseCategories = useMemo(
    () =>
      hasPreloadedCategories
        ? initialCategories.slice(0, MAX_BROWSE_CATEGORIES)
        : fetchedBrowseCategories,
    [hasPreloadedCategories, initialCategories, fetchedBrowseCategories],
  )
  const browseCategoriesLoading = !hasPreloadedCategories && fetchedCategoriesLoading

  const isStaleResults = Boolean(isPlaceholderData) || isDebouncing
  const freshResults = !isPlaceholderData && !isDebouncing ? results : undefined

  const suggestions = useMemo(
    () =>
      buildSuggestions(trimmedQuery, freshResults?.products ?? [], freshResults?.categories ?? []),
    [trimmedQuery, freshResults],
  )

  const resultCategories = useMemo(
    () =>
      (freshResults?.categories ?? []).map((category) => ({
        id: category.slug,
        name: category.name,
        slug: category.slug,
        count: category.count,
      })),
    [freshResults],
  )

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = undefined
    }
  }, [])

  const popupOwnerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return
      // Guarantee the overlay never stays open across any route transition,
      // including nested links and browser back/forward navigation.
      const unsubscribe =
        typeof routerRef.current.subscribe === 'function'
          ? routerRef.current.subscribe('onBeforeNavigate', () => onCloseRef.current())
          : undefined
      return () => {
        clearDebounceTimer()
        unsubscribe?.()
      }
    },
    [clearDebounceTimer],
  )

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      setActiveIndex(-1)
      clearDebounceTimer()
      if (!value.trim()) {
        setDebouncedQuery('')
        return
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = undefined
        setDebouncedQuery(value)
      }, DEBOUNCE_MS)
    },
    [clearDebounceTimer],
  )

  const executeSearch = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim()
      if (!trimmed) return

      clearDebounceTimer()
      addSearch(trimmed)
      onClose()

      navigate({
        to: '/search',
        search: { q: trimmed },
      })
    },
    [clearDebounceTimer, addSearch, navigate, onClose],
  )

  const handleSelectSuggestion = useCallback(
    (suggestion: SearchSuggestion, options?: { fromLink?: boolean }) => {
      if (suggestion.type === 'query') {
        executeSearch(suggestion.label)
        return
      }
      if (!suggestion.href) return

      // A product suggestion is a search result being opened; record its rank
      // only against fresh results so clicks are never attributed to a stale query.
      if (suggestion.type === 'product' && freshResults) {
        const position = freshResults.products.findIndex((p) => p.slug === suggestion.slug)
        const product = position >= 0 ? freshResults.products[position] : undefined
        if (product) trackClick(trimmedDebouncedQuery, product.id, position + 1)
      }

      clearDebounceTimer()
      addSearch(suggestion.label)
      onClose()
      if (!options?.fromLink) {
        navigate({ to: suggestion.href })
      }
    },
    [
      executeSearch,
      freshResults,
      trackClick,
      trimmedDebouncedQuery,
      clearDebounceTimer,
      addSearch,
      onClose,
      navigate,
    ],
  )

  const handleSelectResult = useCallback(
    (product: OverlayProduct, position: number) => {
      if (!isStaleResults && trimmedDebouncedQuery) {
        trackClick(trimmedDebouncedQuery, product.id, position)
      }
      clearDebounceTimer()
      onClose()
    },
    [isStaleResults, trimmedDebouncedQuery, trackClick, clearDebounceTimer, onClose],
  )

  const handleSubmit = useCallback(() => {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      handleSelectSuggestion(suggestions[activeIndex])
    } else {
      executeSearch(query)
    }
  }, [activeIndex, suggestions, handleSelectSuggestion, executeSearch, query])

  const handleClear = useCallback(() => {
    clearDebounceTimer()
    setQuery('')
    setDebouncedQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }, [clearDebounceTimer])

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (query.length > 0) {
          handleClear()
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowDown' && hasQuery && suggestions.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => {
          const next = prev + 1
          return next >= suggestions.length ? 0 : next
        })
      } else if (e.key === 'ArrowUp' && hasQuery && suggestions.length > 0) {
        e.preventDefault()
        setActiveIndex((prev) => {
          const next = prev - 1
          return next < 0 ? suggestions.length - 1 : next
        })
      }
    },
    [query.length, handleClear, onClose, hasQuery, suggestions.length],
  )

  const products = results?.products ?? []
  const showInitialLoading =
    hasQuery &&
    !resultsError &&
    (resultsLoading || ((isDebouncing || Boolean(isPlaceholderData)) && products.length === 0))
  const hasNoResults =
    hasQuery &&
    !isDebouncing &&
    !resultsLoading &&
    !isPlaceholderData &&
    !resultsError &&
    products.length === 0

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
                  isLoading={showInitialLoading}
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
                      onSelectCategory={onClose}
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
                      isLoading={showInitialLoading}
                      isError={resultsError}
                      isStale={isStaleResults && resultsFetching}
                      onSelectResult={handleSelectResult}
                      onViewAll={() => executeSearch(query)}
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
                  onSelectCategory={onClose}
                />
                <div className='border-t border-border-default'>
                  <SearchEmptyState onSelectQuery={executeSearch} onNavigate={onClose} />
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
