// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ReviewDisclosure } from './ReviewDisclosure'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    review_disclosure_title: () => 'How we handle reviews',
    review_disclosure_verified_body: () => 'Every review comes from someone who bought it here.',
    review_disclosure_check_purchase: () => 'The account placed the order.',
    review_disclosure_check_delivered: () => 'Delivered, and 14 days have passed.',
    review_disclosure_check_once: () => 'One review per product per order.',
    review_disclosure_check_own: () => 'Makers cannot review their own products.',
    review_disclosure_order: () =>
      'Reviews are shown newest first by default. You can also order them by highest rating, lowest rating, or the number of people who marked them helpful.',
    review_disclosure_dates: () => 'Both the publication and experience dates are shown.',
    review_disclosure_moderation: () => 'Reporting alone changes nothing.',
    review_disclosure_retention: () => 'Kept while the product is listed.',
    review_disclosure_no_payment: () => 'Nobody is paid for writing a review.',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

describe('ReviewDisclosure', () => {
  it('states that reviews come from verified purchasers', () => {
    // CRD Article 6a(1)(c). Without this, UCPD Annex I 23b makes the implied
    // claim a banned practice.
    render(<ReviewDisclosure />)
    expect(screen.getByText('Every review comes from someone who bought it here.')).toBeDefined()
  })

  it('lists every check that is actually performed', () => {
    render(<ReviewDisclosure />)
    expect(screen.getByText('The account placed the order.')).toBeDefined()
    expect(screen.getByText('Delivered, and 14 days have passed.')).toBeDefined()
    expect(screen.getByText('One review per product per order.')).toBeDefined()
    expect(screen.getByText('Makers cannot review their own products.')).toBeDefined()
  })

  it('covers the four things L.111-7-2 asks for beyond verification', () => {
    render(<ReviewDisclosure />)
    expect(
      screen.getByText(
        'Reviews are shown newest first by default. You can also order them by highest rating, lowest rating, or the number of people who marked them helpful.',
      ),
    ).toBeDefined()
    expect(screen.getByText('Both the publication and experience dates are shown.')).toBeDefined()
    expect(screen.getByText('Reporting alone changes nothing.')).toBeDefined()
    expect(screen.getByText('Kept while the product is listed.')).toBeDefined()
  })

  it('states that reviews are not paid for', () => {
    render(<ReviewDisclosure />)
    expect(screen.getByText('Nobody is paid for writing a review.')).toBeDefined()
  })

  it('is reachable without JavaScript and collapsed by default', () => {
    // A `<details>` rather than a toggle: the disclosure has to be there for a
    // keyboard and screen-reader user even if hydration never happens.
    const { container } = render(<ReviewDisclosure />)
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details?.hasAttribute('open')).toBe(false)
    expect(container.querySelector('summary')).not.toBeNull()
  })

  it('has no axe violations', async () => {
    const { container } = render(<ReviewDisclosure />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
