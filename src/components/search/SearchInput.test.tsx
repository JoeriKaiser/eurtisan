// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SearchInput from './SearchInput'

/**
 * The overlay implements its own arrow-key navigation, which is only conveyed
 * to assistive technology through these attributes. They are easy to drop in a
 * refactor and produce no visible symptom, so they are asserted directly.
 */
describe('SearchInput accessibility contract', () => {
  const noop = () => {}

  it('exposes combobox semantics wired to the suggestion listbox', () => {
    render(
      <SearchInput
        value=''
        onChange={noop}
        onSubmit={noop}
        onClear={noop}
        listboxId='search-suggestions'
        isExpanded={false}
      />,
    )

    const input = screen.getByRole('combobox')
    expect(input.getAttribute('aria-controls')).toBe('search-suggestions')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
  })

  it('reports the expanded state when suggestions are showing', () => {
    render(
      <SearchInput
        value='ceramic'
        onChange={noop}
        onSubmit={noop}
        onClear={noop}
        listboxId='search-suggestions'
        isExpanded
      />,
    )

    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true')
  })

  it('points aria-activedescendant at the highlighted option', () => {
    render(
      <SearchInput
        value='ceramic'
        onChange={noop}
        onSubmit={noop}
        onClear={noop}
        listboxId='search-suggestions'
        isExpanded
        activeOptionId='search-suggestion-2'
      />,
    )

    expect(screen.getByRole('combobox').getAttribute('aria-activedescendant')).toBe(
      'search-suggestion-2',
    )
  })

  it('omits aria-activedescendant when nothing is highlighted', () => {
    render(
      <SearchInput value='ceramic' onChange={noop} onSubmit={noop} onClear={noop} isExpanded />,
    )

    expect(screen.getByRole('combobox').hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('submits on Enter', () => {
    const onSubmit = vi.fn()
    render(<SearchInput value='ceramic' onChange={noop} onSubmit={onSubmit} onClear={noop} />)

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('labels the clear control for screen readers', () => {
    const onClear = vi.fn()
    render(<SearchInput value='ceramic' onChange={noop} onSubmit={noop} onClear={onClear} />)

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
