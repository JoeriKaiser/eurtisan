// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Footer from './Footer'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    footer_tagline: () => 'European marketplace for makers',
    footer_copyright: ({ year }: { year: string }) => `© ${year} Eurtisan. All rights reserved.`,
    footer_built_with: () => 'Handmade with care in Europe',
    nav_main: () => 'Main navigation',
    footer_nav_browse: () => 'Browse',
    nav_categories: () => 'Categories',
    footer_nav_about: () => 'About',
    home_makers_kicker: () => 'For makers',
    footer_nav_sell: () => 'Sell',
    footer_legal_privacy: () => 'Privacy Policy',
    footer_legal_terms: () => 'Terms of Service',
    footer_legal_cookies: () => 'Cookie Policy',
    footer_legal_imprint: () => 'Legal Notice (Imprint)',
  },
}))

vi.mock('./LocaleDropdown', () => ({
  default: () => <div data-testid='locale-dropdown'>Locale</div>,
}))

vi.mock('./Logo', () => ({
  default: ({ textClassName }: { textClassName?: string }) => (
    <div data-testid='logo' className={textClassName}>
      Logo
    </div>
  ),
}))

describe('Footer', () => {
  it('renders the footer without placeholder social links', () => {
    render(<Footer />)

    expect(screen.getByTestId('logo')).toBeDefined()
    expect(screen.getByText('European marketplace for makers')).toBeDefined()
    expect(screen.getByTestId('locale-dropdown')).toBeDefined()

    expect(screen.queryByText('Follow Eurtisan on X')).toBeNull()
    expect(screen.queryByText('Go to Eurtisan GitHub')).toBeNull()
    expect(screen.queryByRole('link', { name: /tan_stack/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /TanStack/i })).toBeNull()
  })
})
