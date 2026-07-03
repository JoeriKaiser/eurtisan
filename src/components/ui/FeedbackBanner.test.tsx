// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { Star } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { FeedbackBanner } from './FeedbackBanner'

describe('FeedbackBanner', () => {
  it('renders a success banner with status role and polite live region', () => {
    render(<FeedbackBanner type='success' message='Saved successfully' />)

    const banner = screen.getByRole('status')
    expect(banner).toBeDefined()
    expect(banner.getAttribute('aria-live')).toBe('polite')
    expect(banner.textContent).toContain('Saved successfully')
  })

  it('renders an error banner with alert role and assertive live region', () => {
    render(<FeedbackBanner type='error' message='Something went wrong' />)

    const banner = screen.getByRole('alert')
    expect(banner).toBeDefined()
    expect(banner.getAttribute('aria-live')).toBe('assertive')
    expect(banner.textContent).toContain('Something went wrong')
  })

  it('renders an info banner with status role and polite live region', () => {
    render(<FeedbackBanner type='info' message='Please check your inbox' />)

    const banner = screen.getByRole('status')
    expect(banner).toBeDefined()
    expect(banner.getAttribute('aria-live')).toBe('polite')
    expect(banner.textContent).toContain('Please check your inbox')
  })

  it('applies medium size and bottom margin by default', () => {
    render(<FeedbackBanner type='success' message='Default size' />)

    const banner = screen.getByRole('status')
    expect(banner.className).toContain('mb-6')
    expect(banner.className).toContain('p-4')
    expect(banner.className).toContain('text-sm')
  })

  it('applies small size without page-level bottom margin', () => {
    render(<FeedbackBanner type='error' message='Small size' size='sm' />)

    const banner = screen.getByRole('alert')
    expect(banner.className).not.toContain('mb-6')
    expect(banner.className).toContain('p-3')
    expect(banner.className).toContain('text-xs')
  })

  it('renders a custom icon when provided', () => {
    render(<FeedbackBanner type='info' message='Custom icon' icon={Star} />)

    const banner = screen.getByRole('status')
    expect(banner.querySelector('svg')).toBeDefined()
    expect(banner.textContent).toContain('Custom icon')
  })

  it('maps each type to the expected semantic style', () => {
    const { rerender } = render(<FeedbackBanner type='success' message='Success' />)
    expect(screen.getByRole('status').className).toContain('border-success')

    rerender(<FeedbackBanner type='error' message='Error' />)
    expect(screen.getByRole('alert').className).toContain('border-error')

    rerender(<FeedbackBanner type='info' message='Info' />)
    expect(screen.getByRole('status').className).toContain('border-border-default')
  })
})
