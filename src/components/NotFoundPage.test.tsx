// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotFoundPage } from './NotFoundPage'

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
    error_not_found: () => 'Page not found',
    error_not_found_description: () => 'The page you are looking for does not exist.',
    not_found_back_cta: () => 'Go back',
    not_found_search_cta: () => 'Search products',
    not_found_browse_categories_cta: () => 'Browse categories',
    not_found_browse_shops_cta: () => 'Discover makers',
  },
}))

describe('NotFoundPage', () => {
  it('renders default title, description and decorative 404', () => {
    render(<NotFoundPage />)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeDefined()
    expect(screen.getByText('The page you are looking for does not exist.')).toBeDefined()
    expect(screen.getByText('404')).toBeDefined()
  })

  it('renders recovery CTAs with correct hrefs', () => {
    render(<NotFoundPage />)

    const searchLink = screen.getByRole('link', { name: 'Search products' })
    const categoriesLink = screen.getByRole('link', { name: 'Browse categories' })
    const shopsLink = screen.getByRole('link', { name: 'Discover makers' })

    expect(searchLink.getAttribute('href')).toBe('/search')
    expect(categoriesLink.getAttribute('href')).toBe('/category/all')
    expect(shopsLink.getAttribute('href')).toBe('/')

    expect(screen.getByRole('button', { name: 'Go back' })).toBeDefined()
  })

  it('uses custom title and description when provided', () => {
    render(<NotFoundPage title='Custom title' description='Custom description' />)

    expect(screen.getByRole('heading', { name: 'Custom title' })).toBeDefined()
    expect(screen.getByText('Custom description')).toBeDefined()
  })
})
