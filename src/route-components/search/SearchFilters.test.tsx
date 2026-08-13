// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SearchFacets } from '#/lib/products/types'
import { SearchFilters } from './SearchFilters'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

const categories = [
  { id: '1', name: 'Pottery', slug: 'pottery' },
  { id: '2', name: 'Tableware', slug: 'tableware' },
]

const baseFilters = {
  query: '',
  category: '',
  shop: '',
  minPrice: '',
  maxPrice: '',
  inStock: '',
  sort: 'relevance',
}

function renderFilters(overrides: Partial<React.ComponentProps<typeof SearchFilters>> = {}) {
  const navigateWithParams = vi.fn()
  render(
    <SearchFilters
      filters={baseFilters}
      setFilters={vi.fn()}
      categories={categories}
      navigateWithParams={navigateWithParams}
      hasActiveFilters={false}
      {...overrides}
    />,
  )
  return { navigateWithParams }
}

describe('SearchFilters', () => {
  it('renders category options without counts when facets are absent', () => {
    // The PostgreSQL fallback cannot produce facet counts cheaply, so the UI
    // must degrade to plain names rather than showing "(undefined)".
    renderFilters()

    expect(screen.getByRole('option', { name: 'Pottery' })).toBeDefined()
  })

  it('annotates category options with facet counts when available', () => {
    const facets: SearchFacets = {
      categorySlug: { pottery: 23, tableware: 4 },
      inStock: { true: 19 },
      priceCents: { min: 500, max: 90000 },
    }
    renderFilters({ facets })

    expect(screen.getByRole('option', { name: 'Pottery (23)' })).toBeDefined()
    expect(screen.getByRole('option', { name: 'Tableware (4)' })).toBeDefined()
  })

  it('exposes an in-stock checkbox that reflects the active filter', () => {
    renderFilters({ filters: { ...baseFilters, inStock: 'true' } })

    const checkbox = screen.getByRole('checkbox', { name: /in stock only/i })
    expect((checkbox as HTMLInputElement).checked).toBe(true)
  })

  it('navigates with the in-stock filter and resets to the first page', () => {
    const { navigateWithParams } = renderFilters()

    fireEvent.click(screen.getByRole('checkbox', { name: /in stock only/i }))

    expect(navigateWithParams).toHaveBeenCalledWith({ inStock: 'true', page: 1 })
  })

  it('clears the in-stock filter rather than sending an empty value', () => {
    const { navigateWithParams } = renderFilters({
      filters: { ...baseFilters, inStock: 'true' },
    })

    fireEvent.click(screen.getByRole('checkbox', { name: /in stock only/i }))

    expect(navigateWithParams).toHaveBeenCalledWith({ inStock: undefined, page: 1 })
  })

  it('labels the price inputs so they are reachable by name', () => {
    renderFilters()

    expect(screen.getByLabelText(/min price/i)).toBeDefined()
    expect(screen.getByLabelText(/max price/i)).toBeDefined()
  })
})
