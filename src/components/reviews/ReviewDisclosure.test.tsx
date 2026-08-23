// @vitest-environment jsdom

import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ReviewDisclosure } from './ReviewDisclosure'

/**
 * Renders the disclosure against the real English message strings rather than a
 * hand-written mock. Every sentence is legally load-bearing (CRD Article
 * 6a(1)(c), UCPD Annex I point 23b, C. consom. L.111-7-2), so this test must
 * fail when the component stops rendering what the messages actually say — or
 * when a locale loses one of the `review_disclosure_*` strings. Whether those
 * strings still tell the truth about the implementation is pinned separately in
 * `src/test/review-disclosure-accuracy.test.ts`.
 *
 * It reads `messages/en.json` directly because the generated `src/paraglide/`
 * output is produced by `make i18n-compile` and is never imported here. An
 * unknown key throws instead of falling back to the key name: a silent fallback
 * could let a dropped message render green.
 */

function repoRoot(): string {
  // `import.meta.dirname` exists under Node >= 20.11; fall back to the Vitest
  // working directory (the workspace root) when unavailable.
  return typeof import.meta.dirname === 'string'
    ? join(import.meta.dirname, '../../..')
    : process.cwd()
}

vi.mock('#/paraglide/messages', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const messages = JSON.parse(readFileSync(join(repoRoot(), 'messages/en.json'), 'utf8')) as Record<
    string,
    string
  >

  const translate =
    (template: string) =>
    (params?: Record<string, string>): string =>
      template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
        params && key in params ? params[key] : placeholder,
      )

  return {
    m: new Proxy(
      {},
      {
        get: (_target, key: string) => {
          const template = messages[key]
          if (typeof template !== 'string') {
            throw new Error(`Unknown Paraglide message used by ReviewDisclosure: ${String(key)}`)
          }
          return translate(template)
        },
      },
    ),
  }
})

describe('ReviewDisclosure', () => {
  it('states that reviews come from verified purchasers', () => {
    // CRD Article 6a(1)(c). Without this, UCPD Annex I 23b makes the implied
    // claim a banned practice.
    render(<ReviewDisclosure />)
    expect(screen.getByText('How we handle reviews')).toBeDefined()
    expect(
      screen.getByText(
        'Every review on Eurtisan comes from someone who bought the product here. We check this automatically, before a review can be written:',
      ),
    ).toBeDefined()
  })

  it('lists every check that is actually performed', () => {
    render(<ReviewDisclosure />)
    expect(
      screen.getByText("The reviewer's account placed the order that contains the product."),
    ).toBeDefined()
    expect(
      screen.getByText(
        'The order was marked delivered, and 14 days have passed since — so the review reflects living with the product, not unboxing it.',
      ),
    ).toBeDefined()
    expect(
      screen.getByText(
        'One review per product per order, so a single purchase cannot be reviewed twice.',
      ),
    ).toBeDefined()
    expect(screen.getByText('Makers cannot review products from their own shop.')).toBeDefined()
  })

  it('covers the four things L.111-7-2 asks for beyond verification', () => {
    render(<ReviewDisclosure />)
    expect(
      screen.getByText(
        'Reviews are shown newest first by default. You can also order them by highest rating, lowest rating, or helpful marks, and filter them by star rating.',
      ),
    ).toBeDefined()
    expect(
      screen.getByText(
        'Each review shows the date it was published and the date the buyer received the product.',
      ),
    ).toBeDefined()
    expect(
      screen.getByText(
        'We do not edit reviews. Anyone can report one, which sends it to a moderator — reporting alone changes nothing. A moderator can hide a review that is illegal or breaks our terms, and the author is always told what was decided and why.',
      ),
    ).toBeDefined()
    expect(
      screen.getByText(
        'We keep reviews for as long as the product is listed. If a maker removes the product, or you close your account, the review goes with it.',
      ),
    ).toBeDefined()
  })

  it('states that reviews are not paid for', () => {
    render(<ReviewDisclosure />)
    expect(
      screen.getByText(
        'Nobody is paid or rewarded for writing a review, and makers cannot pay to have one removed.',
      ),
    ).toBeDefined()
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
