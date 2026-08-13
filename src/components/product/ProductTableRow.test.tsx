// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductTableRow } from './ProductTableRow'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
    'aria-label'?: string
  }) => (
    <a
      href={props.to}
      className={props.className}
      aria-label={props['aria-label']}
      data-params={JSON.stringify(props.params)}
    >
      {props.children}
    </a>
  ),
}))

vi.mock('#/lib/image-url', () => ({
  getImageUrl: (key: string, _options?: unknown) => `https://img.example.com/${key}`,
}))

function makeProduct(overrides?: Partial<Parameters<typeof ProductTableRow>[0]['product']>) {
  return {
    id: 'prod-1',
    name: 'Handmade Vase',
    slug: 'handmade-vase',
    priceCents: 2999,
    stockCount: 5,
    isActive: true,
    status: 'published' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    thumbnailUrl: 'uploads/prod-1-thumb.webp',
    ...overrides,
  }
}

describe('ProductTableRow', () => {
  it('renders product name and price', () => {
    render(
      <table>
        <tbody>
          <ProductTableRow
            product={makeProduct()}
            currentShopId='shop-1'
            active={true}
            toggling={false}
            onToggle={() => {}}
          />
        </tbody>
      </table>,
    )

    expect(screen.getByText('Handmade Vase')).toBeDefined()
    expect(screen.getByText('€29.99')).toBeDefined()
  })

  it('renders thumbnail through getImageUrl', () => {
    const { container } = render(
      <table>
        <tbody>
          <ProductTableRow
            product={makeProduct()}
            currentShopId='shop-1'
            active={true}
            toggling={false}
            onToggle={() => {}}
          />
        </tbody>
      </table>,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://img.example.com/uploads/prod-1-thumb.webp')
  })

  it('links edit to /creator/products/$productId/edit', () => {
    render(
      <table>
        <tbody>
          <ProductTableRow
            product={makeProduct()}
            currentShopId='shop-1'
            active={true}
            toggling={false}
            onToggle={() => {}}
          />
        </tbody>
      </table>,
    )

    const editLink = screen.getByRole('link', { name: 'Edit Handmade Vase' })
    expect(editLink.getAttribute('href')).toBe('/creator/products/$productId/edit')
    expect(editLink.getAttribute('data-params')).toBe(JSON.stringify({ productId: 'prod-1' }))
  })

  it('toggles active state when toggle button is clicked', () => {
    const onToggle = vi.fn()
    render(
      <table>
        <tbody>
          <ProductTableRow
            product={makeProduct()}
            currentShopId='shop-1'
            active={true}
            toggling={false}
            onToggle={onToggle}
          />
        </tbody>
      </table>,
    )

    screen.getByRole('button', { name: 'Deactivate Handmade Vase' }).click()
    expect(onToggle).toHaveBeenCalledWith('prod-1', 'shop-1', true)
  })

  it('shows inactive state', () => {
    render(
      <table>
        <tbody>
          <ProductTableRow
            product={makeProduct()}
            currentShopId='shop-1'
            active={false}
            toggling={false}
            onToggle={() => {}}
          />
        </tbody>
      </table>,
    )

    expect(screen.getByRole('button', { name: 'Activate Handmade Vase' })).toBeDefined()
  })

  it('hides actions when currentShopId is null', () => {
    render(
      <table>
        <tbody>
          <ProductTableRow
            product={makeProduct()}
            currentShopId={null}
            active={true}
            toggling={false}
            onToggle={() => {}}
          />
        </tbody>
      </table>,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Edit Handmade Vase' })).toBeNull()
  })

  it('hides the active toggle for non-published products', () => {
    render(
      <table>
        <tbody>
          <ProductTableRow
            product={makeProduct({ status: 'draft' })}
            currentShopId='shop-1'
            active={false}
            toggling={false}
            onToggle={() => {}}
          />
        </tbody>
      </table>,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Draft')).toBeDefined()
  })
})
