// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import type { PublicProduct } from '#/lib/products'
import { DiscoveryWall } from './DiscoveryWall'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; className?: string; 'aria-label'?: string }) => (
    <a href='/product' className={props.className} aria-label={props['aria-label']}>
      {props.children}
    </a>
  ),
}))

function makeProduct(id: string, overrides?: Partial<PublicProduct>): PublicProduct {
  return {
    id,
    name: `Handmade object ${id}`,
    description: 'Made in an independent workshop',
    slug: `object-${id}`,
    priceCents: 4999,
    stockCount: 4,
    isActive: true,
    status: 'published',
    publishedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    categoryName: 'Ceramics',
    categorySlug: 'ceramics',
    shopName: 'Atelier Noord',
    shopSlug: 'atelier-noord',
    shopIsVatRegistered: true,
    imageUrl: null,
    weightGrams: null,
    volumeMl: null,
    soldBy: null,
    ...overrides,
  }
}

describe('DiscoveryWall', () => {
  it('renders every product as an accessible marketplace link', () => {
    const products = [makeProduct('one'), makeProduct('two'), makeProduct('three')]

    render(<DiscoveryWall products={products} />)

    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Product: Handmade object one' })).toBeDefined()
    expect(screen.getAllByText('Atelier Noord')).toHaveLength(3)
    expect(screen.getAllByText('€49.99')).toHaveLength(3)
  })

  it('omits products without a routable shop instead of rendering dead links', () => {
    render(
      <DiscoveryWall
        products={[makeProduct('unroutable', { shopSlug: null }), makeProduct('routable')]}
      />,
    )

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Product: Handmade object unroutable' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Product: Handmade object routable' })).toBeDefined()
  })

  it('provides a stable shared-element name for product navigation', () => {
    render(<DiscoveryWall products={[makeProduct('one')]} />)

    const imageBoundary = screen.getByRole('link').firstElementChild as HTMLElement
    expect(imageBoundary.style.getPropertyValue('view-transition-name')).toBe('product-image-one')
  })

  it('uses an irregular lead tile instead of an equal card grid', () => {
    render(<DiscoveryWall products={[makeProduct('one'), makeProduct('two')]} />)

    const [leadTile, supportingTile] = screen.getAllByRole('link')
    expect(leadTile.classList.contains('col-span-2')).toBe(true)
    expect(leadTile.classList.contains('md:row-span-2')).toBe(true)
    expect(supportingTile.classList.contains('col-span-2')).toBe(false)
  })

  it('has no automated accessibility violations', async () => {
    const { container } = render(
      <DiscoveryWall products={[makeProduct('one'), makeProduct('two')]} />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
