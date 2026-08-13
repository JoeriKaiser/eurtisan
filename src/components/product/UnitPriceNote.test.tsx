// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UnitPriceNote } from './UnitPriceNote'

vi.mock('#/paraglide/messages', () => ({
  m: {
    unit_price_per_kg: ({ price }: { price: string }) => `${price} / kg`,
    unit_price_per_litre: ({ price }: { price: string }) => `${price} / L`,
  },
}))

vi.mock('#/lib/pricing', () => ({
  formatPriceEUR: (cents: number) => `€${(cents / 100).toFixed(2)}`,
}))

describe('UnitPriceNote', () => {
  it('renders the per-kilogram price for a weight-basis product', () => {
    const { container } = render(
      <UnitPriceNote priceCents={1250} soldBy='weight' weightGrams={250} volumeMl={null} />,
    )
    expect(screen.getByText('€50.00 / kg')).toBeDefined()
    expect(container.textContent).toContain('€50.00 / kg')
  })

  it('renders the per-litre price for a volume-basis product', () => {
    render(<UnitPriceNote priceCents={900} soldBy='volume' weightGrams={null} volumeMl={300} />)
    expect(screen.getByText('€30.00 / L')).toBeDefined()
  })

  it('renders nothing without a basis', () => {
    const { container } = render(
      <UnitPriceNote priceCents={1250} soldBy={null} weightGrams={250} volumeMl={null} />,
    )
    expect(container.textContent).toBe('')
  })

  it('renders nothing when the net quantity is exactly one kilogram', () => {
    const { container } = render(
      <UnitPriceNote priceCents={1200} soldBy='weight' weightGrams={1000} volumeMl={null} />,
    )
    expect(container.textContent).toBe('')
  })
})
