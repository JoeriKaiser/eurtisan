// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import type { NotificationItem } from '#/lib/notifications.server'
import { StatementOfReasons } from './StatementOfReasons'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    statement_of_reasons_title: () => 'Why this decision was made',
    statement_of_reasons_what_label: () => 'What we did',
    statement_of_reasons_what_hidden: () => 'We hid your review.',
    statement_of_reasons_what_restricted: () => 'We restricted your review.',
    statement_of_reasons_scope: () => 'This applies everywhere, indefinitely.',
    statement_of_reasons_why_label: () => 'Why',
    statement_of_reasons_ground_illegal: () => 'The ground is that it is against the law.',
    statement_of_reasons_ground_terms: () => 'The ground is that it breaks the terms.',
    statement_of_reasons_prompted_by_report: () => 'Someone reported your review.',
    statement_of_reasons_prompted_by_review: () => 'A moderator decided without a report.',
    statement_of_reasons_automated_label: () => 'Was this automated?',
    statement_of_reasons_automated_yes: () => 'Yes, automated tools were used.',
    statement_of_reasons_automated_no: () => 'No. A person made this decision.',
    statement_of_reasons_redress_label: () => 'If you disagree',
    statement_of_reasons_redress_support: ({ email }: { email: string }) => `Email ${email}.`,
    statement_of_reasons_redress_judicial: () => 'You can also go to a court.',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

function makeItem(data: Record<string, unknown> = {}): NotificationItem {
  return {
    id: 'n1',
    userId: 'u1',
    type: 'review_moderated',
    data: {
      reviewId: 'r1',
      restriction: 'hidden',
      territorialScope: 'all',
      duration: 'indefinite',
      explanation: 'Names another customer.',
      promptedByNotice: true,
      automatedMeans: false,
      ground: 'terms',
      redress: ['contact_support', 'judicial_remedy'],
      ...data,
    },
    readAt: null,
    createdAt: new Date('2026-07-31'),
  } as NotificationItem
}

describe('StatementOfReasons', () => {
  it('renders all six Article 17(3) elements', () => {
    render(<StatementOfReasons item={makeItem()} />)

    // (a) restriction, scope, duration
    expect(screen.getByText('We hid your review.', { exact: false })).toBeDefined()
    expect(screen.getByText(/This applies everywhere, indefinitely\./)).toBeDefined()
    // (b) facts, and whether a notice prompted it
    expect(screen.getByText('Names another customer.')).toBeDefined()
    expect(screen.getByText('Someone reported your review.')).toBeDefined()
    // (c) automated means
    expect(screen.getByText('No. A person made this decision.')).toBeDefined()
    // (d)/(e) ground
    expect(screen.getByText('The ground is that it breaks the terms.')).toBeDefined()
    // (f) redress
    expect(screen.getByText('Email support@eurtisan.eu.')).toBeDefined()
    expect(screen.getByText('You can also go to a court.')).toBeDefined()
  })

  it("shows the moderator's words verbatim rather than paraphrasing", () => {
    // 17(3)(b) is the facts relied on. Summarising them here would defeat it.
    render(<StatementOfReasons item={makeItem({ explanation: 'Line one\nLine two' })} />)
    expect(screen.getByText(/Line one\s+Line two/)).toBeDefined()
  })

  it('distinguishes a demotion from a removal', () => {
    render(<StatementOfReasons item={makeItem({ restriction: 'flagged' })} />)
    expect(screen.getByText('We restricted your review.', { exact: false })).toBeDefined()
  })

  it('states the legal ground when that is the ground', () => {
    render(<StatementOfReasons item={makeItem({ ground: 'illegal' })} />)
    expect(screen.getByText('The ground is that it is against the law.')).toBeDefined()
  })

  it('says so when no report prompted the decision', () => {
    render(<StatementOfReasons item={makeItem({ promptedByNotice: false })} />)
    expect(screen.getByText('A moderator decided without a report.')).toBeDefined()
  })

  it('offers appeal by email with the notification referenced', () => {
    render(<StatementOfReasons item={makeItem()} />)
    const link = screen.getByRole('link', { name: /Email support@eurtisan\.eu/ })
    expect(link.getAttribute('href')).toContain('mailto:support@eurtisan.eu')
    expect(link.getAttribute('href')).toContain('n1')
  })

  it('omits a redress route that was not offered', () => {
    // Article 21 out-of-court settlement is not offered, and a route that does
    // not exist must not be named.
    render(<StatementOfReasons item={makeItem({ redress: ['judicial_remedy'] })} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('You can also go to a court.')).toBeDefined()
  })

  it('is reachable without JavaScript and collapsed by default', () => {
    const { container } = render(<StatementOfReasons item={makeItem()} />)
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details?.hasAttribute('open')).toBe(false)
  })

  it('has no axe violations', async () => {
    const { container } = render(<StatementOfReasons item={makeItem()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
