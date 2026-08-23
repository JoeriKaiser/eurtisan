// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import type { NotificationItem } from '#/lib/notifications.server'
import { ShopModerationNotice } from './ShopModerationNotice'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    sor_notification_summary: () => 'Statement of reasons for this decision',
    sor_notification_measure_suspended_delisted: () =>
      'Your shop is suspended and its listings are hidden.',
    sor_notification_active_body: () =>
      'Your shop is live and your listings are visible to buyers.',
    sor_notification_status_link: () => 'View your shop status',
    statement_of_reasons_what_label: () => 'What we did',
    statement_of_reasons_why_label: () => 'Why',
    statement_of_reasons_automated_label: () => 'Was this automated?',
    statement_of_reasons_automated_no: () => 'No. A person made this decision.',
    statement_of_reasons_automated_yes: () => 'Yes, automated tools were used.',
    statement_of_reasons_redress_label: () => 'If you disagree',
    statement_of_reasons_redress_support: ({ email }: { email: string }) => `Email ${email}.`,
    statement_of_reasons_redress_judicial: () => 'You can also go to a court.',
    dsa_sor_grounds_generic: () => 'A moderator found that the shop breaks the terms.',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

function makeItem(data: Record<string, unknown>): NotificationItem {
  return {
    id: 'n1',
    userId: 'u1',
    type: 'shop_moderation_update',
    data,
    readAt: null,
    createdAt: new Date('2026-08-01'),
  } as NotificationItem
}

/** Mirrors the payload `sendModerationNotice` writes for a suspension. */
const suspensionPayload = {
  shopId: 'shop-1',
  shopName: 'Clay Studio',
  status: 'suspended',
  statusLabel: 'suspended',
  note: 'Repeated policy violations.',
  targetPath: '/sell/status/shop-1',
  measure: 'shop_suspended_listings_delisted',
  groundsKind: 'note',
  groundsKey: null,
  redressSupportEmail: 'support@eurtisan.eu',
  judicialRemedyAvailable: true,
  automatedMeans: false,
}

describe('ShopModerationNotice', () => {
  it('renders the Article 17(3) elements for a suspension', () => {
    render(<ShopModerationNotice item={makeItem(suspensionPayload)} />)

    // (a) the measure
    expect(screen.getByText('Your shop is suspended and its listings are hidden.')).toBeDefined()
    // (b) the moderator's grounds, verbatim
    expect(screen.getByText('Repeated policy violations.')).toBeDefined()
    // (c) automated means
    expect(screen.getByText('No. A person made this decision.')).toBeDefined()
    // (f) redress: internal complaint plus judicial remedy
    expect(screen.getByText('You can also go to a court.')).toBeDefined()
    const support = screen.getByRole('link', { name: /Email support@eurtisan\.eu/ })
    expect(support.getAttribute('href')).toContain('mailto:support@eurtisan.eu')
    expect(support.getAttribute('href')).toContain('n1')
  })

  it('resolves the neutral generic grounds when no note was recorded', () => {
    render(
      <ShopModerationNotice
        item={makeItem({
          ...suspensionPayload,
          note: '',
          groundsKind: 'generic',
          groundsKey: 'dsa_sor_grounds_generic',
        })}
      />,
    )

    expect(screen.getByText('A moderator found that the shop breaks the terms.')).toBeDefined()
    expect(screen.queryByText('Repeated policy violations.')).toBeNull()
  })

  it('deep links to the shop status page via the payload target path', () => {
    render(<ShopModerationNotice item={makeItem(suspensionPayload)} />)

    const link = screen.getByRole('link', { name: 'View your shop status' })
    expect(link.getAttribute('href')).toBe('/sell/status/shop-1')
  })

  it('renders a success card without a statement when a suspension is lifted', () => {
    const { container } = render(
      <ShopModerationNotice
        item={makeItem({
          shopId: 'shop-1',
          shopName: 'Clay Studio',
          status: 'active',
          statusLabel: 'active',
          note: '',
          targetPath: '/sell/status/shop-1',
        })}
      />,
    )

    expect(
      screen.getByText('Your shop is live and your listings are visible to buyers.'),
    ).toBeDefined()
    expect(container.querySelector('details')).toBeNull()
    expect(screen.queryByText(/support@eurtisan\.eu/)).toBeNull()
  })

  it('renders nothing for routine review outcomes', () => {
    const { container } = render(
      <ShopModerationNotice
        item={makeItem({
          shopId: 'shop-1',
          shopName: 'Clay Studio',
          status: 'changes_requested',
          note: 'Add photos.',
        })}
      />,
    )

    expect(container.textContent).toBe('')
  })

  it('is reachable without JavaScript and collapsed by default', () => {
    const { container } = render(<ShopModerationNotice item={makeItem(suspensionPayload)} />)
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details?.hasAttribute('open')).toBe(false)
  })

  it('has no axe violations', async () => {
    const { container } = render(<ShopModerationNotice item={makeItem(suspensionPayload)} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
