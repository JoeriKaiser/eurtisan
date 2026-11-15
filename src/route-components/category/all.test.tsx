// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { CategoriesAllPage } from './all'

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => ({
    categories: [
      {
        id: 'cat-1',
        name: 'Ceramics',
        slug: 'ceramics',
        description: null,
        productCount: 12,
      },
      {
        id: 'cat-2',
        name: 'Textiles',
        slug: 'textiles',
        description: 'Woven goods',
        productCount: 5,
      },
    ],
  }),
  Link: (props: { children: React.ReactNode; to: string; params?: Record<string, string> }) => (
    <a href={props.params?.slug ? props.to.replace('$slug', props.params.slug) : props.to}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    categories_all_kicker: () => 'Categories',
    categories_all_title: () => 'All categories',
    categories_all_description: () => 'Browse handmade categories across Europe.',
    categories_all_empty_title: () => 'No categories yet',
    categories_all_empty_description: () => 'Categories will appear once products are published.',
    category_product_count: ({ count }: { count: number }) => `${count} products`,
    home_explore_collections: () => 'Explore collection',
  },
}))

describe('CategoriesAllPage', () => {
  it('renders sequential h1 -> h2 heading hierarchy without skipped levels', async () => {
    const { container } = render(<CategoriesAllPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'All categories' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Ceramics' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Textiles' })).toBeDefined()
    expect(container.querySelectorAll('h3')).toHaveLength(0)

    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  })
})
