// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckoutOrderItems } from './CheckoutOrderItems'

vi.mock('#/paraglide/messages', async () => {
  return await import('./checkout-test-messages')
})

import { makeSummary } from './checkout-fixtures'

describe('CheckoutOrderItems', () => {
  it('renders order items', () => {
    render(<CheckoutOrderItems currentSummary={makeSummary()} />)
    expect(screen.getByText('Vase')).toBeDefined()
    expect(screen.getByText('Qty: 2')).toBeDefined()
  })
})
