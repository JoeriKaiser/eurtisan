// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RootError } from './RootError'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string
    children: React.ReactNode
    className?: string
    [key: string]: unknown
  }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    checkout_error_generic: () => 'Something went wrong. Please try again.',
    error_unexpected: () => 'An unexpected error occurred',
    admin_error_retry: () => 'Retry',
    error_go_home: () => 'Go back home',
  },
}))

describe('RootError', () => {
  it('renders localized heading and home recovery link', () => {
    render(<RootError error={new Error('Test failure')} reset={() => {}} />)

    expect(
      screen.getByRole('heading', { name: 'Something went wrong. Please try again.' }),
    ).toBeDefined()
    const homeLink = screen.getByRole('link', { name: 'Go back home' })
    expect(homeLink.getAttribute('href')).toBe('/')
  })

  it('renders retry button and triggers reset callback when provided', () => {
    const reset = vi.fn()
    render(<RootError error={new Error('Test failure')} reset={reset} />)

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton).toBeDefined()

    fireEvent.click(retryButton)
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
