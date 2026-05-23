// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileNavDrawer from './MobileNavDrawer'

const mockNavigate = vi.fn()
const mockOnClose = vi.fn()
const mockSetLocale = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    onClick?: () => void
    [key: string]: unknown
  }) => (
    <a
      href={props.to}
      className={props.className}
      onClick={() => {
        if (props.onClick) props.onClick()
      }}
      aria-label={props['aria-label'] as string}
    >
      {props.children}
    </a>
  ),
  useRouter: () => ({
    navigate: mockNavigate,
  }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    nav_logo: () => 'Eurtisan',
    nav_home: () => 'Home',
    nav_about: () => 'About',
    nav_categories: () => 'Categories',
  },
}))

vi.mock('#/paraglide/runtime', () => ({
  getLocale: () => 'en',
  locales: ['en', 'fr'],
  setLocale: (locale: string) => mockSetLocale(locale),
}))

vi.mock('./ThemeToggle', () => ({
  default: () => <button type='button'>Theme Toggle Button</button>,
}))

describe('MobileNavDrawer', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockOnClose.mockClear()
    mockSetLocale.mockClear()
  })

  it('renders nothing when closed', () => {
    render(
      <MobileNavDrawer
        isOpen={false}
        onClose={mockOnClose}
        categories={[]}
        isLoadingCategories={false}
      />,
    )
    expect(screen.queryByText('Eurtisan')).toBeNull()
    expect(screen.queryByText('Home')).toBeNull()
  })

  it('renders correctly when open', () => {
    render(
      <MobileNavDrawer
        isOpen={true}
        onClose={mockOnClose}
        categories={[]}
        isLoadingCategories={false}
      />,
    )
    expect(screen.getByText('Eurtisan')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('About')).toBeDefined()
    expect(screen.getByText('Theme Toggle Button')).toBeDefined()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <MobileNavDrawer
        isOpen={true}
        onClose={mockOnClose}
        categories={[]}
        isLoadingCategories={false}
      />,
    )
    const closeBtn = screen.getByRole('button', { name: 'Close menu' })
    fireEvent.click(closeBtn)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when home or about links are clicked', () => {
    render(
      <MobileNavDrawer
        isOpen={true}
        onClose={mockOnClose}
        categories={[]}
        isLoadingCategories={false}
      />,
    )
    const homeLink = screen.getByRole('link', { name: 'Home' })
    fireEvent.click(homeLink)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('renders categories collapsible when categories are available', () => {
    const categories = [{ id: '1', name: 'Ceramics', slug: 'ceramics' }]
    render(
      <MobileNavDrawer
        isOpen={true}
        onClose={mockOnClose}
        categories={categories}
        isLoadingCategories={false}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Categories' })
    expect(trigger).toBeDefined()
    expect(screen.queryByText('Ceramics')).toBeNull()

    // Expand categories
    fireEvent.click(trigger)
    const catLink = screen.getByRole('link', { name: 'Ceramics' })
    expect(catLink).toBeDefined()

    // Click category link
    fireEvent.click(catLink)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('renders loader skeleton inside categories when loading', () => {
    render(
      <MobileNavDrawer
        isOpen={true}
        onClose={mockOnClose}
        categories={[]}
        isLoadingCategories={true}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Categories' })
    fireEvent.click(trigger)

    // Check if loading state skeleton renders
    const pulseElement = screen.getByRole('list').querySelector('.animate-pulse')
    expect(pulseElement).toBeDefined()
  })

  it('allows changing language and closes drawer', () => {
    render(
      <MobileNavDrawer
        isOpen={true}
        onClose={mockOnClose}
        categories={[]}
        isLoadingCategories={false}
      />,
    )
    const frButton = screen.getByRole('button', { name: 'fr' })
    expect(frButton).toBeDefined()

    fireEvent.click(frButton)
    expect(mockSetLocale).toHaveBeenCalledWith('fr')
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
