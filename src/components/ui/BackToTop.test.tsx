// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { BackToTop } from './BackToTop'

describe('BackToTop', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
    window.scrollTo = vi.fn()
  })

  it('does not render when window.scrollY is below threshold', () => {
    const { container } = render(<BackToTop threshold={400} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders and scrolls to top on click when scrolled past threshold', () => {
    render(<BackToTop threshold={400} />)

    act(() => {
      window.scrollY = 500
      window.dispatchEvent(new Event('scroll'))
    })

    const button = screen.getByRole('button', { name: /Back to top|Haut de page|Nach oben/i })
    expect(button).toBeTruthy()

    fireEvent.click(button)
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    })
  })

  it('has no automated accessibility violations when visible', async () => {
    window.scrollY = 600
    const { container } = render(<BackToTop threshold={400} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
