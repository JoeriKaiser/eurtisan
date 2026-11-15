// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import ForbiddenPage from './ForbiddenPage'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    forbidden_title: () => 'Access denied',
    forbidden_description: () => 'You do not have permission to view this page.',
    forbidden_go_home: () => 'Return home',
  },
}))

describe('ForbiddenPage', () => {
  it('renders accessible semantic error styling and a 44px primary CTA', async () => {
    const { container } = render(<ForbiddenPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Access denied' })).toBeDefined()

    const homeLink = screen.getByRole('link', { name: 'Return home' })
    expect(homeLink.getAttribute('href')).toBe('/')
    expect(homeLink.className).toContain('h-11')
    expect(homeLink.className).toContain('bg-accent-primary')
    expect(container.innerHTML).not.toContain('neutral-')
    expect(container.innerHTML).not.toContain('text-red-')

    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  })
})
