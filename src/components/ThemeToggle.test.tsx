// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle'

vi.mock('#/paraglide/messages', () => ({
  m: {
    theme_label_light: () => 'Switch to dark mode',
    theme_label_dark: () => 'Switch to light mode',
  },
}))

function setupMatchMedia(prefersDark = false) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    cleanup()
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.removeAttribute('data-theme')
    window.localStorage.clear()
    setupMatchMedia(false)
  })

  it('toggles from light to dark and updates the document theme', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')

    fireEvent.click(button)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('theme')).toBe('dark')
  })

  it('toggles back to light mode from dark', () => {
    window.localStorage.setItem('theme', 'dark')
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')

    render(<ThemeToggle />)
    const button = screen.getByRole('button')

    fireEvent.click(button)

    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('theme')).toBe('light')
  })
})
